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
const sandbox = {
  window: {
    __ModuleLoader__: {
      load(entry) {
        loadedEntry = entry
      },
    },
  },
  fetch: async () => ({ ok: true, json: async () => ({ ok: true, tasks: [], workspaces: [], presets: [], defaultPreset: '' }) }),
  setInterval: () => 0,
  clearInterval: () => {},
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
const clientCtx = {
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
for (const key of ['sidebar.label', 'page.title', 'action.new', 'status.planned', 'dialog.create', 'confirm.delete.message']) {
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

const styleNode = pageTree.children.find((child) => child && child.type === 'style')
assert.ok(styleNode, '看板应注入样式')
assert.ok(styleNode.props.dangerouslySetInnerHTML.__html.includes('.skb-board'))

const header = pageTree.children.find((child) => child && child.props && child.props.className === 'skb-header')
assert.ok(header, '看板应有头部')

console.log('smoke-client.mjs: OK')
