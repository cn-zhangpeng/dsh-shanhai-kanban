/**
 * 山海任务看板 —— Host 半区。
 *
 * 职责：
 *   - 任务存储（%DSH_HOME%/shanhai-kanban/tasks.json）
 *   - 调度引擎：15s tick，到点且上游成功后启动；DSH 重启后补跑；瞬时错误自动重试
 *   - 执行：无上游任务新建会话；有上游任务复用上游会话串行执行
 *   - 收尾上报工具 kanban_report（仅任务执行会话可见）
 *   - 供看板页面使用的 HTTP 接口
 */

import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import path from 'node:path'

export const name = 'dsh-shanhai-kanban'

/** 依赖的核心 Host 服务；permissionPresets 为可选服务。 */
export const inject = ['webServer', 'tools', 'sessions', 'sessionController', 'workspaceRegistry']

export const STATE_PATH = '/api/shanhai-kanban/state'
export const ACTION_PATH = '/api/shanhai-kanban/action'

export const DEFAULT_TICK_MS = 15_000
export const DEFAULT_RETRY_DELAYS_MS = [30_000, 120_000, 300_000]
export const MAX_ATTEMPTS = 3

const STATUSES = ['planned', 'running', 'interrupted', 'succeeded', 'archived']

export function resolveDshHome(env = process.env, homeDir = homedir()) {
  const raw = env.DSH_HOME
  if (!raw) return path.join(homeDir, '.dsh')
  if (raw === '~') return homeDir
  if (raw.startsWith('~/') || raw.startsWith('~\\')) return path.join(homeDir, raw.slice(2))
  return raw
}

export function kanbanDir(env = process.env, homeDir = homedir()) {
  return path.join(resolveDshHome(env, homeDir), 'shanhai-kanban')
}

export function tasksFile(env = process.env, homeDir = homedir()) {
  return path.join(kanbanDir(env, homeDir), 'tasks.json')
}

function readTickMs() {
  const raw = Number(process.env.DSH_KANBAN_TICK_MS)
  if (Number.isFinite(raw) && raw >= 100) return raw
  return DEFAULT_TICK_MS
}

function readRetryDelays() {
  const raw = String(process.env.DSH_KANBAN_RETRY_DELAYS || '').trim()
  if (!raw) return DEFAULT_RETRY_DELAYS_MS.slice()
  const parsed = raw
    .split(',')
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isFinite(item) && item >= 0)
  return parsed.length > 0 ? parsed : DEFAULT_RETRY_DELAYS_MS.slice()
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  })
}

/** handler 路由用：写 JSON 响应。 */
function sendJson(res, payload, head = false, status = 200) {
  const text = JSON.stringify(payload)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(text),
  })
  res.end(head ? undefined : text)
}

