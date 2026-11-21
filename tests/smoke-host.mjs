/**
 * Host 半区冒烟测试：任务状态机、调度、重试、上报工具、HTTP 接口、落盘。
 *
 * 运行：node tests/smoke-host.mjs
 */

import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

const tempHome = await mkdtemp(path.join(os.tmpdir(), 'kanban-smoke-'))
process.env.DSH_HOME = tempHome
process.env.DSH_KANBAN_TICK_MS = '300'
const promptText = (request) => (request.content || []).map((part) => part.text || '').join('')
process.env.DSH_KANBAN_RETRY_DELAYS = '400,500,600'

const mod = await import('../index.js')
const {
  apply,
  classifyTurnEnd,
  isTransientError,
  nextRetryDelay,
  resolveDshHome,
  tasksFile,
  STATE_PATH,
  ACTION_PATH,
} = mod

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function waitFor(probe, description, timeoutMs = 6000) {
  const started = Date.now()
  for (;;) {
    const value = await probe()
    if (value) return value
    if (Date.now() - started > timeoutMs) throw new Error(`等待超时：${description}`)
    await sleep(50)
  }
}

// ---------- 纯函数 ----------

assert.equal(resolveDshHome({}, '/home/demo'), path.join('/home/demo', '.dsh'))
assert.equal(resolveDshHome({ DSH_HOME: '~/custom' }, '/home/demo'), path.join('/home/demo', 'custom'))
assert.equal(resolveDshHome({ DSH_HOME: 'E:/dsh-home' }, '/home/demo'), 'E:/dsh-home')

assert.deepEqual(classifyTurnEnd({ kind: 'completed' }), { action: 'completed' })
assert.deepEqual(classifyTurnEnd({ kind: 'blocked' }), { action: 'blocked' })
assert.equal(classifyTurnEnd({ kind: 'error', failure: { message: 'boom' } }).action, 'error')
assert.equal(classifyTurnEnd({ kind: 'aborted', aborted: { reason: 'user' } }).abortReason, 'user')
assert.equal(classifyTurnEnd({ kind: 'max-tokens' }).action, 'interrupt')
assert.equal(classifyTurnEnd({ kind: 'forked' }).action, 'ignore')

assert.equal(isTransientError({ info: { code: 'rate_limit_exceeded' } }), true)
assert.equal(isTransientError({ message: 'Your request timed out' }), true)
assert.equal(isTransientError({ info: { status: 503 } }), true)
assert.equal(isTransientError({ info: { code: 'invalid_request' }, message: '参数错误' }), false)
assert.equal(nextRetryDelay(1), 30_000)
assert.equal(nextRetryDelay(2), 120_000)
assert.equal(nextRetryDelay(3), 300_000)
assert.equal(nextRetryDelay(3, [10, 20]), 20)

// ---------- 假 ctx ----------

let sessionSeq = 0
const sessions = new Map()
const calls = { created: [], prompts: [], presets: [], cancelled: [], archivedSessions: [], unarchivedSessions: [] }
const listeners = new Map()
const routes = new Map()
const toolRegistrations = []
const disposers = []

function emit(event, ...args) {
  for (const handler of listeners.get(event) || []) handler(...args)
}

const webServer = {
  register(route) {
    routes.set(route.path, route)
    return () => routes.delete(route.path)
  },
}

const sessionController = {
  async create(request) {
    const sessionId = `sess-${++sessionSeq}`
    sessions.set(sessionId, { id: sessionId })
    calls.created.push(request || {})
    return { sessionId }
  },
  async prompt(request, signal) {
    assert.ok(request && request.sessionId, 'prompt 需要 sessionId')
    assert.ok(Array.isArray(request.content) && request.content.length > 0, 'prompt 的 content 应为内容块数组')
    assert.equal(request.content[0].type, 'text', 'prompt 第一个内容块应为 text')
    assert.ok(typeof request.content[0].text === 'string' && request.content[0].text.length > 0)
    assert.ok(signal && typeof signal.throwIfAborted === 'function', 'prompt 需要传入 AbortSignal')
    calls.prompts.push(request)
    return { accepted: true }
  },
  async cancel(request) {
    calls.cancelled.push(request)
    return { ok: true }
  },
}

