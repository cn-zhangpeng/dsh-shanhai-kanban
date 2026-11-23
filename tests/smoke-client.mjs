/**
 * Client 半区冒烟测试：bundle 装载、locale、侧边栏与主面板注册、组件渲染。
 *
 * 运行：node tests/smoke-client.mjs
 */

import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const source = await readFile(new URL('../client.js', import.meta.url), 'utf8')

const reactMock = {
  createElement(type, props, ...children) {
    return { type, props: props || {}, children: children.flat() }
  },
  useState(initial) {
    return [typeof initial === 'function' ? initial() : initial, () => {}]
  },
  useEffect() {},
  useRef(value) {
    return { current: value }
  },
  useCallback(fn) {
    return fn
  },
}

let loadedEntry = null
const injectedStyles = []
const fakeDocument = {
  head: {
    appendChild(node) {
      node.parentNode = fakeDocument.head
      injectedStyles.push(node)
    },
    removeChild(node) {
      const index = injectedStyles.indexOf(node)
      if (index >= 0) injectedStyles.splice(index, 1)
      node.parentNode = null
    },
  },
  getElementById(id) {
    return injectedStyles.find((node) => node.id === id) || null
  },
  createElement(tag) {
    return { tag, id: '', textContent: '', parentNode: null }
  },
}
const sandbox = {
  window: {
    __ModuleLoader__: {
      load(entry) {
        loadedEntry = entry
      },
    },
  },
  document: fakeDocument,
  fetch: async () => ({ ok: true, json: async () => ({ ok: true, tasks: [], workspaces: [], presets: [], defaultPreset: '' }) }),
  setInterval: () => 0,
  clearInterval: () => {},
  setTimeout: () => 0,
  clearTimeout: () => {},
  console,
}
sandbox.globalThis = sandbox

await import('node:vm').then(({ default: vm }) => {
  vm.runInNewContext(source, sandbox)
})

assert.ok(loadedEntry, 'client.js 应通过 __ModuleLoader__.load 注册 bundle')
assert.equal(loadedEntry.id, 'dsh-shanhai-kanban')

const module = loadedEntry.factory((name) => {
  if (name === 'react') return reactMock
  throw new Error(`unexpected require: ${name}`)
})

assert.equal(module.inject.join(','), 'slots,locale', 'inject 应包含 slots 与 locale')
assert.equal(typeof module.apply, 'function')

const localeMessages = {}
const slotRegistrations = []
const openedSessions = []
const uiWorkspace = {
  openSession(sessionId) {
    openedSessions.push(sessionId)
  },
}
const clientCtx = {
  get(name) {
    return name === 'uiWorkspace' ? uiWorkspace : undefined
  },
  effect(fn) {
    const dispose = fn()
    return typeof dispose === 'function' ? dispose : () => {}
  },
  locale: {
    register(namespace, messages) {
      localeMessages[namespace] = messages
    },
    bind(namespace) {
      return (key) => {
        const messages = localeMessages[namespace] || {}
        const table = messages.zh || {}
        return table[key] || key
      }
    },
  },
  slots: {
    inject(ownerKey, register) {
      return register()
    },
    register(definition, component) {
      slotRegistrations.push({ definition, component })
      return () => {}
    },
  },
}

module.apply(clientCtx)

assert.ok(localeMessages['dsh-shanhai-kanban'], '应注册 locale 命名空间')
const zh = localeMessages['dsh-shanhai-kanban'].zh
const en = localeMessages['dsh-shanhai-kanban'].en
for (const key of [
  'sidebar.label',
  'page.title',
  'action.new',
  'status.planned',
  'dialog.create',
  'confirm.delete.message',
  'field.acceptance',
  'card.acceptance',
  'card.inferred',
  'dock.title',
  'toast.acknowledged',
  'action.open_session',
  'toast.session_missing',
  'toast.session_unavailable',
]) {
  assert.ok(zh[key], `zh 缺少词条：${key}`)
  assert.ok(en[key], `en 缺少词条：${key}`)
}

const sidebar = slotRegistrations.find((item) => item.definition.name === 'sidebar.panellist')
assert.ok(sidebar, '应注册 sidebar.panellist')
assert.equal(sidebar.definition.id, 'kanban')
assert.equal(sidebar.definition.order, 20)
assert.equal(sidebar.definition.label(), '任务看板')

