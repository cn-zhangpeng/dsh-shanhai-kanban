/**
 * 山海任务看板 —— Client 半区。
 *
 * - sidebar.panellist：侧边栏「任务看板」入口（id 同时作为 main 面板 key）
 * - main：看板整页（任务列表 / 新建 / 编辑 / 立即执行 / 继续 / 取消 / 归档 / 删除）
 *
 * 数据来自 Host 半区的 /api/shanhai-kanban/*，页面每 2s 轮询一次。
 */

window.__ModuleLoader__.load({
  id: 'dsh-shanhai-kanban',
  factory: (require) => {
    var module = { exports: {} }
    const React = require('react')
    const h = React.createElement

    const NS = 'dsh-shanhai-kanban'
    const SLOT_ID = 'kanban'
    const STATE_URL = '/api/shanhai-kanban/state'
    const ACTION_URL = '/api/shanhai-kanban/action'

    const zh = {
      'sidebar.label': '任务看板',
      'page.title': '任务看板',
      'page.subtitle': '提前建任务，到点自动执行；可指定工作区与上游任务，中断后还能继续。',
      'action.new': '新建任务',
      'action.refresh': '刷新',
      'action.edit': '编辑',
      'action.run': '立即执行',
      'action.continue': '继续',
      'action.cancel': '取消',
      'action.archive': '归档',
      'action.delete': '删除',
      'action.save': '保存',
      'action.submitting': '提交中…',
      'tab.all': '全部',
      'tab.archived': '已归档',
      'status.planned': '计划中',
      'status.running': '执行中',
      'status.interrupted': '已中断',
      'status.succeeded': '已成功',
      'status.archived': '已归档',
      'col.planned': '计划中',
      'col.running': '执行中',
      'col.interrupted': '已中断',
      'col.succeeded': '已成功',
      'col.empty': '暂无任务',
      'count.tasks': '个任务',
      'error.load': '读取看板失败',
      'error.action': '操作失败',
      'card.workspace': '工作区',
      'card.upstream': '上游',
      'card.time': '执行时间',
      'card.attempts': '尝试',
      'card.report': '上报',
      'card.running_since': '最近开始',
      'card.no_workspace': '未指定',
      'card.due': '已到执行时间，等待启动',
      'card.waiting_upstream': '等待上游任务成功',
      'dialog.create': '新建任务',
      'dialog.edit': '编辑任务',
      'field.title': '任务名称',
      'field.title.placeholder': '例如：整理本周数据报表',
      'field.instruction': '任务内容',
      'field.instruction.placeholder': '写给执行会话的完整指令，越具体越好',
      'field.workspace': '工作区',
      'field.upstream': '上游任务',
      'field.upstream.none': '无（新开一个会话）',
      'field.scheduledAt': '执行时间',
      'field.permission': '权限预设',
      'preset.read-only': '只读',
      'preset.workspace-write': '工作区可写',
      'preset.danger-full-access': '完全权限',
      'preset.auto': '自动',
      'field.upstream.inherit': '选择上游后，工作区自动继承上游任务',
      'field.required': '请填写任务名称和任务内容，并选择工作区与执行时间',
      'confirm.archive.title': '归档任务',
      'confirm.archive.message': '归档后任务会从看板主视图收起，可在「已归档」里查看。',
      'confirm.delete.title': '删除任务',
      'confirm.delete.message': '删除后无法恢复；有未归档下游任务时不能删除。',
      'confirm.ok': '确认',
      'confirm.cancel': '取消',
      'notice.done': '操作完成',
      'notice.refreshed': '已刷新',
      'toast.archived': '任务已归档',
      'toast.deleted': '任务已删除',
      'toast.restored': '已恢复',
      'toast.undo': '撤销',
      'toast.close': '关闭',
      'empty.all': '还没有任务，点右上角「新建任务」开始吧。',
      'empty.archived': '没有已归档的任务。',
    }

    const en = {
      'sidebar.label': 'Task board',
      'page.title': 'Task board',
      'page.subtitle': 'Create tasks ahead of time and let them run on schedule; pick a workspace and an upstream task, and resume interrupted runs.',
      'action.new': 'New task',
      'action.refresh': 'Refresh',
      'action.edit': 'Edit',
      'action.run': 'Run now',
      'action.continue': 'Resume',
      'action.cancel': 'Cancel',
      'action.archive': 'Archive',
      'action.delete': 'Delete',
      'action.save': 'Save',
      'action.submitting': 'Submitting…',
      'tab.all': 'All',
      'tab.archived': 'Archived',
      'status.planned': 'Planned',
      'status.running': 'Running',
      'status.interrupted': 'Interrupted',
      'status.succeeded': 'Succeeded',
      'status.archived': 'Archived',
      'col.planned': 'Planned',
      'col.running': 'Running',
      'col.interrupted': 'Interrupted',
      'col.succeeded': 'Succeeded',
      'col.empty': 'No tasks',
      'count.tasks': 'tasks',
      'error.load': 'Failed to load the board',
      'error.action': 'Action failed',
      'card.workspace': 'Workspace',
      'card.upstream': 'Upstream',
      'card.time': 'Scheduled',
      'card.attempts': 'Attempts',
      'card.report': 'Report',
      'card.running_since': 'Last started',
      'card.no_workspace': 'None',
      'card.due': 'Due now, waiting to start',
      'card.waiting_upstream': 'Waiting for the upstream task to succeed',
      'dialog.create': 'New task',
      'dialog.edit': 'Edit task',
      'field.title': 'Task name',
      'field.title.placeholder': 'e.g. Prepare the weekly data report',
      'field.instruction': 'Task details',
      'field.instruction.placeholder': 'Write the full instruction for the execution session',
      'field.workspace': 'Workspace',
      'field.upstream': 'Upstream task',
      'field.upstream.none': 'None (start a new session)',
      'field.scheduledAt': 'Scheduled time',
      'field.permission': 'Permission preset',
      'preset.read-only': 'Read only',
      'preset.workspace-write': 'Workspace writable',
      'preset.danger-full-access': 'Full access',
      'preset.auto': 'Auto',
      'field.upstream.inherit': 'When an upstream task is chosen, the workspace is inherited from it.',
      'field.required': 'Please fill in the task name, details, workspace and scheduled time.',
      'confirm.archive.title': 'Archive task',
      'confirm.archive.message': 'Archived tasks are hidden from the main board and remain visible under "Archived".',
      'confirm.delete.title': 'Delete task',
      'confirm.delete.message': 'This cannot be undone. A task with non-archived downstream tasks cannot be deleted.',
      'confirm.ok': 'Confirm',
      'confirm.cancel': 'Cancel',
      'notice.done': 'Done',
      'notice.refreshed': 'Refreshed',
      'toast.archived': 'Task archived',
      'toast.deleted': 'Task deleted',
      'toast.restored': 'Restored',
      'toast.undo': 'Undo',
      'toast.close': 'Close',
      'empty.all': 'No tasks yet. Click "New task" to get started.',
      'empty.archived': 'No archived tasks.',
    }

    const CSS = `
.skb-page{box-sizing:border-box;width:100%;min-height:100%;padding:26px 28px 48px;max-width:1320px;margin:0 auto;color:var(--dsw-alias-label-primary,#1f2328);font-size:13px;line-height:1.5}
.skb-page *{box-sizing:border-box}
.skb-header{display:flex;justify-content:space-between;align-items:flex-start;gap:18px;flex-wrap:wrap}
.skb-title{margin:0;font-size:20px;font-weight:650;letter-spacing:.2px}
.skb-sub{margin:6px 0 0;color:var(--dsw-alias-label-secondary,#6b7280);font-size:12px;max-width:640px}
.skb-header-actions{display:flex;gap:8px;align-items:center}
.skb-btn{appearance:none;border:1px solid var(--dsw-alias-border-l1,#e3e6ec);background:var(--dsw-alias-bg-layer-1,#fff);color:var(--dsw-alias-label-primary,#1f2328);border-radius:8px;padding:6px 12px;font-size:12px;line-height:1.4;cursor:pointer;transition:background .15s,border-color .15s,opacity .15s;white-space:nowrap}
.skb-btn:hover{background:var(--dsw-alias-bg-layer-2,#f3f5f8)}
.skb-btn:disabled{opacity:.5;cursor:not-allowed}
.skb-btn--primary{background:color-mix(in srgb,var(--dsw-alias-brand-primary,#4f7cff) 16%,transparent);border-color:color-mix(in srgb,var(--dsw-alias-brand-primary,#4f7cff) 52%,transparent);color:var(--dsw-alias-brand-primary,#4f7cff);font-weight:600}
.skb-btn--primary:hover{background:color-mix(in srgb,var(--dsw-alias-brand-primary,#4f7cff) 26%,transparent)}
.skb-btn--ghost{background:transparent}
.skb-btn--danger{color:var(--dsw-alias-state-error-primary,#c83b3b);border-color:color-mix(in srgb,var(--dsw-alias-state-error-primary,#c83b3b) 40%,transparent)}
.skb-btn--tiny{padding:3px 9px;font-size:11.5px}
.skb-toolbar{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin:18px 0 16px}
.skb-tab{appearance:none;border:none;background:transparent;color:var(--dsw-alias-label-secondary,#6b7280);padding:6px 10px;border-radius:7px;font-size:12px;cursor:pointer}
.skb-tab:hover{background:var(--dsw-alias-bg-layer-2,#f3f5f8);color:var(--dsw-alias-label-primary,#1f2328)}
.skb-tab--active{background:color-mix(in srgb,var(--dsw-alias-brand-primary,#4f7cff) 14%,transparent);color:var(--dsw-alias-brand-primary,#4f7cff);font-weight:600}
.skb-count{margin-left:auto;color:var(--dsw-alias-label-secondary,#6b7280);font-size:12px}
.skb-toast-host{position:fixed;top:14px;left:50%;transform:translateX(-50%);z-index:1400;display:flex;flex-direction:column;align-items:center;gap:10px;pointer-events:none;width:min(760px,calc(100vw - 32px))}
.skb-toast{pointer-events:auto;display:flex;align-items:center;gap:10px;max-width:100%;padding:8px 16px 8px 12px;border-radius:999px;background:var(--dsw-alias-bg-layer-1,#fff);border:1px solid var(--dsw-alias-border-l1,#e5e7eb);box-shadow:0 10px 30px rgba(15,23,42,.18);color:var(--dsw-alias-label-primary,#1f2328);font-size:13px;line-height:1.45}
.skb-toast--error{border-color:color-mix(in srgb,var(--dsw-alias-state-error-primary,#c83b3b) 45%,transparent)}
.skb-toast-icon{flex:none;display:inline-flex}
.skb-toast-text{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:min(560px,70vw)}
.skb-toast-action{flex:none;border:0;background:none;padding:0 2px;color:var(--dsw-alias-brand-primary,#4f7cff);font:inherit;font-weight:600;cursor:pointer}
.skb-toast-action:hover{text-decoration:underline}
.skb-toast-close{flex:none;border:0;background:none;padding:0 0 0 2px;color:var(--dsw-alias-label-secondary,#6b7280);font:inherit;font-size:15px;line-height:1;cursor:pointer}
.skb-board{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;align-items:start}
.skb-list{display:grid;grid-template-columns:minmax(0,760px);gap:10px}
.skb-col{background:var(--dsw-alias-bg-layer-2,#f3f5f8);border:1px solid var(--dsw-alias-border-l1,#e3e6ec);border-radius:12px;padding:10px;min-height:140px}
.skb-col-head{display:flex;align-items:center;justify-content:space-between;padding:2px 4px 10px;font-weight:600;font-size:12.5px}
.skb-col-head .skb-badge{font-weight:500}
.skb-card{background:var(--dsw-alias-bg-layer-1,#fff);border:1px solid var(--dsw-alias-border-l1,#e3e6ec);border-radius:10px;padding:10px 11px;margin-bottom:9px;box-shadow:0 1px 2px rgba(15,23,42,.03)}
.skb-card:last-child{margin-bottom:0}
.skb-card-head{display:flex;justify-content:space-between;gap:8px;align-items:flex-start}
.skb-card-title{font-weight:600;font-size:13px;word-break:break-word}
.skb-badge{display:inline-flex;align-items:center;padding:1px 8px;border-radius:999px;font-size:11px;line-height:1.6;white-space:nowrap;border:1px solid transparent}
.skb-badge--planned{background:var(--dsw-alias-bg-layer-3,#e9edf2);color:var(--dsw-alias-label-secondary,#6b7280)}
.skb-badge--running{background:color-mix(in srgb,var(--dsw-alias-brand-primary,#4f7cff) 13%,transparent);color:var(--dsw-alias-brand-primary,#4f7cff);border-color:color-mix(in srgb,var(--dsw-alias-brand-primary,#4f7cff) 30%,transparent)}
.skb-badge--interrupted{background:color-mix(in srgb,var(--dsw-alias-state-error-primary,#c83b3b) 10%,transparent);color:var(--dsw-alias-state-error-primary,#c83b3b);border-color:color-mix(in srgb,var(--dsw-alias-state-error-primary,#c83b3b) 28%,transparent)}
.skb-badge--succeeded{background:color-mix(in srgb,#2f9e6f 12%,transparent);color:#2f9e6f;border-color:color-mix(in srgb,#2f9e6f 30%,transparent)}
.skb-badge--archived{background:var(--dsw-alias-bg-layer-3,#e9edf2);color:var(--dsw-alias-label-secondary,#6b7280)}
.skb-meta{margin-top:7px;display:flex;flex-direction:column;gap:2px;color:var(--dsw-alias-label-secondary,#6b7280);font-size:11.5px;word-break:break-word}
.skb-meta b{color:var(--dsw-alias-label-primary,#1f2328);font-weight:500}
.skb-note{margin-top:7px;font-size:11.5px;color:var(--dsw-alias-label-secondary,#6b7280);background:var(--dsw-alias-bg-layer-2,#f3f5f8);border-radius:7px;padding:6px 8px;word-break:break-word}
.skb-note--error{color:var(--dsw-alias-state-error-primary,#c83b3b);background:color-mix(in srgb,var(--dsw-alias-state-error-primary,#c83b3b) 7%,transparent)}
.skb-note--ok{color:#2f9e6f;background:color-mix(in srgb,#2f9e6f 8%,transparent)}
.skb-card-actions{display:flex;gap:6px;flex-wrap:wrap;margin-top:9px}
.skb-empty{padding:18px 8px;text-align:center;color:var(--dsw-alias-label-secondary,#6b7280);font-size:12px}
.skb-overlay{position:fixed;inset:0;z-index:1200;background:rgba(15,23,42,.42);display:flex;align-items:center;justify-content:center;padding:22px}
.skb-modal{width:min(600px,100%);max-height:90vh;overflow:auto;background:var(--dsw-alias-bg-layer-1,#fff);border:1px solid var(--dsw-alias-border-l1,#e3e6ec);border-radius:14px;padding:20px 22px;box-shadow:0 18px 48px rgba(15,23,42,.22)}
.skb-modal h2{margin:0 0 14px;font-size:16px;font-weight:650}
.skb-field{margin-bottom:12px}
.skb-field label{display:block;font-size:12px;font-weight:600;margin-bottom:5px}
.skb-field input,.skb-field textarea,.skb-field select{width:100%;border:1px solid var(--dsw-alias-border-l1,#e3e6ec);background:var(--dsw-alias-bg-layer-2,#f8fafc);color:var(--dsw-alias-label-primary,#1f2328);border-radius:8px;padding:8px 10px;font-size:12.5px;font-family:inherit;outline:none}
.skb-field input:focus,.skb-field textarea:focus,.skb-field select:focus{border-color:var(--dsw-alias-brand-primary,#4f7cff)}
.skb-field input:disabled,.skb-field select:disabled{opacity:.65;cursor:not-allowed}
.skb-field textarea{min-height:120px;resize:vertical}
.skb-hint{margin-top:5px;font-size:11px;color:var(--dsw-alias-label-secondary,#6b7280)}
.skb-row{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.skb-error{margin:0 0 12px;padding:7px 10px;border-radius:8px;font-size:12px;background:color-mix(in srgb,var(--dsw-alias-state-error-primary,#c83b3b) 9%,transparent);color:var(--dsw-alias-state-error-primary,#c83b3b)}
.skb-modal-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:18px}
@media (max-width:1100px){.skb-board{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media (max-width:680px){.skb-board{grid-template-columns:minmax(0,1fr)}.skb-row{grid-template-columns:1fr}}
`

    const COLUMNS = [
      { key: 'planned', badge: 'skb-badge--planned' },
      { key: 'running', badge: 'skb-badge--running' },
      { key: 'interrupted', badge: 'skb-badge--interrupted' },
      { key: 'succeeded', badge: 'skb-badge--succeeded' },
    ]

    function statusClass(status) {
      switch (status) {
        case 'running':
          return 'skb-badge--running'
        case 'interrupted':
          return 'skb-badge--interrupted'
        case 'succeeded':
          return 'skb-badge--succeeded'
        case 'archived':
          return 'skb-badge--archived'
        default:
          return 'skb-badge--planned'
      }
    }

    function pad(value) {
      return String(value).padStart(2, '0')
    }

    function formatTime(input) {
      if (!input) return '—'
      const date = new Date(input)
      if (Number.isNaN(date.getTime())) return String(input)
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
    }

    function toLocalInput(input) {
      const date = input ? new Date(input) : new Date()
      const target = Number.isNaN(date.getTime()) ? new Date() : date
      return `${target.getFullYear()}-${pad(target.getMonth() + 1)}-${pad(target.getDate())}T${pad(target.getHours())}:${pad(target.getMinutes())}`
    }

    function defaultScheduledAt() {
      const date = new Date(Date.now() + 10 * 60 * 1000)
      date.setSeconds(0, 0)
      return toLocalInput(date)
    }

    function presetLabel(t, preset) {
      if (!preset) return ''
      const key = `preset.${preset.name}`
      const text = t(key)
      if (text && text !== key) return text
      return preset.title || preset.name
    }

    function collectDescendants(tasks, id) {      const found = new Set()
      const queue = [id]
      while (queue.length > 0) {
        const current = queue.shift()
        for (const task of tasks) {
          if (task.upstreamId === current && !found.has(task.id)) {
            found.add(task.id)
            queue.push(task.id)
          }
        }
      }
      return found
    }

    function KanbanIcon(props) {
      const size = props && props.size ? props.size : 18
      const active = Boolean(props && props.active)
      return h(
        'svg',
        {
          width: size,
          height: size,
          viewBox: '0 0 24 24',
          fill: 'none',
          'aria-hidden': 'true',
          style: { display: 'block', opacity: active ? 1 : 0.82 },
        },
        h('rect', {
          x: 3,
          y: 3,
          width: 18,
          height: 18,
          rx: 4.5,
          stroke: 'currentColor',
          strokeWidth: 1.6,
        }),
        h('rect', { x: 7, y: 8, width: 2.6, height: 9, rx: 1.1, fill: 'currentColor' }),
        h('rect', { x: 11.4, y: 8, width: 2.6, height: 6.5, rx: 1.1, fill: 'currentColor', opacity: 0.72 }),
        h('rect', { x: 15.8, y: 8, width: 2.6, height: 4, rx: 1.1, fill: 'currentColor', opacity: 0.46 }),
      )
    }

    // 轻量 toast 通知：模块级 store，供 shell.overlay 中的 ToastHost 渲染，
    // 视觉沿用它自带的会话提示样式（顶部居中胶囊 + 状态图标 + 可选操作）。
    const TOASTS = []
    const TOAST_SUBSCRIBERS = new Set()
    let TOAST_SEQ = 0

    function toastSnapshot() {
      return TOASTS.slice()
    }

    function emitToasts() {
      const snapshot = toastSnapshot()
      for (const subscriber of TOAST_SUBSCRIBERS) {
        try {
          subscriber(snapshot)
        } catch (_) {
          /* ignore */
        }
      }
    }

    function dismissToast(id) {
      const index = TOASTS.findIndex((item) => item.id === id)
      if (index < 0) return
      const [removed] = TOASTS.splice(index, 1)
      if (removed && removed.timer) clearTimeout(removed.timer)
      emitToasts()
    }

    function showToast(input) {
      const item = {
        id: ++TOAST_SEQ,
        tone: input && input.tone ? input.tone : 'success',
        text: String((input && input.text) || ''),
        action: (input && input.action) || null,
        timer: null,
      }
      TOASTS.push(item)
      const timeout = input && input.timeout !== undefined ? input.timeout : 6000
      if (timeout > 0) item.timer = setTimeout(() => dismissToast(item.id), timeout)
      emitToasts()
      return item.id
    }

    function subscribeToasts(fn) {
      TOAST_SUBSCRIBERS.add(fn)
      return () => {
        TOAST_SUBSCRIBERS.delete(fn)
      }
    }

    function ToastIcon(props) {
      const tone = props && props.tone
      const color =
        tone === 'error'
          ? 'var(--dsw-alias-state-error-primary,#c83b3b)'
          : tone === 'info'
            ? 'var(--dsw-alias-brand-primary,#4f7cff)'
            : 'var(--dsw-alias-state-success-primary,#2f9e6e)'
      return h(
        'svg',
        { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', 'aria-hidden': 'true', className: 'skb-toast-icon' },
        h('circle', { cx: 12, cy: 12, r: 10, fill: color }),
        tone === 'error'
          ? h('path', { d: 'M12 7.5v6.2', stroke: '#fff', strokeWidth: 2.2, strokeLinecap: 'round' })
          : tone === 'info'
            ? h('path', { d: 'M12 10.8v6', stroke: '#fff', strokeWidth: 2.2, strokeLinecap: 'round' })
            : h('path', {
                d: 'M7.6 12.3l2.9 2.9 5.8-6',
                stroke: '#fff',
                strokeWidth: 2.2,
                strokeLinecap: 'round',
                strokeLinejoin: 'round',
              }),
        tone === 'error'
          ? h('circle', { cx: 12, cy: 17, r: 1.15, fill: '#fff' })
          : tone === 'info'
            ? h('circle', { cx: 12, cy: 7.4, r: 1.15, fill: '#fff' })
            : null,
      )
    }

    function ToastHost() {
      const [items, setItems] = React.useState(() => toastSnapshot())
      React.useEffect(() => subscribeToasts((list) => setItems(list)), [])
      if (items.length === 0) return null
      return h(
        'div',
        { className: 'skb-toast-host', role: 'status', 'aria-live': 'polite' },
        ...items.map((item) =>
          h(
            'div',
            { key: item.id, className: `skb-toast skb-toast--${item.tone}` },
            h(ToastIcon, { tone: item.tone }),
            h('span', { className: 'skb-toast-text' }, item.text),
            item.action
              ? h(
                  'button',
                  {
                    type: 'button',
                    className: 'skb-toast-action',
                    onClick: () => {
                      dismissToast(item.id)
                      try {
                        Promise.resolve(item.action.onClick && item.action.onClick()).catch(() => {})
                      } catch (_) {
                        /* ignore */
                      }
                    },
                  },
                  item.action.label,
                )
              : null,
            item.tone === 'error'
              ? h(
                  'button',
                  {
                    type: 'button',
                    className: 'skb-toast-close',
                    'aria-label': 'close',
                    onClick: () => dismissToast(item.id),
                  },
                  '×',
                )
              : null,
          ),
        ),
      )
    }

    function TaskCard(props) {
      const task = props.task
      const t = props.t
      const data = props.data
      const busy = props.busy
      const canRun =
        task.status === 'planned' &&
        (!task.upstreamId || (data.tasks.find((item) => item.id === task.upstreamId) || {}).status === 'succeeded')
      const waitingUpstream =
        task.status === 'planned' &&
        task.upstreamId &&
        !canRun
      const isOverdue = task.status === 'planned' && Date.parse(task.scheduledAt) <= (data.serverNow || Date.now())
      return h(
        'div',
        { className: 'skb-card' },
        h(
          'div',
          { className: 'skb-card-head' },
          h('div', { className: 'skb-card-title' }, task.title),
          h('span', { className: `skb-badge ${statusClass(task.status)}` }, t(`status.${task.status}`)),
        ),
        h(
          'div',
          { className: 'skb-meta' },
          h('div', null, h('b', null, `${t('card.workspace')}：`), task.workspaceTitle || t('card.no_workspace')),
          h('div', null, h('b', null, `${t('card.time')}：`), formatTime(task.scheduledAt)),
          task.upstreamId
            ? h('div', null, h('b', null, `${t('card.upstream')}：`), task.upstreamTitle || task.upstreamId)
            : null,
          task.attempts > 1 ? h('div', null, h('b', null, `${t('card.attempts')}：`), `${task.attempts}/${data.maxAttempts}`) : null,
          task.lastRunAt ? h('div', null, h('b', null, `${t('card.running_since')}：`), formatTime(task.lastRunAt)) : null,
        ),
        isOverdue && canRun ? h('div', { className: 'skb-note' }, t('card.due')) : null,
        waitingUpstream ? h('div', { className: 'skb-note' }, t('card.waiting_upstream')) : null,
        task.lastReport && task.lastReport.summary
          ? h(
              'div',
              { className: `skb-note ${task.lastReport.status === 'success' ? 'skb-note--ok' : 'skb-note--error'}` },
              `${t('card.report')}：${task.lastReport.summary}`,
            )
          : null,
        task.status === 'interrupted' && task.interruptReason
          ? h('div', { className: 'skb-note skb-note--error' }, task.interruptReason)
          : null,
        task.status === 'running' && task.retryAt
          ? h('div', { className: 'skb-note' }, `${t('status.running')} · ${formatTime(task.retryAt)}`)
          : null,
        h(
          'div',
          { className: 'skb-card-actions' },
          task.status === 'planned'
            ? h(
                'button',
                {
                  type: 'button',
                  className: 'skb-btn skb-btn--tiny skb-btn--primary',
                  disabled: busy || !canRun,
                  onClick: () => props.onAction('run', task),
                },
                t('action.run'),
              )
            : null,
          task.status === 'interrupted'
            ? h(
                'button',
                {
                  type: 'button',
                  className: 'skb-btn skb-btn--tiny skb-btn--primary',
                  disabled: busy,
                  onClick: () => props.onAction('continue', task),
                },
                t('action.continue'),
              )
            : null,
          task.status === 'running'
            ? h(
                'button',
                {
                  type: 'button',
                  className: 'skb-btn skb-btn--tiny',
                  disabled: busy,
                  onClick: () => props.onAction('cancel', task),
                },
                t('action.cancel'),
              )
            : null,
          task.status === 'planned'
            ? h(
                'button',
                {
                  type: 'button',
                  className: 'skb-btn skb-btn--tiny skb-btn--ghost',
                  disabled: busy,
                  onClick: () => props.onEdit(task),
                },
                t('action.edit'),
              )
            : null,
          task.status === 'succeeded' || task.status === 'interrupted'
            ? h(
                'button',
                {
                  type: 'button',
                  className: 'skb-btn skb-btn--tiny',
                  disabled: busy,
                  onClick: () => props.onAskArchive(task),
                },
                t('action.archive'),
              )
            : null,
          task.status !== 'running'
            ? h(
                'button',
                {
                  type: 'button',
                  className: 'skb-btn skb-btn--tiny skb-btn--danger',
                  disabled: busy,
                  onClick: () => props.onAskDelete(task),
                },
                t('action.delete'),
              )
            : null,
        ),
      )
    }

    function TaskDialog(props) {
      const t = props.t
      const data = props.data
      const task = props.task
      const editing = Boolean(task)
      const [title, setTitle] = React.useState(task ? task.title : '')
      const [instruction, setInstruction] = React.useState(task ? task.instruction : '')
      const [workspaceId, setWorkspaceId] = React.useState(task ? task.workspaceId : data.workspaces[0] ? data.workspaces[0].id : '')
      const [upstreamId, setUpstreamId] = React.useState(task && task.upstreamId ? task.upstreamId : '')
      const [scheduledAt, setScheduledAt] = React.useState(task ? toLocalInput(task.scheduledAt) : defaultScheduledAt())
      const [permissionPreset, setPermissionPreset] = React.useState(
        task && task.permissionPreset ? task.permissionPreset : data.defaultPreset || (data.presets[0] ? data.presets[0].name : ''),
      )
      const [error, setError] = React.useState('')
      const [submitting, setSubmitting] = React.useState(false)

      const descendants = task ? collectDescendants(data.tasks, task.id) : new Set()
      const upstreamOptions = data.tasks.filter(
        (item) => item.id !== (task && task.id) && item.status !== 'archived' && !descendants.has(item.id),
      )
      const upstreamTask = data.tasks.find((item) => item.id === upstreamId)
      const effectiveWorkspaceId = upstreamTask ? upstreamTask.workspaceId : workspaceId
      const workspaceOptions = data.workspaces.slice()
      if (effectiveWorkspaceId && !workspaceOptions.some((item) => item.id === effectiveWorkspaceId)) {
        const stored = (upstreamTask || task || {}).workspaceTitle
        workspaceOptions.push({ id: effectiveWorkspaceId, title: stored || effectiveWorkspaceId, path: '' })
      }

      async function submit(event) {
        if (event) event.preventDefault()
        if (!title.trim() || !instruction.trim() || !scheduledAt || !effectiveWorkspaceId) {
          setError(t('field.required'))
          return
        }
        setSubmitting(true)
        setError('')
        try {
          await props.onSubmit({
            title: title.trim(),
            instruction: instruction.trim(),
            workspaceId: effectiveWorkspaceId,
            upstreamId: upstreamId || null,
            scheduledAt: new Date(scheduledAt).toISOString(),
            permissionPreset,
          })
        } catch (err) {
          setError(err && err.message ? err.message : String(err))
          setSubmitting(false)
        }
      }

      return h(
        'div',
        { className: 'skb-overlay', onMouseDown: (event) => { if (event.target === event.currentTarget) props.onClose() } },
        h(
          'form',
          { className: 'skb-modal', onSubmit: submit },
          h('h2', null, editing ? t('dialog.edit') : t('dialog.create')),
          error ? h('div', { className: 'skb-error' }, error) : null,
          h(
            'div',
            { className: 'skb-field' },
            h('label', null, t('field.title')),
            h('input', {
              value: title,
              placeholder: t('field.title.placeholder'),
              onChange: (event) => setTitle(event.target.value),
              autoFocus: true,
            }),
          ),
          h(
            'div',
            { className: 'skb-field' },
            h('label', null, t('field.instruction')),
            h('textarea', {
              value: instruction,
              placeholder: t('field.instruction.placeholder'),
              onChange: (event) => setInstruction(event.target.value),
            }),
          ),
          h(
            'div',
            { className: 'skb-row' },
            h(
              'div',
              { className: 'skb-field' },
              h('label', null, t('field.workspace')),
              h(
                'select',
                {
                  value: effectiveWorkspaceId,
                  disabled: Boolean(upstreamTask),
                  onChange: (event) => setWorkspaceId(event.target.value),
                },
                ...workspaceOptions.map((item) =>
                  h('option', { key: item.id, value: item.id }, item.title || item.path || item.id),
                ),
              ),
            ),
            h(
              'div',
              { className: 'skb-field' },
              h('label', null, t('field.scheduledAt')),
              h('input', {
                type: 'datetime-local',
                value: scheduledAt,
                onChange: (event) => setScheduledAt(event.target.value),
              }),
            ),
          ),
          h(
            'div',
            { className: 'skb-row' },
            h(
              'div',
              { className: 'skb-field' },
              h('label', null, t('field.upstream')),
              h(
                'select',
                {
                  value: upstreamId,
                  onChange: (event) => setUpstreamId(event.target.value),
                },
                h('option', { value: '' }, t('field.upstream.none')),
                ...upstreamOptions.map((item) =>
                  h('option', { key: item.id, value: item.id }, `${item.title}（${t(`status.${item.status}`)}）`),
                ),
              ),
              h('div', { className: 'skb-hint' }, t('field.upstream.inherit')),
            ),
            h(
              'div',
              { className: 'skb-field' },
              h('label', null, t('field.permission')),
              h(
                'select',
                {
                  value: permissionPreset,
                  onChange: (event) => setPermissionPreset(event.target.value),
                },
                ...data.presets.map((item) =>
                  h('option', { key: item.name, value: item.name }, presetLabel(t, item)),
                ),
              ),
            ),
          ),
          h(
            'div',
            { className: 'skb-modal-actions' },
            h('button', { type: 'button', className: 'skb-btn skb-btn--ghost', onClick: props.onClose, disabled: submitting }, t('confirm.cancel')),
            h('button', { type: 'submit', className: 'skb-btn skb-btn--primary', disabled: submitting }, submitting ? t('action.submitting') : t('action.save')),
          ),
        ),
      )
    }

    function ConfirmDialog(props) {
      const t = props.t
      return h(
        'div',
        { className: 'skb-overlay', onMouseDown: (event) => { if (event.target === event.currentTarget) props.onClose() } },
        h(
          'div',
          { className: 'skb-modal', style: { width: 'min(420px,100%)' } },
          h('h2', null, props.title),
          h('div', { style: { fontSize: '12.5px', color: 'var(--dsw-alias-label-secondary,#6b7280)' } }, props.message),
          h(
            'div',
            { className: 'skb-modal-actions' },
            h('button', { type: 'button', className: 'skb-btn skb-btn--ghost', onClick: props.onClose, disabled: props.busy }, t('confirm.cancel')),
            h(
              'button',
              { type: 'button', className: 'skb-btn skb-btn--primary', onClick: props.onConfirm, disabled: props.busy },
              props.busy ? t('action.submitting') : t('confirm.ok'),
            ),
          ),
        ),
      )
    }

    function KanbanPage(props) {
      const t = props.t
      const [data, setData] = React.useState(null)
      const [filter, setFilter] = React.useState('all')
      const [dialog, setDialog] = React.useState(null)
      const [confirmState, setConfirmState] = React.useState(null)
      const [busy, setBusy] = React.useState(false)
      const mounted = React.useRef(true)
      const lastLoadError = React.useRef('')

      const load = React.useCallback(async () => {
        try {
          const response = await fetch(STATE_URL, { cache: 'no-store' })
          const body = await response.json().catch(() => null)
          if (!response.ok || !body || !body.ok) {
            throw new Error((body && body.error) || `HTTP ${response.status}`)
          }
          if (mounted.current) {
            setData(body)
            lastLoadError.current = ''
          }
        } catch (err) {
          const message = `${t('error.load')}：${err && err.message ? err.message : String(err)}`
          if (mounted.current && lastLoadError.current !== message) {
            lastLoadError.current = message
            showToast({ tone: 'error', text: message, timeout: 8000 })
          }
        }
      }, [t])

      React.useEffect(() => {
        mounted.current = true
        load()
        const timer = setInterval(load, 2000)
        const onVisibility = () => {
          if (typeof document !== 'undefined' && document.visibilityState === 'visible') load()
        }
        if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisibility)
        return () => {
          mounted.current = false
          clearInterval(timer)
          if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisibility)
        }
      }, [load])

      const act = React.useCallback(
        async (action, payload) => {
          setBusy(true)
          try {
            const response = await fetch(ACTION_URL, {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ action, ...(payload || {}) }),
            })
            const body = await response.json().catch(() => ({}))
            if (!response.ok || !body || !body.ok) {
              throw new Error((body && body.error) || `HTTP ${response.status}`)
            }
            await load()
            return body
          } finally {
            setBusy(false)
          }
        },
        [load],
      )

      async function submitDialog(fields) {
        if (dialog && dialog.task) {
          await act('update', { id: dialog.task.id, task: fields })
        } else {
          await act('create', { task: fields })
        }
        setDialog(null)
        showToast({ tone: 'success', text: t('notice.done') })
      }

      async function runCardAction(name, task) {
        try {
          await act(name, { id: task.id })
          showToast({ tone: 'success', text: t('notice.done') })
        } catch (err) {
          showToast({ tone: 'error', text: `${t('error.action')}：${err && err.message ? err.message : String(err)}` })
        }
      }

      async function undoArchive(id) {
        try {
          await act('unarchive', { id })
          showToast({ tone: 'success', text: t('toast.restored') })
        } catch (err) {
          showToast({ tone: 'error', text: `${t('error.action')}：${err && err.message ? err.message : String(err)}` })
        }
      }

      async function undoDelete(task) {
        try {
          await act('create', {
            task: {
              title: task.title,
              instruction: task.instruction,
              workspaceId: task.workspaceId,
              upstreamId: task.upstreamId,
              scheduledAt: task.scheduledAt,
              permissionPreset: task.permissionPreset,
            },
          })
          showToast({ tone: 'success', text: t('toast.restored') })
        } catch (err) {
          showToast({ tone: 'error', text: `${t('error.action')}：${err && err.message ? err.message : String(err)}` })
        }
      }

      function askArchive(task) {
        setConfirmState({ kind: 'archive', task })
      }

      function askDelete(task) {
        setConfirmState({ kind: 'delete', task })
      }

      async function confirmRun() {
        if (!confirmState) return
        const { kind, task } = confirmState
        try {
          await act(kind, { id: task.id })
          setConfirmState(null)
          if (kind === 'archive') {
            showToast({ tone: 'success', text: t('toast.archived'), action: { label: t('toast.undo'), onClick: () => undoArchive(task.id) } })
          } else {
            showToast({ tone: 'success', text: t('toast.deleted'), action: { label: t('toast.undo'), onClick: () => undoDelete(task) } })
          }
        } catch (err) {
          showToast({ tone: 'error', text: `${t('error.action')}：${err && err.message ? err.message : String(err)}` })
        }
      }

      const tasks = (data && data.tasks) || []
      const activeTasks = tasks.filter((task) => task.status !== 'archived')
      const archivedTasks = tasks.filter((task) => task.status === 'archived')
      const filterTasks =
        filter === 'all'
          ? activeTasks
          : filter === 'archived'
            ? archivedTasks
            : activeTasks.filter((task) => task.status === filter)

      const tabs = [
        { key: 'all', label: t('tab.all') },
        { key: 'planned', label: t('status.planned') },
        { key: 'running', label: t('status.running') },
        { key: 'interrupted', label: t('status.interrupted') },
        { key: 'succeeded', label: t('status.succeeded') },
        { key: 'archived', label: t('tab.archived') },
      ]

      function renderColumn(columnKey) {
        const items = filterTasks.filter((task) => task.status === columnKey)
        return h(
          'div',
          { className: 'skb-col', key: columnKey },
          h(
            'div',
            { className: 'skb-col-head' },
            h('span', null, t(`col.${columnKey}`)),
            h('span', { className: `skb-badge ${statusClass(columnKey)}` }, String(items.length)),
          ),
          items.length === 0
            ? h('div', { className: 'skb-empty' }, t('col.empty'))
            : items.map((task) =>
                h(TaskCard, {
                  key: task.id,
                  task,
                  t,
                  data,
                  busy,
                  onAction: runCardAction,
                  onEdit: (item) => setDialog({ task: item }),
                  onAskArchive: askArchive,
                  onAskDelete: askDelete,
                }),
              ),
        )
      }

      return h(
        'div',
        { className: 'skb-page' },
        h('style', { dangerouslySetInnerHTML: { __html: CSS } }),
        h(
          'div',
          { className: 'skb-header' },
          h(
            'div',
            null,
            h('h1', { className: 'skb-title' }, t('page.title')),
            h('p', { className: 'skb-sub' }, t('page.subtitle')),
          ),
          h(
            'div',
            { className: 'skb-header-actions' },
            h('button', { type: 'button', className: 'skb-btn', onClick: () => load(), disabled: busy }, t('action.refresh')),
            h(
              'button',
              {
                type: 'button',
                className: 'skb-btn skb-btn--primary',
                onClick: () => setDialog({ task: null }),
                disabled: !data || busy,
              },
              t('action.new'),
            ),
          ),
        ),
        h(
          'div',
          { className: 'skb-toolbar' },
          ...tabs.map((tab) =>
            h(
              'button',
              {
                key: tab.key,
                type: 'button',
                className: `skb-tab${filter === tab.key ? ' skb-tab--active' : ''}`,
                onClick: () => setFilter(tab.key),
              },
              tab.label,
            ),
          ),
          h('span', { className: 'skb-count' }, `${filterTasks.length} ${t('count.tasks')}`),
        ),
        data === null
          ? h('div', { className: 'skb-empty' }, t('action.submitting'))
          : filter === 'archived'
            ? archivedTasks.length === 0
              ? h('div', { className: 'skb-empty' }, t('empty.archived'))
              : h(
                  'div',
                  { className: 'skb-list' },
                  archivedTasks.map((task) =>
                    h(TaskCard, {
                      key: task.id,
                      task,
                      t,
                      data,
                      busy,
                      onAction: runCardAction,
                      onEdit: (item) => setDialog({ task: item }),
                      onAskArchive: askArchive,
                      onAskDelete: askDelete,
                    }),
                  ),
                )
            : filter === 'all'
              ? activeTasks.length === 0
                ? h('div', { className: 'skb-empty' }, t('empty.all'))
                : h('div', { className: 'skb-board' }, ...COLUMNS.map((column) => renderColumn(column.key)))
              : h('div', { className: 'skb-board' }, renderColumn(filter)),
        dialog
          ? h(TaskDialog, {
              key: dialog.task ? dialog.task.id : 'new',
              t,
              data,
              task: dialog.task,
              onClose: () => setDialog(null),
              onSubmit: submitDialog,
            })
          : null,
        confirmState
          ? h(ConfirmDialog, {
              t,
              busy,
              title: confirmState.kind === 'archive' ? t('confirm.archive.title') : t('confirm.delete.title'),
              message: confirmState.kind === 'archive' ? t('confirm.archive.message') : t('confirm.delete.message'),
              onClose: () => setConfirmState(null),
              onConfirm: confirmRun,
            })
          : null,
      )
    }

    function apply(ctx) {
      ctx.effect(() => ctx.locale.register(NS, { zh, en }))
      const t = ctx.locale.bind(NS)
      ctx.slots.inject('sidebar.panellist', () =>
        ctx.slots.register(
          { name: 'sidebar.panellist', id: SLOT_ID, order: 20, label: () => t('sidebar.label') },
          (props) => h(KanbanIcon, { size: props && props.size, active: props && props.active }),
        ),
      )
      ctx.slots.inject('main', () =>
        ctx.slots.register({ name: 'main', key: SLOT_ID }, () => h(KanbanPage, { t })),
      )
      ctx.slots.inject('shell.overlay', () =>
        ctx.slots.register({ name: 'shell.overlay', id: 'shanhai-kanban-toasts', order: 95 }, () => h(ToastHost)),
      )
    }

    module.exports = { inject: ['slots', 'locale'], apply, KanbanPage, KanbanIcon, ToastHost }
    return module.exports
  },
})