const permissionPresets = {
  async catalog() {
    return {
      options: [
        { name: 'auto', description: '自动' },
        { name: 'full', description: '完全权限' },
      ],
      defaultPreset: 'full',
    }
  },
  async set(session, name) {
    calls.presets.push({ session: session.id, name })
  },
}

const workspaceRegistry = {
  async list() {
    return [{ id: 'ws-1', title: 'Demo 工作区', path: 'E:/demo' }]
  },
  async archiveSession(sessionId) {
    calls.archivedSessions.push(String(sessionId))
  },
  async unarchiveSession(sessionId) {
    calls.unarchivedSessions.push(String(sessionId))
  },
}

const tools = {
  register(definition, options) {
    toolRegistrations.push({ definition, options })
    return () => {}
  },
}

const ctx = {
  get(key) {
    return { webServer, sessionController, sessions, permissionPresets, workspaceRegistry, tools }[key]
  },
  on(event, handler) {
    const list = listeners.get(event) || []
    list.push(handler)
    listeners.set(event, list)
    return () => {
      listeners.set(
        event,
        (listeners.get(event) || []).filter((item) => item !== handler),
      )
    }
  },
  effect(fn) {
    const dispose = fn()
    if (typeof dispose === 'function') disposers.push(dispose)
    return dispose
  },
}

apply(ctx)
assert.ok(routes.has(STATE_PATH), '应注册状态接口')
assert.ok(routes.has(ACTION_PATH), '应注册操作接口')

async function callRoute(routePath, { method = 'GET', body = '', headers = {} } = {}) {
  const route = routes.get(routePath)
  if (!route) throw new Error(`route not registered: ${routePath}`)
  if (route.resource) {
    const response = await route.resource(
      new Request('http://local' + routePath, {
        method,
        headers,
        body: body === '' || method === 'GET' || method === 'HEAD' ? undefined : body,
      }),
    )
    const text = await response.text()
    return { status: response.status, text, json: () => Promise.resolve(JSON.parse(text)) }
  }
  const req = new EventEmitter()
  req.method = method
  req.headers = headers
  let resolveDone
  const done = new Promise((resolve) => {
    resolveDone = resolve
  })
  const res = {
    statusCode: 200,
    headers: {},
    body: '',
    writeHead(status, nextHeaders) {
      this.statusCode = status
      Object.assign(this.headers, nextHeaders || {})
    },
    end(chunk) {
      if (chunk !== undefined && chunk !== null) this.body += String(chunk)
      resolveDone()
    },
  }
  Promise.resolve(route.handler(req, res)).catch((err) => {
    res.handlerError = err
    resolveDone()
  })
  setImmediate(() => {
    if (body) req.emit('data', Buffer.from(body))
    req.emit('end')
  })
  await done
  if (res.handlerError) throw res.handlerError
  return { status: res.statusCode, text: res.body, json: () => Promise.resolve(JSON.parse(res.body)) }
}

async function getState() {
  const response = await callRoute(STATE_PATH)
  const body = await response.json()
  assert.equal(response.status, 200)
  assert.equal(body.ok, true)
  return body
}