const iconVNode = sidebar.component({ size: 18, active: true })
assert.equal(iconVNode.type.name, 'KanbanIcon')
const iconTree = iconVNode.type(iconVNode.props)
assert.equal(iconTree.type, 'svg')
assert.equal(iconTree.props.width, 18)

const main = slotRegistrations.find((item) => item.definition.name === 'main')
assert.ok(main, '应注册 main 面板')
assert.equal(main.definition.key, 'kanban')

const pageElement = main.component()
assert.equal(pageElement.type.name, 'KanbanPage')
const pageTree = pageElement.type(pageElement.props)
assert.equal(pageTree.type, 'div')
assert.ok(pageTree.props.className.includes('skb-page'))

const toastOverlay = slotRegistrations.find((item) => item.definition.name === 'shell.overlay')
assert.ok(toastOverlay, '应注册 shell.overlay 通知层')
assert.equal(toastOverlay.definition.id, 'shanhai-kanban-toasts')
const toastVNode = toastOverlay.component()
assert.equal(toastVNode.type.name, 'ToastHost')
assert.equal(toastVNode.type(toastVNode.props), null, '通知队列为空时不应渲染内容')

const dockCard = slotRegistrations.find((item) => item.definition.name === 'conversation.input.dock')
assert.ok(dockCard, '应注册会话输入框上方的待确认卡片')
assert.equal(dockCard.definition.id, 'shanhai-kanban-confirm')
assert.equal(dockCard.definition.order, 30)
const dockBind = clientCtx.locale.bind('dsh-shanhai-kanban')
const dockVNode = dockCard.component({ sessionId: 'sess-1', t: dockBind })
assert.equal(dockVNode.type.name, 'SessionDockCard')
assert.equal(dockVNode.type(dockVNode.props), null, '没有待确认任务时不渲染卡片')
assert.equal(dockCard.component({ t: dockBind }).type({ sessionId: undefined, t: dockBind }), null, '没有会话上下文时不渲染卡片')

const pageStyle = injectedStyles.find((node) => node.id === 'shanhai-kanban-styles')
assert.ok(pageStyle, '插件装载时应注入样式')
assert.ok(pageStyle.textContent.includes('.skb-board'), '样式应包含看板布局')
assert.ok(pageStyle.textContent.includes('.skb-dock'), '样式应包含会话卡片')
assert.equal(injectedStyles.length, 1, '重复装载时不应重复插入样式')

const header = pageTree.children.find((child) => child && child.props && child.props.className === 'skb-header')
assert.ok(header, '看板应有头部')

// ---------- 进入会话 ----------
function walk(node, visit) {
  if (!node || typeof node !== 'object') return
  visit(node)
  for (const child of node.children || []) walk(child, visit)
}

assert.equal(typeof pageElement.props.onOpenSession, 'function', '看板应收到会话跳转回调')
const cardData = { tasks: [], workspaces: [], presets: [], defaultPreset: '', serverNow: Date.now() }
const cardProps = {
  task: { id: 't1', title: '演示任务', instruction: '', status: 'succeeded', sessionId: 'sess-42', scheduledAt: '2026-01-01T00:00:00.000Z', runs: [], needsConfirm: false },
  t: dockBind,
  data: cardData,
  busy: false,
  onAction() {},
  onEdit() {},
  onAskArchive() {},
  onAskDelete() {},
  onAck() {},
  onOpenSession: pageElement.props.onOpenSession,
}
const cardTree = module.TaskCard(cardProps)
const openButtons = []
walk(cardTree, (node) => {
  if (node.type === 'button' && node.children.includes('进入会话')) openButtons.push(node)
})
assert.equal(openButtons.length, 1, '有会话的任务卡片应显示「进入会话」按钮')
openButtons[0].props.onClick()
assert.deepEqual(openedSessions, ['sess-42'], '点击后应把会话 id 交给 uiWorkspace.openSession')

const noSessionTree = module.TaskCard({ ...cardProps, task: { ...cardProps.task, sessionId: null } })
let noSessionButtons = 0
walk(noSessionTree, (node) => {
  if (node.type === 'button' && node.children.includes('进入会话')) noSessionButtons += 1
})
assert.equal(noSessionButtons, 0, '没有会话的任务不应显示「进入会话」按钮')

pageElement.props.onOpenSession(undefined)
assert.deepEqual(openedSessions, ['sess-42'], '缺少会话 id 时不应跳转')

console.log('smoke-client.mjs: OK')