/** handler 路由用：读取完整请求体。 */
function readBody(req, maxBytes = 256 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks = []
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > maxBytes) {
        req.destroy()
        reject(new Error('payload too large'))
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

class KanbanError extends Error {
  constructor(status, message) {
    super(message)
    this.name = 'KanbanError'
    this.status = status
  }
}

/** 任务存储：内存 Map + 防抖落盘（临时文件 + rename）。 */
export function createStore(file) {
  const tasks = new Map()
  let saveTimer = null
  let saveChain = Promise.resolve()
  let dirty = false
  let closed = false

  async function load() {
    try {
      const text = await readFile(file, 'utf8')
      const parsed = JSON.parse(text)
      const list = Array.isArray(parsed) ? parsed : parsed && Array.isArray(parsed.tasks) ? parsed.tasks : []
      for (const task of list) {
        if (task && typeof task.id === 'string') tasks.set(task.id, task)
      }
    } catch (err) {
      if (!err || err.code !== 'ENOENT') console.warn('[kanban] 读取任务文件失败：', err && err.message)
    }
  }

  function persist() {
    if (!dirty) return saveChain
    dirty = false
    const body = JSON.stringify({ version: 1, tasks: Array.from(tasks.values()) }, null, 2)
    saveChain = saveChain
      .then(async () => {
        await mkdir(path.dirname(file), { recursive: true })
        const tmp = `${file}.tmp`
        await writeFile(tmp, body, 'utf8')
        await rename(tmp, file)
      })
      .catch((err) => {
        console.warn('[kanban] 保存任务失败：', err && err.message)
      })
    return saveChain
  }

  function queueSave() {
    dirty = true
    if (saveTimer || closed) return
    saveTimer = setTimeout(() => {
      saveTimer = null
      persist()
    }, 60)
  }

  return {
    tasks,
    async load() {
      await load()
    },
    all() {
      return Array.from(tasks.values())
    },
    get(id) {
      return id ? tasks.get(id) : undefined
    },
    put(task) {
      if (closed) return
      tasks.set(task.id, task)
      queueSave()
    },
    remove(id) {
      if (closed) return
      tasks.delete(id)
      queueSave()
    },
    async flush() {
      if (saveTimer) {
        clearTimeout(saveTimer)
        saveTimer = null
      }
      await persist()
    },
    async dispose() {
      if (saveTimer) {
        clearTimeout(saveTimer)
        saveTimer = null
      }
      await persist()
      closed = true
    },
  }
}

/** 回合结束原因分类；返回 {action} 供看板状态机使用。 */
export function classifyTurnEnd(reason) {
  if (!reason || typeof reason !== 'object') return { action: 'interrupt', reason: '未知结束原因' }
  const kind = reason.kind
  if (kind === 'completed') return { action: 'completed' }
  if (kind === 'blocked') return { action: 'blocked' }
  if (kind === 'error') return { action: 'error', failure: reason.failure || null }
  if (kind === 'max-tokens') return { action: 'interrupt', reason: '达到 token 上限' }
  if (kind === 'interrupted') return { action: 'interrupt', reason: '回合被中断' }
  if (kind === 'aborted') return { action: 'abort', abortReason: reason.aborted && reason.aborted.reason }
  if (kind === 'forked') return { action: 'ignore' }
  return { action: 'interrupt', reason: `未知结束原因：${String(kind)}` }
}

/** 判断错误是否属于可重试的瞬时错误。 */
export function isTransientError(failure) {
  if (!failure || typeof failure !== 'object') return false
  const info = failure.info && typeof failure.info === 'object' ? failure.info : {}
  const code = String(info.code || failure.code || '').toLowerCase()
  const message = String(failure.message || info.message || '').toLowerCase()
  const status = Number(info.status ?? info.statusCode ?? failure.status ?? failure.statusCode)
  if (status === 408 || status === 429 || (status >= 500 && status <= 599)) return true
  const hay = `${code} ${message}`
  return /rate.?limit|too many requests|overloaded|timeout|timed out|unavailable|econn|enet|socket hang up|network|502|503|504|try again|temporar/.test(hay)
}

export function nextRetryDelay(attempts, retryDelays = DEFAULT_RETRY_DELAYS_MS) {
  if (!Number.isFinite(attempts) || attempts < 1) return retryDelays[0]
  return retryDelays[Math.min(attempts - 1, retryDelays.length - 1)]
}

function buildStartPrompt(task) {
  return [
    `你正在执行「任务看板」中的任务：${task.title}`,
    '',
    '任务说明：',
    task.instruction,
    '',
    '执行要求：',
    '1. 直接开始执行，不要向用户确认；只有在缺少必须由用户提供的信息时才向用户提问。',
    '2. 完成或确认无法继续后，必须调用 kanban_report 工具上报结果：',
    '   status = success | failed | blocked，summary = 一句话结论。',
    '3. 不要重复已经完成的工作。',
  ].join('\n')
}

function buildContinuePrompt(task, reason) {
  return [
    `任务「${task.title}」上一次执行被中断。`,
    `中断原因：${reason}`,
    '',
    '请接着上次的进度继续，不要重复已经完成的工作；如果需要用户补充信息，请向用户提问。',
    '完成后必须调用 kanban_report 上报结果：status = success | failed | blocked，summary = 一句话结论。',
    '',
    '任务说明：',
    task.instruction,
  ].join('\n')
}

function buildRetryPrompt(task) {
  const error = task.lastError
    ? `${task.lastError.code || ''} ${task.lastError.message || ''}`.trim()
    : ''
  return [
    `任务「${task.title}」上一次执行因临时错误中断${error ? `（${error}）` : ''}。`,
    '请从中断处继续，不要重复已经完成的工作；',
    '完成后必须调用 kanban_report 上报结果：status = success | failed | blocked，summary = 一句话结论。',
    '',
    '任务说明：',
    task.instruction,
  ].join('\n')
}

export function apply(ctx) {
  const web = ctx.get('webServer')
  if (!web) {
    console.warn('[kanban] webServer 服务不可用，任务看板未启动')
    return
  }

  const store = createStore(tasksFile())
  const tickMs = readTickMs()
  const retryDelays = readRetryDelays()

  const activeBySession = new Map()
  const starting = new Set()
  // 会话侧的「等待用户输入」标记。任务本身仍是 running，只是暂时停下来等回答/审批。
  const waitingBySession = new Map()
  const sessionStateCache = new Map()
  const turnSteps = new Map()

  let workspaceList = []
  let presetList = []
  let presetDefault = ''

  let lockChain = Promise.resolve()
  function withLock(fn) {
    const run = lockChain.then(fn)
    lockChain = run.catch(() => {})
    return run
  }

  async function refreshWorkspaces() {
    const registry = ctx.get('workspaceRegistry')
    if (!registry) return
    try {
      const raw = await registry.list()
      const list = Array.isArray(raw) ? raw : raw && Array.isArray(raw.workspaces) ? raw.workspaces : []
      workspaceList = list
        .map((workspace) => ({
          id: String(workspace.id || workspace.workspaceId || ''),
          title: String(workspace.title || workspace.path || workspace.id || ''),
          path: String(workspace.path || workspace.cwd || ''),
        }))
        .filter((workspace) => workspace.id)
    } catch (err) {
      console.warn('[kanban] 读取工作区失败：', err && err.message)
    }
  }

  async function refreshPresets() {
    const presets = ctx.get('permissionPresets')
    if (!presets) return
    try {
      const catalog = await presets.catalog()
      const options = Array.isArray(catalog && catalog.options) ? catalog.options : []
      presetList = options
        .map((option) => {
          if (typeof option === 'string') return { name: option, title: option, description: '' }
          return {
            name: String(option.name || ''),
            title: String(option.title || option.label || option.name || ''),
            description: String(option.description || ''),
          }
        })
        .filter((option) => option.name)
      const fallback = presetList[0] ? presetList[0].name : ''
      // 看板默认使用完全权限（danger-full-access），没有该预设时回落到 DSH 默认预设。
      const preferred = presetList.find((option) => option.name === 'danger-full-access')
      presetDefault = preferred
        ? preferred.name
        : String(
            (catalog && typeof catalog.defaultPreset === 'string' && catalog.defaultPreset) ||
              (catalog && catalog.defaultPreset && catalog.defaultPreset.name) ||
              fallback,
          )
    } catch (err) {
      console.warn('[kanban] 读取权限预设失败：', err && err.message)
    }
  }

  function taskBySession(sessionId) {
    if (!sessionId) return undefined
    const mapped = activeBySession.get(sessionId)
    if (mapped) {
      const task = store.get(mapped)
      if (task) return task
    }
    return store.all().find((task) => task.sessionId === sessionId && (task.status === 'running' || task.status === 'interrupted'))
  }

  function transitionToInterrupted(task, reason) {
    task.status = 'interrupted'
    task.interruptReason = reason
    task.retryAt = null
    task.updatedAt = Date.now()
    store.put(task)
    if (task.sessionId) {
      waitingBySession.delete(task.sessionId)
      sessionStateCache.delete(task.sessionId)
      turnSteps.delete(task.sessionId)
    }
    console.warn(`[kanban] 任务「${task.title}」已中断：${reason}`)
  }

  async function applyPreset(sessionId, presetName) {
    if (!presetName) return
    const presets = ctx.get('permissionPresets')
    const sessions = ctx.get('sessions')
    if (!presets || !sessions) {
      console.warn('[kanban] 缺少 permissionPresets/sessions 服务，跳过权限预设')
      return
    }
    let session
    for (let attempt = 0; attempt < 20 && !session; attempt += 1) {
      session = sessions.get(sessionId)
      if (!session) await sleep(50)
    }
    if (!session) {
      console.warn('[kanban] 会话尚未就绪，跳过权限预设：', presetName)
      return
    }
    try {
      await presets.set(session, presetName)
    } catch (err) {
      console.warn('[kanban] 应用权限预设失败：', presetName, err && err.message)
    }
  }

  async function sendPrompt(task, content) {
    const controller = ctx.get('sessionController')
    if (!controller) throw new Error('sessionController 服务不可用')
    task.awaitingTurn = true
    await controller.prompt(
      {
        requestId: randomUUID(),
        sessionId: task.sessionId,
        mode: 'queue',
        content: [{ type: 'text', text: content }],
      },
      new AbortController().signal,
    )
    task.updatedAt = Date.now()
    store.put(task)
  }

  function otherTasksSharingSession(task) {
    if (!task.sessionId) return []
    return store
      .all()
      .filter((item) => item.id !== task.id && item.sessionId === task.sessionId && item.status !== 'archived')
  }

  // 归档/删除任务时，把它的执行会话也从侧边栏工作区列表里归档。
  async function archiveSessionOf(task) {
    if (!task.sessionId) return
    if (otherTasksSharingSession(task).length > 0) return
    const registry = ctx.get('workspaceRegistry')
    if (!registry || typeof registry.archiveSession !== 'function') return
    try {
      // stopActivity: 任务已成功/中断后其会话可能还在收尾，允许强制归档，避免残留。
      await registry.archiveSession(task.sessionId, { stopActivity: true })
    } catch (err) {
      console.warn('[kanban] 归档任务会话失败：', err && err.message)
    }
  }

  async function unarchiveSessionOf(sessionId) {
    if (!sessionId) return
    const registry = ctx.get('workspaceRegistry')
    if (!registry || typeof registry.unarchiveSession !== 'function') return
    try {
      await registry.unarchiveSession(sessionId)
    } catch (err) {
      console.warn('[kanban] 恢复任务会话失败：', err && err.message)
    }
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  // 从 ask_user_question 的参数里取一句问题摘要，给看板卡片用。
  function summarizeQuestions(rawArguments) {
    let parsed = rawArguments
    if (typeof parsed === 'string') {
      try {
        parsed = JSON.parse(parsed)
      } catch {
        parsed = null
      }
    }
    const questions = parsed && Array.isArray(parsed.questions) ? parsed.questions : []
    const first = questions.find((item) => item && typeof item.question === 'string' && item.question.trim())
    if (!first) return ''
    const text = String(first.question).replace(/\s+/g, ' ').trim()
    return text.length > 80 ? `${text.slice(0, 80)}…` : text
  }

  // 被动读取会话状态：只问"是不是在等用户输入"，不触发任何执行。
  // 会话可能刚结束或服务不可用，任何异常都当作"没有等待输入"。
  async function readSessionState(sessionId) {
    const controller = ctx.get('sessionController')
    if (!controller || typeof controller.state !== 'function' || !sessionId) return null
    const cached = sessionStateCache.get(sessionId)
    if (cached && Date.now() - cached.at < 1500) return cached.value
    let value = null
    try {
      value = await Promise.race([
        controller.state({ sessionId }, new AbortController().signal),
        sleep(1200).then(() => null),
      ])
    } catch (err) {
      value = null
    }
    sessionStateCache.set(sessionId, { at: Date.now(), value })
    return value
  }

  const PENDING_KINDS = ['question', 'approval', 'other']

  // 判断 running 任务是否停在"等用户回答/审批"。服务端 pendingInput 是权威来源，
  // 事件侧标记（tool/call 尚未返回）做兜底。
  async function waitingOf(task) {
    if (!task || !task.sessionId) return null
    if (task.status !== 'running' && task.status !== 'interrupted') return null
    const local = waitingBySession.get(task.sessionId)
    const state = await readSessionState(task.sessionId)
    const pending = state && Array.isArray(state.pendingInput) ? state.pendingInput : []
    const kind = PENDING_KINDS.find((item) => pending.includes(item))
    if (kind) return { waiting: kind, question: kind === 'approval' ? '' : (local && local.question) || '' }
    // 事件侧兜底只对 running 生效：已中断任务若只剩本地标记，多半是过期状态。
    if (task.status === 'running' && local) return { waiting: 'question', question: local.question || '' }
    return null
  }

  async function startTask(task) {
    if (!task || task.status !== 'planned' || starting.has(task.id)) return
    starting.add(task.id)
    try {
      const upstream = task.upstreamId ? store.get(task.upstreamId) : undefined
      let sessionId = upstream ? upstream.sessionId : undefined
      if (upstream && !sessionId) {
        transitionToInterrupted(task, '上游任务没有可用的执行会话')
        return
      }
      if (!sessionId) {
        const controller = ctx.get('sessionController')
        if (!controller) {
          transitionToInterrupted(task, 'sessionController 服务不可用')
          return
        }
        const created = await controller.create(task.workspaceId ? { workspaceId: task.workspaceId } : {})
        sessionId = created && created.sessionId
        if (!sessionId) {
          transitionToInterrupted(task, '创建执行会话失败')
          return
        }
        await applyPreset(sessionId, task.permissionPreset)
      } else {
        // 复用上游会话时，同时把它从侧边栏的归档状态恢复出来。
        await unarchiveSessionOf(sessionId)
      }
      task.sessionId = sessionId
      activeBySession.set(sessionId, task.id)
      waitingBySession.delete(sessionId)
      sessionStateCache.delete(sessionId)
      turnSteps.set(sessionId, 0)
      task.status = 'running'
      task.attempts = 1
      task.retryAt = null
      task.lastError = null
      task.lastReport = null
      task.interruptReason = null
      task.lastRunAt = Date.now()
      task.updatedAt = Date.now()
      await sendPrompt(task, buildStartPrompt(task))
    } finally {
      starting.delete(task.id)
    }
  }

  function onTurnEnd(task, reason) {
    if (!task || task.status !== 'running') return
    // 排队中的下一条 prompt 尚未开始，此时收到的 turn/end 属于上一条消息的回合。
    if (task.awaitingTurn) return
    const outcome = classifyTurnEnd(reason)
    if (outcome.action === 'ignore') return
    if (outcome.action === 'completed') {
      transitionToInterrupted(task, '模型结束了回合，但没有调用 kanban_report 上报结果')
      return
    }
    if (outcome.action === 'blocked') {
      // 被归档的会话会被内核在 pre-step 直接拒绝：整回合没有任何执行步骤。
      // 这种"阻塞"其实是会话被归档/删除，点立即继续没意义，提示用户恢复。
      const steps = task.sessionId ? turnSteps.get(task.sessionId) || 0 : 0
      transitionToInterrupted(
        task,
        steps === 0
          ? '执行会话被归档或已删除，回合无法开始。请到侧边栏「全部对话（显示已归档）」取消归档后点继续，点继续也会自动尝试取消归档。'
          : '等待你处理：回合阻塞，任务尚未完成',
      )
      return
    }
    if (outcome.action === 'abort') {
      transitionToInterrupted(
        task,
        outcome.abortReason === 'user' ? '被用户中止' : `回合被中止（${String(outcome.abortReason || 'unknown')}）`,
      )
      return
    }
    if (outcome.action === 'interrupt') {
      transitionToInterrupted(task, outcome.reason)
      return
    }
    if (outcome.action === 'error') {
      const failure = outcome.failure
      const info = failure && failure.info && typeof failure.info === 'object' ? failure.info : {}
      const code = String(info.code || (failure && failure.code) || 'error')
      const message = String((failure && failure.message) || info.message || '')
      if (isTransientError(failure) && task.attempts < MAX_ATTEMPTS) {
        const delay = nextRetryDelay(task.attempts, retryDelays)
        task.attempts += 1
        task.retryAt = Date.now() + delay
        task.lastError = { code, message, at: Date.now() }
        task.updatedAt = Date.now()
        store.put(task)
        console.warn(`[kanban] 任务「${task.title}」遇到瞬时错误，${delay}ms 后第 ${task.attempts} 次尝试`)
      } else {
        transitionToInterrupted(task, `执行出错：${code}${message ? ` — ${message}` : ''}`)
      }
    }
  }

  function onSessionEvent(session, event) {
    if (!session || !event || typeof event.type !== 'string') return
    const type = event.type
    const data = event.data || {}
    if (type === 'tool/call') {
      // 阻塞式提问会让回合一直不结束，先记下「这个会话在等用户回答」。
      if (data.name !== 'ask_user_question') return
      waitingBySession.set(session.id, {
        callId: data.callId ? String(data.callId) : '',
        question: summarizeQuestions(data.arguments),
        at: Date.now(),
      })
      return
    }
    if (type === 'step/start') {
      // 有了新步骤，说明上一次阻塞调用已经返回，等待标记应当失效。
      waitingBySession.delete(session.id)
      turnSteps.set(session.id, (turnSteps.get(session.id) || 0) + 1)
      return
    }
    if (type !== 'turn/start' && type !== 'turn/end') return
    const task = taskBySession(session.id)
    if (!task) return
    if (type === 'turn/start') {
      activeBySession.set(session.id, task.id)
      waitingBySession.delete(session.id)
      turnSteps.set(session.id, 0)
      task.awaitingTurn = false
      if (task.status === 'interrupted') {
        task.status = 'running'
        task.attempts = Math.max(1, task.attempts || 1)
        task.retryAt = null
        task.interruptReason = null
        task.updatedAt = Date.now()
        store.put(task)
      }
      return
    }
    waitingBySession.delete(session.id)
    onTurnEnd(task, data.reason)
  }

  async function tick() {
    await withLock(async () => {
      const now = Date.now()
      for (const task of store.all()) {
        if (task.status !== 'running' || !task.retryAt || task.retryAt > now) continue
        if (!task.sessionId) {
          transitionToInterrupted(task, '重试失败：任务没有执行会话')
          continue
        }
        task.retryAt = null
        try {
          await sendPrompt(task, buildRetryPrompt(task))
        } catch (err) {
          transitionToInterrupted(task, `重试发送失败：${err && err.message ? err.message : String(err)}`)
        }
      }
      const planned = store
        .all()
        .filter((task) => task.status === 'planned')
        .sort((a, b) => Date.parse(a.scheduledAt) - Date.parse(b.scheduledAt))
      for (const task of planned) {
        if (!task.scheduledAt || Date.parse(task.scheduledAt) > now) continue
        if (task.upstreamId) {
          const upstream = store.get(task.upstreamId)
          if (!upstream || upstream.status !== 'succeeded') continue
        }
        try {
          await startTask(task)
        } catch (err) {
          transitionToInterrupted(task, `启动失败：${err && err.message ? err.message : String(err)}`)
        }
      }
    })
  }

  function downstreamOf(taskId) {
    const result = []
    const queue = [taskId]
    const seen = new Set([taskId])
    while (queue.length > 0) {
      const current = queue.shift()
      for (const task of store.all()) {
        if (task.upstreamId !== current || seen.has(task.id)) continue
        seen.add(task.id)
        result.push(task)
        queue.push(task.id)
      }
    }
    return result
  }

  function requireTask(id) {
    const task = store.get(String(id || ''))
    if (!task) throw new KanbanError(404, '任务不存在')
    return task
  }

  function validateTask(input, editingId) {
    const data = input && typeof input === 'object' ? input : {}
    const title = String(data.title || '').trim()
    if (!title) throw new KanbanError(400, '任务名称不能为空')
    const instruction = String(data.instruction || '').trim()
    if (!instruction) throw new KanbanError(400, '任务内容不能为空')
    const rawScheduledAt = String(data.scheduledAt || '')
    const scheduledAt = Date.parse(rawScheduledAt)
    if (!rawScheduledAt || Number.isNaN(scheduledAt)) throw new KanbanError(400, '执行时间格式不正确')

    const upstreamId = data.upstreamId ? String(data.upstreamId) : null
    let workspaceId = data.workspaceId ? String(data.workspaceId) : ''
    let workspacePath = ''
    let workspaceTitle = ''

    if (upstreamId) {
      const upstream = store.get(upstreamId)
      if (!upstream) throw new KanbanError(400, '上游任务不存在')
      if (editingId && upstreamId === editingId) throw new KanbanError(400, '任务不能依赖自己')
      let cursor = upstream
      const seen = new Set()
      while (cursor) {
        if (editingId && cursor.id === editingId) throw new KanbanError(400, '上游依赖形成循环')
        if (seen.has(cursor.id)) break
        seen.add(cursor.id)
        cursor = cursor.upstreamId ? store.get(cursor.upstreamId) : undefined
      }
      workspaceId = upstream.workspaceId
      workspacePath = upstream.workspacePath
      workspaceTitle = upstream.workspaceTitle
    } else {
      if (!workspaceId) throw new KanbanError(400, '请选择工作区')
      const workspace = workspaceList.find((item) => item.id === workspaceId)
      if (!workspace) throw new KanbanError(400, '所选工作区不存在，请刷新后重试')
      workspacePath = workspace.path
      workspaceTitle = workspace.title
    }

    let permissionPreset = data.permissionPreset ? String(data.permissionPreset) : ''
    if (permissionPreset && presetList.length > 0 && !presetList.some((item) => item.name === permissionPreset)) {
      permissionPreset = presetDefault
    }
    if (!permissionPreset) permissionPreset = presetDefault

    return {
      title,
      instruction,
      scheduledAt: new Date(scheduledAt).toISOString(),
      upstreamId,
      workspaceId,
      workspacePath,
      workspaceTitle,
      permissionPreset,
    }
  }

  function createTaskEntity(fields) {
    const now = Date.now()
    return {
      id: randomUUID(),
      ...fields,
      sessionId: null,
      status: 'planned',
      awaitingTurn: false,
      attempts: 0,
      retryAt: null,
      lastError: null,
      lastReport: null,
      interruptReason: null,
      createdAt: now,
      updatedAt: now,
      lastRunAt: null,
      archivedAt: null,
    }
  }

  function publicTask(task) {
    return {
      id: task.id,
      title: task.title,
      instruction: task.instruction,
      workspaceId: task.workspaceId,
      workspaceTitle: task.workspaceTitle,
      workspacePath: task.workspacePath,
      upstreamId: task.upstreamId,
      sessionId: task.sessionId,
      status: task.status,
      scheduledAt: task.scheduledAt,
      permissionPreset: task.permissionPreset,
      attempts: task.attempts,
      retryAt: task.retryAt,
      lastError: task.lastError,
      lastReport: task.lastReport,
      interruptReason: task.interruptReason,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      lastRunAt: task.lastRunAt,
      archivedAt: task.archivedAt,
    }
  }

  async function serverState() {
    const titles = new Map(store.all().map((task) => [task.id, task.title]))
    const tasks = store.all().map((task) => ({
      ...publicTask(task),
      upstreamTitle: task.upstreamId ? titles.get(task.upstreamId) || '' : '',
    }))
    // running 任务可能只是停下来等用户回答/审批，不是"卡死"。这里被动查一次会话状态。
    // interrupted 任务也查：会话里可能还挂着没回答的问题，界面上要提示，避免用户点「继续」把提问作废。
    await Promise.all(
      tasks
        .filter((task) => task.status === 'running' || task.status === 'interrupted')
        .map(async (task) => {
          const waiting = await waitingOf(task)
          if (!waiting) return
          task.waiting = waiting.waiting
          if (waiting.question) task.waitingQuestion = waiting.question
        }),
    )
    tasks.sort((a, b) => {
      if (a.status === 'planned' && b.status === 'planned') {
        return Date.parse(a.scheduledAt) - Date.parse(b.scheduledAt)
      }
      return (b.updatedAt || 0) - (a.updatedAt || 0)
    })
    return {
      ok: true,
      serverNow: Date.now(),
      tasks,
      workspaces: workspaceList.slice(),
      presets: presetList.slice(),
      defaultPreset: presetDefault,
      retryDelaysMs: retryDelays.slice(),
      maxAttempts: MAX_ATTEMPTS,
      tickMs,
    }
  }

  function reportResult(sessionId, args) {
    const task = taskBySession(sessionId)
    if (!task) throw new Error('当前会话不是任务看板任务，无法上报结果')
    if (task.status !== 'running') throw new Error(`任务当前状态为 ${task.status}，不能重复上报`)
    const status = String((args && args.status) || '')
    if (!['success', 'failed', 'blocked'].includes(status)) {
      throw new Error('status 必须是 success / failed / blocked')
    }
    const summary = String((args && args.summary) || '').trim()
    task.lastReport = { status, summary, at: Date.now() }
    task.updatedAt = Date.now()
    if (status === 'success') {
      task.status = 'succeeded'
      task.retryAt = null
      task.interruptReason = null
    } else if (status === 'failed') {
      task.status = 'interrupted'
      task.interruptReason = `任务失败：${summary || '未说明原因'}`
    } else {
      task.status = 'interrupted'
      task.interruptReason = `等待人工：${summary || '需要补充信息'}`
    }
    store.put(task)
    if (task.status === 'succeeded') console.log(`[kanban] 任务「${task.title}」上报成功`)
    return { ok: true, taskId: task.id, status: task.status }
  }

  async function handleAction(body) {
    const action = body && typeof body.action === 'string' ? body.action : ''
    if (!action) throw new KanbanError(400, '缺少 action')

    if (action === 'create') {
      return withLock(async () => {
        await refreshWorkspaces()
        const fields = validateTask(body.task)
        const task = createTaskEntity(fields)
        store.put(task)
        return { ok: true, task: publicTask(task) }
      })
    }

    if (action === 'update') {
      return withLock(async () => {
        const task = requireTask(body.id)
        if (task.status !== 'planned') throw new KanbanError(409, '只有计划中的任务可以编辑')
        await refreshWorkspaces()
        // 编辑时允许只提交改动的字段：未提交的字段沿用任务当前值。
        const patch = body.task && typeof body.task === 'object' ? { ...body.task } : {}
        if (patch.upstreamId === undefined) patch.upstreamId = task.upstreamId
        if (patch.workspaceId === undefined) patch.workspaceId = task.workspaceId
        if (patch.permissionPreset === undefined) patch.permissionPreset = task.permissionPreset
        Object.assign(task, validateTask(patch, task.id), { updatedAt: Date.now() })
        store.put(task)
        return { ok: true, task: publicTask(task) }
      })
    }

    if (action === 'run') {
      return withLock(async () => {
        const task = requireTask(body.id)
        if (task.status !== 'planned') throw new KanbanError(409, '只有计划中的任务可以立即执行')
        if (task.upstreamId) {
          const upstream = store.get(task.upstreamId)
          if (!upstream || upstream.status !== 'succeeded') {
            throw new KanbanError(409, '上游任务还没有成功，暂时不能执行')
          }
        }
        await startTask(task)
        return { ok: true, task: publicTask(task) }
      })
    }

    if (action === 'continue') {
      return withLock(async () => {
        const task = requireTask(body.id)
        if (task.status !== 'interrupted') throw new KanbanError(409, '只有已中断的任务可以继续')
        if (!task.sessionId) throw new KanbanError(409, '任务没有执行会话，请删除后重建')
        // 会话里可能还挂着没回答的问题 / 没处理的审批：此时发继续提示词，回合边界会把提问作废，
        // 用户看到的就是「没回答，任务却结束了」。先拒绝，引导用户回答完再继续。
        sessionStateCache.delete(task.sessionId)
        const pendingState = await readSessionState(task.sessionId)
        const pendingKinds = pendingState && Array.isArray(pendingState.pendingInput) ? pendingState.pendingInput : []
        if (pendingKinds.includes('approval')) {
          throw new KanbanError(409, '任务还有一个没处理的审批请求，请先到对话里处理，处理完再点继续')
        }
        if (pendingKinds.includes('question')) {
          const localMarker = waitingBySession.get(task.sessionId)
          const question = localMarker && localMarker.question ? `「${localMarker.question}」` : ''
          throw new KanbanError(409, `任务还有一个没回答的问题${question}，请先在对话里回答，回答后再点继续`)
        }
        const reason = task.interruptReason || '未知原因'
        // 会话可能是用户从侧边栏删除/归档的：归档会拦截所有回合，先恢复再发提示词。
        // 对未归档的会话是幂等的（不会写入）。
        await unarchiveSessionOf(task.sessionId)
        waitingBySession.delete(task.sessionId)
        sessionStateCache.delete(task.sessionId)
        task.status = 'running'
        task.attempts = 1
        task.retryAt = null
        task.interruptReason = null
        task.lastError = null
        task.updatedAt = Date.now()
        activeBySession.set(task.sessionId, task.id)
        try {
          await sendPrompt(task, buildContinuePrompt(task, reason))
        } catch (err) {
          const message = String((err && err.message) || err || '未知错误')
          transitionToInterrupted(
            task,
            /not.?found|不存在|missing|unknown session/i.test(message)
              ? '执行会话已不存在（可能已被删除），请删除该任务后重建'
              : `发送继续提示词失败：${message}`,
          )
          return { ok: true, task: publicTask(task) }
        }
        return { ok: true, task: publicTask(task) }
      })
    }

    if (action === 'cancel') {
      return withLock(async () => {
        const task = requireTask(body.id)
        if (task.status !== 'running') throw new KanbanError(409, '只有执行中的任务可以取消')
        const controller = ctx.get('sessionController')
        if (controller && task.sessionId) {
          try {
            await controller.cancel({ sessionId: task.sessionId })
          } catch (err) {
            console.warn('[kanban] 取消会话失败：', err && err.message)
          }
        }
        transitionToInterrupted(task, '已取消')
        return { ok: true, task: publicTask(task) }
      })
    }

    if (action === 'archive') {
      return withLock(async () => {
        const task = requireTask(body.id)
        if (task.status !== 'succeeded' && task.status !== 'interrupted') {
          throw new KanbanError(409, '只有已成功或已中断的任务可以归档')
        }
        const blocking = downstreamOf(task.id).filter((item) => item.status !== 'archived')
        if (blocking.length > 0) {
          throw new KanbanError(409, `该任务还有 ${blocking.length} 个未归档的下游任务，请先处理下游任务`)
        }
        task.archivedFrom = task.status
        task.status = 'archived'
        task.archivedAt = Date.now()
        task.updatedAt = Date.now()
        store.put(task)
        await archiveSessionOf(task)
        return { ok: true, task: publicTask(task) }
      })
    }

    if (action === 'unarchive') {
      return withLock(async () => {
        const task = requireTask(body.id)
        if (task.status !== 'archived') throw new KanbanError(409, '只有已归档的任务可以撤销归档')
        task.status = task.archivedFrom === 'succeeded' || task.archivedFrom === 'interrupted' ? task.archivedFrom : 'interrupted'
        task.archivedAt = null
        task.archivedFrom = null
        task.updatedAt = Date.now()
        store.put(task)
        if (task.sessionId) await unarchiveSessionOf(task.sessionId)
        return { ok: true, task: publicTask(task) }
      })
    }

    if (action === 'delete') {
      return withLock(async () => {
        const task = requireTask(body.id)
        if (task.status === 'running') throw new KanbanError(409, '执行中的任务请先取消，再删除')
        const blocking = downstreamOf(task.id).filter((item) => item.status !== 'archived')
        if (blocking.length > 0) {
          throw new KanbanError(409, `该任务还有 ${blocking.length} 个未归档的下游任务，请先处理下游任务`)
        }
        store.remove(task.id)
        if (task.sessionId && activeBySession.get(task.sessionId) === task.id) activeBySession.delete(task.sessionId)
        // 任务被删除后，它的执行会话仍留在会话列表里；这里一并归档，避免侧边栏出现无主会话。
        await archiveSessionOf(task)
        return { ok: true }
      })
    }

    throw new KanbanError(400, `未知操作：${action}`)
  }

  const ready = (async () => {
    await store.load()
    const now = Date.now()
    for (const task of store.all()) {
      if (task.status === 'running') {
        task.status = 'interrupted'
        task.interruptReason = 'DSH 重启，任务执行被中断'
        task.retryAt = null
        task.updatedAt = now
        store.put(task)
      }
    }
    // 兼容旧数据：已归档的任务如果还留着未被归档的执行会话，补一次归档。
    for (const task of store.all()) {
      if (task.status === 'archived' && task.sessionId) await archiveSessionOf(task)
    }
    await refreshWorkspaces()
    await refreshPresets()
    await store.flush()
  })()

  // 路由
  ctx.effect(() =>
    web.register({
      kind: 'exact',
      path: STATE_PATH,
      resource: async (request) => {
        if (request.method !== 'GET' && request.method !== 'HEAD') {
          return json({ ok: false, error: '仅支持 GET' }, 405)
        }
        try {
          await ready
          return json(await serverState())
        } catch (err) {
          console.warn('[kanban] 读取状态失败：', err && err.message)
          return json({ ok: false, error: '读取看板状态失败' }, 500)
        }
      },
    }),
  )

  ctx.effect(() =>
    web.register({
      kind: 'exact',
      path: ACTION_PATH,
      handler: async (req, res) => {
        const method = (req.method || 'GET').toUpperCase()
        if (method !== 'POST') {
          res.writeHead(405, { allow: 'POST' })
          res.end('Method Not Allowed')
          return
        }
        let body
        try {
          body = JSON.parse(await readBody(req))
        } catch (err) {
          const tooLarge = err && err.message === 'payload too large'
          sendJson(res, { ok: false, error: tooLarge ? '请求体过大' : '请求体不是合法 JSON' }, false, tooLarge ? 413 : 400)
          return
        }
        try {
          await ready
          sendJson(res, await handleAction(body))
        } catch (err) {
          if (err instanceof KanbanError) {
            sendJson(res, { ok: false, error: err.message }, false, err.status)
            return
          }
          console.warn('[kanban] 操作失败：', err)
          sendJson(res, { ok: false, error: err && err.message ? err.message : String(err) }, false, 500)
        }
      },
    }),
  )

  // 会话事件：用户手动继续时把任务拉回执行中；回合结束时推进状态机
  ctx.effect(() => {
    const off = ctx.on('session/event', onSessionEvent)
    return () => {
      try {
        off()
      } catch {}
    }
  })

  // 收尾上报工具
  ctx.effect(() => {
    const tools = ctx.get('tools')
    if (!tools) {
      console.warn('[kanban] tools 服务不可用，未注册 kanban_report')
      return () => {}
    }
    const dispose = tools.register(
      {
        name: 'kanban_report',
        description:
          '任务看板任务的收尾上报工具。任务完成、失败或需要用户补充信息时调用，向看板报告状态与一句话结论。仅任务看板创建的执行会话可用。',
        parameters: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              enum: ['success', 'failed', 'blocked'],
              description: 'success=任务完成；failed=确认失败；blocked=需要用户补充信息或做选择才能继续',
            },
            summary: { type: 'string', description: '一句话结果说明' },
          },
          required: ['status', 'summary'],
          additionalProperties: false,
        },
        output: {
          schema: {
            type: 'object',
            properties: {
              ok: { type: 'boolean' },
              taskId: { type: 'string' },
              status: { type: 'string' },
            },
          },
          render: (args, value) => [
            {
              type: 'text',
              text: value && value.ok ? `已上报任务结果：${value.status}` : '上报失败',
            },
          ],
        },
        async execute(args, exec) {
          const sessionId = exec && exec.agent && exec.agent.id
          return reportResult(sessionId, args)
        },
      },
      {
        when: (context) => Boolean(context && context.agent && context.agent.id && taskBySession(context.agent.id)),
      },
    )
    return () => {
      try {
        dispose()
      } catch {}
    }
  })

  // 调度循环
  ctx.effect(() => {
    let timer = null
    let stopped = false
    ready.then(() => {
      if (stopped) return
      tick().catch((err) => console.warn('[kanban] tick 失败：', err && err.message))
      timer = setInterval(() => {
        tick().catch((err) => console.warn('[kanban] tick 失败：', err && err.message))
      }, tickMs)
    })
    return () => {
      stopped = true
      if (timer) clearInterval(timer)
      store.dispose().catch(() => {})
    }
  })
}

export default { name, inject, apply }

export { STATUSES }