async function action(payload) {
  const response = await callRoute(ACTION_PATH, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return { status: response.status, body: await response.json() }
}

function findTask(state, id) {
  return state.tasks.find((task) => task.id === id)
}

// ---------- 接口基础 ----------

const initial = await getState()
assert.deepEqual(initial.tasks, [])
assert.equal(initial.workspaces.length, 1)
assert.equal(initial.workspaces[0].title, 'Demo 工作区')
assert.equal(initial.defaultPreset, 'full')
assert.equal(initial.maxAttempts, 3)

const wrongMethod = await callRoute(STATE_PATH, { method: 'POST' })
assert.equal(wrongMethod.status, 405)
const badJson = await callRoute(ACTION_PATH, { method: 'POST', body: '{oops' })
assert.equal(badJson.status, 400)
assert.equal((await action({ action: 'nope' })).status, 400)
assert.equal((await action({ action: 'delete', id: 'missing' })).status, 404)
assert.equal((await action({ action: 'create', task: { instruction: 'x', workspaceId: 'ws-1' } })).status, 400)

// ---------- 创建 + 定时启动 ----------

const createdA = await action({
  action: 'create',
  task: {
    title: '任务 A',
    instruction: 'A 的任务说明',
    workspaceId: 'ws-1',
    scheduledAt: new Date(Date.now() - 1000).toISOString(),
    permissionPreset: 'full',
  },
})
assert.equal(createdA.status, 200)
assert.equal(createdA.body.task.status, 'planned')
assert.equal(createdA.body.task.workspaceTitle, 'Demo 工作区')
const taskAId = createdA.body.task.id

const runningA = await waitFor(async () => {
  const task = findTask(await getState(), taskAId)
  return task && task.status === 'running' ? task : null
}, '任务 A 到点自动启动')

assert.equal(runningA.sessionId, 'sess-1')
assert.equal(calls.created[0].workspaceId, 'ws-1')
assert.deepEqual(calls.presets[0], { session: 'sess-1', name: 'full' })
assert.ok(promptText(calls.prompts[0]).includes('kanban_report'), '启动提示词应要求调用 kanban_report')
assert.ok(promptText(calls.prompts[0]).includes('A 的任务说明'), '启动提示词应包含任务内容')
assert.equal(calls.prompts[0].mode, 'queue')

const tool = toolRegistrations.find((item) => item.definition.name === 'kanban_report')
assert.ok(tool, '应注册 kanban_report 工具')
assert.equal(tool.definition.parameters.required.includes('status'), true)
assert.equal(tool.options.when({ agent: { id: 'sess-1' } }), true)
assert.equal(tool.options.when({ agent: { id: 'other-session' } }), false)
assert.equal(tool.options.when({}), false)

// ---------- 瞬时错误自动重试 ----------

emit('session/event', { id: 'sess-1' }, { type: 'turn/start' })
emit('session/event', { id: 'sess-1' }, { type: 'turn/end', data: { reason: { kind: 'error', failure: { message: '429 rate limit exceeded' } } } })
await waitFor(async () => {
  const task = findTask(await getState(), taskAId)
  return task && task.attempts === 2 && task.retryAt ? task : null
}, '任务 A 第一次瞬时错误后进入重试')
await waitFor(() => calls.prompts.length >= 2, '发送第一次重试提示词')
assert.ok(promptText(calls.prompts[1]).includes('临时错误'), '重试提示词应说明临时错误')

emit('session/event', { id: 'sess-1' }, { type: 'turn/start' })
emit('session/event', { id: 'sess-1' }, { type: 'turn/end', data: { reason: { kind: 'error', failure: { info: { code: 'overloaded' } } } } })
await waitFor(async () => {
  const task = findTask(await getState(), taskAId)
  return task && task.attempts === 3 && task.retryAt ? task : null
}, '任务 A 第二次瞬时错误后进入第三次尝试')
await waitFor(() => calls.prompts.length >= 3, '发送第二次重试提示词')

emit('session/event', { id: 'sess-1' }, { type: 'turn/start' })
emit('session/event', { id: 'sess-1' }, { type: 'turn/end', data: { reason: { kind: 'error', failure: { message: '429 rate limit exceeded' } } } })
const interruptedA = await waitFor(async () => {
  const task = findTask(await getState(), taskAId)
  return task && task.status === 'interrupted' ? task : null
}, '第三次失败后转为已中断')
assert.ok(interruptedA.interruptReason.includes('执行出错'), '中断原因应说明执行出错')

// ---------- 继续 ----------

const continued = await action({ action: 'continue', id: taskAId })
assert.equal(continued.status, 200)
assert.equal(continued.body.task.status, 'running')
await waitFor(() => calls.prompts.length >= 4, '发送继续提示词')
assert.ok(promptText(calls.prompts[3]).includes('上一次执行被中断'), '继续提示词应说明中断')
assert.ok(promptText(calls.prompts[3]).includes('不要重复已经完成的工作'))

// ---------- 上报成功 ----------

const successResult = await tool.definition.execute({ status: 'success', summary: 'A 已完成' }, { agent: { id: 'sess-1' } })
assert.deepEqual(successResult, { ok: true, taskId: taskAId, status: 'succeeded' })
const succeededA = findTask(await getState(), taskAId)
assert.equal(succeededA.status, 'succeeded')
assert.equal(succeededA.lastReport.summary, 'A 已完成')

let duplicateError = null
try {
  await tool.definition.execute({ status: 'success', summary: '重复上报' }, { agent: { id: 'sess-1' } })
} catch (err) {
  duplicateError = err
}
assert.ok(duplicateError, '重复上报应报错')

let foreignError = null
try {
  await tool.definition.execute({ status: 'success', summary: '外部会话' }, { agent: { id: 'no-such-session' } })
} catch (err) {
  foreignError = err
}
assert.ok(foreignError, '非任务会话调用上报应报错')

// ---------- 上游依赖：同一会话串行 ----------

const createdB = await action({
  action: 'create',
  task: {
    title: '任务 B',
    instruction: 'B 的任务说明',
    upstreamId: taskAId,
    workspaceId: 'ignored-when-upstream',
    scheduledAt: new Date(Date.now() - 1000).toISOString(),
  },
})
assert.equal(createdB.status, 200)
assert.equal(createdB.body.task.workspaceId, 'ws-1')
assert.equal(createdB.body.task.workspaceTitle, 'Demo 工作区')
const taskBId = createdB.body.task.id

const runningB = await waitFor(async () => {
  const task = findTask(await getState(), taskBId)
  return task && task.status === 'running' ? task : null
}, '上游成功后任务 B 启动')
assert.equal(runningB.sessionId, 'sess-1', '任务 B 应复用上游会话')
assert.equal(calls.created.length, 1, '任务 B 不应新建会话')
assert.ok(promptText(calls.prompts[calls.prompts.length - 1]).includes('B 的任务说明'))
assert.ok(calls.unarchivedSessions.includes('sess-1'), '复用上游会话时应把它从归档状态恢复')

// ---------- 上报失败 → 用户在会话里回复 → 回到执行中 ----------

await tool.definition.execute({ status: 'failed', summary: 'B 失败了' }, { agent: { id: 'sess-1' } })
let failedB = findTask(await getState(), taskBId)
assert.equal(failedB.status, 'interrupted')
assert.ok(failedB.interruptReason.includes('B 失败了'))

emit('session/event', { id: 'sess-1' }, { type: 'turn/start' })
failedB = findTask(await getState(), taskBId)
assert.equal(failedB.status, 'running', '用户回复后应回到执行中')
assert.equal(failedB.attempts, 1)

await tool.definition.execute({ status: 'success', summary: 'B 已完成' }, { agent: { id: 'sess-1' } })

// ---------- 归档 / 删除 ----------

assert.equal((await action({ action: 'archive', id: taskBId })).body.task.status, 'archived')
assert.equal(calls.archivedSessions.length, 0, '同一会话仍被任务 A 使用时不应归档会话')
assert.equal((await action({ action: 'archive', id: taskAId })).body.task.status, 'archived')
assert.deepEqual(calls.archivedSessions, ['sess-1'], '归档最后一个使用该会话的任务时应归档会话')

// ---------- 撤销归档：恢复任务状态与执行会话 ----------

const restoredA = await action({ action: 'unarchive', id: taskAId })
assert.equal(restoredA.status, 200)
assert.equal(restoredA.body.task.status, 'succeeded', '撤销归档应恢复归档前的状态')
assert.equal((await action({ action: 'unarchive', id: taskBId })).body.task.status, 'succeeded', '撤销归档应恢复成功状态')
assert.ok(calls.unarchivedSessions.filter((id) => id === 'sess-1').length >= 3, '撤销归档应恢复执行会话')

// 重新归档，再验证删除顺序
await action({ action: 'archive', id: taskBId })
await action({ action: 'archive', id: taskAId })
assert.equal((await action({ action: 'delete', id: taskAId })).status, 200)
assert.equal((await action({ action: 'delete', id: taskBId })).status, 200)

// ---------- 取消执行中任务 ----------

const createdC = await action({
  action: 'create',
  task: {
    title: '任务 C',
    instruction: 'C 的任务说明',
    workspaceId: 'ws-1',
    scheduledAt: new Date(Date.now() - 1000).toISOString(),
  },
})
const taskCId = createdC.body.task.id
await waitFor(async () => {
  const task = findTask(await getState(), taskCId)
  return task && task.status === 'running' ? task : null
}, '任务 C 启动')

const cancelled = await action({ action: 'cancel', id: taskCId })
assert.equal(cancelled.status, 200)
assert.equal(cancelled.body.task.status, 'interrupted')
assert.ok(cancelled.body.task.interruptReason.includes('取消'))
assert.equal(calls.cancelled.length, 1)
assert.equal(calls.cancelled[0].sessionId, cancelled.body.task.sessionId)

// ---------- 下游阻断 ----------

const createdD = await action({
  action: 'create',
  task: {
    title: '任务 D',
    instruction: 'D 的任务说明',
    workspaceId: 'ws-1',
    scheduledAt: new Date(Date.now() + 3600_000).toISOString(),
  },
})
const taskDId = createdD.body.task.id
const updatedD = await action({ action: 'update', id: taskDId, task: { ...createdD.body.task, title: '任务 D 改名' } })
assert.equal(updatedD.status, 200)
assert.equal(updatedD.body.task.title, '任务 D 改名')

const createdE = await action({
  action: 'create',
  task: {
    title: '任务 E',
    instruction: 'E 的任务说明',
    upstreamId: taskDId,
    scheduledAt: new Date(Date.now() + 3600_000).toISOString(),
  },
})
const taskEId = createdE.body.task.id

const blockedDelete = await action({ action: 'delete', id: taskDId })
assert.equal(blockedDelete.status, 409, '有未归档下游时不能删除上游')
assert.ok(blockedDelete.body.error.includes('下游'))
assert.equal((await action({ action: 'delete', id: taskEId })).status, 200)
assert.equal((await action({ action: 'delete', id: taskDId })).status, 200)

// ---------- 计划中任务不可继续、执行中任务不可编辑 ----------

const runningC2 = findTask(await getState(), taskCId)
assert.equal(runningC2.status, 'interrupted')
assert.equal((await action({ action: 'continue', id: taskCId })).status, 200)

await waitFor(async () => {
  const task = findTask(await getState(), taskCId)
  return task && task.status === 'running' ? task : null
}, '任务 C 继续后回到执行中')
const editRunning = await action({ action: 'update', id: taskCId, task: { title: 'x', instruction: 'y', workspaceId: 'ws-1', scheduledAt: new Date().toISOString() } })
assert.equal(editRunning.status, 409, '执行中任务不可编辑')

assert.equal((await action({ action: 'cancel', id: taskCId })).status, 200)
await action({ action: 'delete', id: taskCId })

// ---------- 落盘 ----------

for (const dispose of disposers.reverse()) {
  try {
    dispose()
  } catch {}
}
await sleep(300)

const raw = await readFile(tasksFile(), 'utf8')
const parsed = JSON.parse(raw)
assert.equal(parsed.version, 1)
assert.deepEqual(parsed.tasks, [], '删除全部任务后文件应为空')

await rm(tempHome, { recursive: true, force: true })
console.log('smoke-host.mjs: OK')
process.exit(0)
