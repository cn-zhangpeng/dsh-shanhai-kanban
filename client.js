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
      'action.open_session': '进入会话',
      'toast.session_missing': '这个任务还没有关联的会话',
      'toast.session_unavailable': '当前界面不支持跳转会话',
      'action.save': '保存',
      'action.submitting': '提交中…',
      'tab.all': '全部',
      'tab.archived': '已归档',
      'status.planned': '计划中',
      'status.running': '执行中',
      'status.waiting_question': '等待你回答',
      'status.waiting_approval': '等待审批',
      'status.waiting_other': '等待你操作',
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
      'card.waiting_question': '等待你的回答',
      'card.waiting_approval': '等待你的审批',
      'card.waiting_other': '等待你的操作',
      'card.waiting_hint': '回答后会自动继续',
  'card.waiting_interrupted_hint': '请先到对话里回答，回答后再点继续',
      'card.acceptance': '验收条件',
      'card.inferred': '自动判定',
      'card.needs_confirm': '本轮结果还没确认',
      'card.evidence': '证据',
      'card.runs': '运行记录',
      'card.ack': '确认结果',
      'card.acknowledged': '已确认',
      'card.latest_run': '最近一次',
      'run.running': '执行中',
      'run.succeeded': '成功',
      'run.interrupted': '中断',
      'dock.title': '任务已有结果，等你确认',
      'dock.result': '结论',
      'dock.done_empty': '这一轮没有记录结论',
      'dock.interrupt_empty': '这一轮没有记录中断原因',
      'dock.inferred': '未主动上报，按回合结束状态自动判定',
      'dock.confirm': '确认结果',
      'dock.continue': '继续处理',
      'dock.dismiss': '忽略',
      'dock.detail': '详情',
      'dock.collapse': '收起',
      'dock.acknowledged': '已确认，看板已记账',
      'toast.acknowledged': '已确认本轮结果',
      'field.acceptance': '验收条件（可选）',
      'field.acceptance.placeholder': '例如：报告写入 reports/week.md；npm test 全部通过',
      'field.acceptance.hint': '写清“怎样算做完”，执行会话会按这些条件自检，结果里也能看到证据。',
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
      'action.open_session': 'Open session',
      'toast.session_missing': 'This task has no session yet',
      'toast.session_unavailable': 'This host cannot navigate to sessions',
      'action.save': 'Save',
      'action.submitting': 'Submitting…',
      'tab.all': 'All',
      'tab.archived': 'Archived',
      'status.planned': 'Planned',
      'status.running': 'Running',
      'status.waiting_question': 'Waiting for answer',
      'status.waiting_approval': 'Waiting for approval',
      'status.waiting_other': 'Waiting for you',
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
      'card.waiting_question': 'Waiting for your answer',
      'card.waiting_approval': 'Waiting for your approval',
      'card.waiting_other': 'Waiting for you',
      'card.waiting_hint': 'Continues automatically after you answer',
  'card.waiting_interrupted_hint': 'Answer it in the conversation first, then click continue',
      'card.acceptance': 'Acceptance',
      'card.inferred': 'Inferred',
      'card.needs_confirm': 'This result is not confirmed yet',
      'card.evidence': 'Evidence',
      'card.runs': 'Runs',
      'card.ack': 'Confirm result',
      'card.acknowledged': 'Confirmed',
      'card.latest_run': 'Latest',
      'run.running': 'Running',
      'run.succeeded': 'Succeeded',
      'run.interrupted': 'Interrupted',
      'dock.title': 'A task has a result waiting for you',
      'dock.result': 'Result',
      'dock.done_empty': 'No result was recorded for this run',
      'dock.interrupt_empty': 'No interruption reason was recorded for this run',
      'dock.inferred': 'No explicit report; inferred from how the turn ended',
      'dock.confirm': 'Confirm result',
      'dock.continue': 'Keep working',
      'dock.dismiss': 'Dismiss',
      'dock.detail': 'Details',
      'dock.collapse': 'Collapse',
      'dock.acknowledged': 'Confirmed and recorded',
      'toast.acknowledged': 'Result confirmed',
      'field.acceptance': 'Acceptance criteria (optional)',
      'field.acceptance.placeholder': 'e.g. report written to reports/week.md; npm test passes',
      'field.acceptance.hint': 'Describe what "done" means; the run checks itself against these and reports evidence.',
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
.skb-badge--waiting{background:color-mix(in srgb,#d98324 14%,transparent);color:#b26b12;border-color:color-mix(in srgb,#d98324 34%,transparent)}
.skb-meta{margin-top:7px;display:flex;flex-direction:column;gap:2px;color:var(--dsw-alias-label-secondary,#6b7280);font-size:11.5px;word-break:break-word}
.skb-meta b{color:var(--dsw-alias-label-primary,#1f2328);font-weight:500}
.skb-note{margin-top:7px;font-size:11.5px;color:var(--dsw-alias-label-secondary,#6b7280);background:var(--dsw-alias-bg-layer-2,#f3f5f8);border-radius:7px;padding:6px 8px;word-break:break-word}
.skb-note--error{color:var(--dsw-alias-state-error-primary,#c83b3b);background:color-mix(in srgb,var(--dsw-alias-state-error-primary,#c83b3b) 7%,transparent)}
.skb-note--waiting{color:#b26b12;background:color-mix(in srgb,#d98324 8%,transparent)}
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
.skb-badge--inferred{background:color-mix(in srgb,#7c6bd6 12%,transparent);color:#6154b4;border-color:color-mix(in srgb,#7c6bd6 30%,transparent)}
.skb-dock{pointer-events:auto;display:flex;flex-direction:column;gap:6px;width:100%;max-width:760px;margin:0 auto 8px;padding:7px 10px;border-radius:12px;border:1px solid color-mix(in srgb,#d98324 32%,transparent);background:color-mix(in srgb,#d98324 8%,var(--dsw-alias-bg-layer-1,#fff));color:var(--dsw-alias-label-primary,#1f2328);font-size:12.5px;line-height:1.5;box-shadow:0 2px 10px rgba(15,23,42,.06)}
.skb-dock-head{display:flex;align-items:center;gap:8px;min-width:0}
.skb-dock-icon{flex:none;width:17px;height:17px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;background:#d98324;color:#fff;font-size:11px;font-weight:700;line-height:1}
.skb-dock-title{flex:none;max-width:34%;min-width:0;font-weight:600;font-size:12.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.skb-dock-summary{flex:1 1 auto;min-width:40px;font-size:12px;color:var(--dsw-alias-label-secondary,#6b7280);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.skb-dock-head .skb-btn{flex:none}
.skb-dock-body{display:flex;flex-direction:column;gap:3px;font-size:12px;line-height:1.55;color:var(--dsw-alias-label-secondary,#6b7280)}
.skb-dock-line{word-break:break-word}
.skb-dock-line b{color:var(--dsw-alias-label-primary,#1f2328);font-weight:600;margin-right:5px}
.skb-dock-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:2px}
.skb-runs{margin-top:7px;display:flex;flex-direction:column;gap:2px;font-size:11px;color:var(--dsw-alias-label-secondary,#6b7280)}
.skb-runs-row{display:flex;gap:6px;align-items:baseline}
.skb-runs-row b{font-weight:500;color:var(--dsw-alias-label-primary,#1f2328)}
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

    // 看板数据源：整页和会话里的待确认卡片共用同一次轮询。
    // Host 返回的 signature 没变就不通知订阅者，避免每 2s 全量重渲染。
    const boardFeed = {
      data: null,
      error: '',
      signature: '',
      timer: null,
      subscribers: new Set(),
      notify() {
        for (const subscriber of Array.from(this.subscribers)) {
          try {
            subscriber(this)
          } catch (_) {
            /* ignore */
          }
        }
      },
      async load() {
        try {
          const response = await fetch(STATE_URL, { cache: 'no-store' })
          const body = await response.json().catch(() => null)
          if (!response.ok || !body || !body.ok) {
            throw new Error((body && body.error) || `HTTP ${response.status}`)
          }
          const changed = !this.data || body.signature !== this.signature
          const recovered = Boolean(this.error)
          this.signature = body.signature || ''
          this.data = body
          this.error = ''
          if (changed || recovered) this.notify()
          return body
        } catch (err) {
          const message = err && err.message ? err.message : String(err)
          if (this.error !== message) {
            this.error = message
            this.notify()
          }
          return null
        }
      },
      subscribe(fn) {
        this.subscribers.add(fn)
        if (this.subscribers.size === 1 && !this.timer) {
          this.load()
          this.timer = setInterval(() => this.load(), 2000)
        }
        if (this.data || this.error) {
          try {
            fn(this)
          } catch (_) {
            /* ignore */
          }
        }
        return () => {
          this.subscribers.delete(fn)
          if (this.subscribers.size === 0 && this.timer) {
            clearInterval(this.timer)
            this.timer = null
          }
        }
      },
    }

    async function postAction(action, payload) {
      const response = await fetch(ACTION_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action, ...(payload || {}) }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok || !body || !body.ok) {
        throw new Error((body && body.error) || `HTTP ${response.status}`)
      }
      await boardFeed.load()
      return body
    }

    // 会话输入框上方的待确认卡片：任务进入终态、且这一轮还没确认时出现。
    // 只做提示，不影响下游任务解锁；点确认只记账本，不重复弹。
    function SessionDockCard(props) {
      const t = props.t
      const sessionId = props.sessionId
      const [snapshot, setSnapshot] = React.useState({ data: boardFeed.data })
      const [dismissed, setDismissed] = React.useState('')
      const [busy, setBusy] = React.useState(false)
      const [open, setOpen] = React.useState(false)
      React.useEffect(() => {
        if (!sessionId) return () => {}
        return boardFeed.subscribe((feed) => setSnapshot({ data: feed.data }))
      }, [sessionId])
      if (!sessionId) return null
      const tasks = (snapshot.data && snapshot.data.tasks) || []
      const task = tasks.find((item) => item.sessionId === sessionId && item.needsConfirm)
      if (!task || dismissed === task.id) return null
      const lastRun = task.runs && task.runs.length > 0 ? task.runs[task.runs.length - 1] : null
      const succeeded = task.status === 'succeeded'
      const summary = (task.lastReport && task.lastReport.summary) || (lastRun && lastRun.summary) || ''
      const detail = succeeded ? summary : task.interruptReason || (lastRun && lastRun.reason) || ''
      const evidence = (task.lastReport && task.lastReport.evidence) || []
      async function acknowledge() {
        setBusy(true)
        try {
          await postAction('acknowledge', { id: task.id })
          showToast({ tone: 'success', text: t('toast.acknowledged') })
        } catch (err) {
          showToast({ tone: 'error', text: `${t('error.action')}：${err && err.message ? err.message : String(err)}` })
        } finally {
          setBusy(false)
        }
      }
      async function resume() {
        setBusy(true)
        try {
          await postAction('continue', { id: task.id })
          setDismissed(task.id)
        } catch (err) {
          showToast({ tone: 'error', text: `${t('error.action')}：${err && err.message ? err.message : String(err)}` })
        } finally {
          setBusy(false)
        }
      }
      const verdict = succeeded ? summary || t('dock.done_empty') : detail || t('dock.interrupt_empty')
      return h(
        'div',
        { className: 'skb-dock', role: 'status' },
        h(
          'div',
          { className: 'skb-dock-head' },
          h('span', { className: 'skb-dock-icon', 'aria-hidden': 'true' }, succeeded ? '✓' : '!'),
          h('span', { className: 'skb-dock-title', title: task.title }, task.title),
          h('span', { className: `skb-badge ${statusClass(task.status)}` }, t(`status.${task.status}`)),
          h('span', { className: 'skb-dock-summary', title: verdict }, verdict),
          h(
            'button',
            { type: 'button', className: 'skb-btn skb-btn--tiny skb-btn--primary', disabled: busy, onClick: acknowledge },
            t('dock.confirm'),
          ),
          h(
            'button',
            {
              type: 'button',
              className: 'skb-btn skb-btn--tiny skb-btn--ghost',
              'aria-expanded': open,
              onClick: () => setOpen(!open),
            },
            open ? t('dock.collapse') : t('dock.detail'),
          ),
        ),
        open
          ? h(
              'div',
              { className: 'skb-dock-body' },
              lastRun && lastRun.inferred ? h('div', { className: 'skb-dock-line' }, t('dock.inferred')) : null,
              evidence.length > 0
                ? h('div', { className: 'skb-dock-line' }, h('b', null, t('card.evidence')), evidence.slice(0, 3).join('；'))
                : null,
              h(
                'div',
                { className: 'skb-dock-actions' },
                succeeded
                  ? null
                  : h(
                      'button',
                      { type: 'button', className: 'skb-btn skb-btn--tiny', disabled: busy, onClick: resume },
                      t('dock.continue'),
                    ),
                h(
                  'button',
                  { type: 'button', className: 'skb-btn skb-btn--tiny skb-btn--ghost', disabled: busy, onClick: () => setDismissed(task.id) },
                  t('dock.dismiss'),
                ),
              ),
            )
          : null,
      )
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
      // 任务仍是 running，但会话正在等用户回答/审批：徽章要如实反映"在等你"。
      // 已中断任务的会话里如果还挂着没回答的问题，也要提示，否则用户点「继续」会把提问作废。
      const waiting = task.status === 'running' && task.waiting ? String(task.waiting) : ''
      const pendingOnInterrupted = task.status === 'interrupted' && task.waiting ? String(task.waiting) : ''
      const badgeLabel = waiting ? t(`status.waiting_${waiting}`) : t(`status.${task.status}`)
      const badgeClass = waiting ? 'skb-badge--waiting' : statusClass(task.status)
      const lastRun = task.runs && task.runs.length > 0 ? task.runs[task.runs.length - 1] : null
      return h(
        'div',
        { className: 'skb-card' },
        h(
          'div',
          { className: 'skb-card-head' },
          h('div', { className: 'skb-card-title' }, task.title),
          h(
            'div',
            { style: { display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'flex-end', flex: 'none' } },
            lastRun && lastRun.inferred && task.status === 'succeeded'
              ? h('span', { className: 'skb-badge skb-badge--inferred' }, t('card.inferred'))
              : null,
            h('span', { className: `skb-badge ${badgeClass}` }, badgeLabel),
          ),
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
        waiting
          ? h(
              'div',
              { className: 'skb-note skb-note--waiting' },
              `${
                waiting === 'question' && task.waitingQuestion
                  ? `${t('card.waiting_question')}：${task.waitingQuestion}`
                  : t(`card.waiting_${waiting}`)
              } · ${t('card.waiting_hint')}`,
            )
          : null,
        task.lastReport && task.lastReport.summary
          ? h(
              'div',
              { className: `skb-note ${task.lastReport.status === 'success' ? 'skb-note--ok' : 'skb-note--error'}` },
              `${t('card.report')}：${task.lastReport.summary}`,
            )
          : null,
        task.lastReport && task.lastReport.evidence && task.lastReport.evidence.length > 0
          ? h('div', { className: 'skb-note' }, `${t('card.evidence')}：${task.lastReport.evidence.join('；')}`)
          : null,
        task.acceptanceCriteria
          ? h('div', { className: 'skb-note' }, `${t('card.acceptance')}：${task.acceptanceCriteria}`)
          : null,
        task.needsConfirm ? h('div', { className: 'skb-note skb-note--waiting' }, t('card.needs_confirm')) : null,
        task.runs && task.runs.length > 1
          ? h(
              'div',
              { className: 'skb-runs' },
              ...task.runs
                .slice(-3)
                .reverse()
                .map((run) =>
                  h(
                    'div',
                    { key: run.id, className: 'skb-runs-row' },
                    h('b', null, `${t('card.latest_run')} #${run.attempt || 1}`),
                    h('span', null, `${t(`run.${run.status}`)} · ${formatTime(run.startedAt)}`),
                    run.files && run.files.length > 0 ? h('span', null, run.files.slice(0, 2).join('、')) : null,
                  ),
                ),
            )
          : null,
        task.status === 'interrupted' && task.interruptReason
          ? h('div', { className: 'skb-note skb-note--error' }, task.interruptReason)
          : null,
        pendingOnInterrupted
          ? h(
              'div',
              { className: 'skb-note skb-note--waiting' },
              `${
                pendingOnInterrupted === 'question' && task.waitingQuestion
                  ? `${t('card.waiting_question')}：${task.waitingQuestion}`
                  : t(`card.waiting_${pendingOnInterrupted}`)
              } · ${t('card.waiting_interrupted_hint')}`,
            )
          : null,
        task.status === 'running' && task.retryAt
          ? h('div', { className: 'skb-note' }, `${t('status.running')} · ${formatTime(task.retryAt)}`)
          : null,
        h(
          'div',
          { className: 'skb-card-actions' },
          task.needsConfirm
            ? h(
                'button',
                {
                  type: 'button',
                  className: 'skb-btn skb-btn--tiny skb-btn--primary',
                  disabled: busy,
                  onClick: () => props.onAck(task),
                },
                t('card.ack'),
              )
            : null,
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
          task.sessionId
            ? h(
                'button',
                {
                  type: 'button',
                  className: 'skb-btn skb-btn--tiny skb-btn--ghost',
                  disabled: busy,
                  onClick: () => props.onOpenSession(task.sessionId),
                },
                t('action.open_session'),
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
      const [acceptance, setAcceptance] = React.useState(task ? task.acceptanceCriteria || '' : '')
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
            acceptanceCriteria: acceptance.trim(),
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
            { className: 'skb-field' },
            h('label', null, t('field.acceptance')),
            h('textarea', {
              value: acceptance,
              placeholder: t('field.acceptance.placeholder'),
              style: { minHeight: '68px' },
              onChange: (event) => setAcceptance(event.target.value),
            }),
            h('div', { className: 'skb-hint' }, t('field.acceptance.hint')),
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
            task && task.sessionId
              ? h(
                  'button',
                  {
                    type: 'button',
                    className: 'skb-btn skb-btn--ghost',
                    style: { marginRight: 'auto' },
                    onClick: () => {
                      props.onClose()
                      if (typeof props.onOpenSession === 'function') props.onOpenSession(task.sessionId)
                    },
                  },
                  t('action.open_session'),
                )
              : null,
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

      const load = React.useCallback(() => boardFeed.load(), [])

      React.useEffect(() => {
        mounted.current = true
        const unsubscribe = boardFeed.subscribe((feed) => {
          if (!mounted.current) return
          if (feed.error) {
            const message = `${t('error.load')}：${feed.error}`
            if (lastLoadError.current !== message) {
              lastLoadError.current = message
              showToast({ tone: 'error', text: message, timeout: 8000 })
            }
            return
          }
          setData(feed.data)
          lastLoadError.current = ''
        })
        const onVisibility = () => {
          if (typeof document !== 'undefined' && document.visibilityState === 'visible') boardFeed.load()
        }
        if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisibility)
        return () => {
          mounted.current = false
          unsubscribe()
          if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisibility)
        }
      }, [t])

      const act = React.useCallback(async (action, payload) => {
        setBusy(true)
        try {
          return await postAction(action, payload)
        } finally {
          setBusy(false)
        }
      }, [])

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

      // 打开任务会话属于界面导航，交给宿主服务处理；插件只负责把会话 id 传出去。
      function openSession(sessionId) {
        if (typeof props.onOpenSession === 'function') props.onOpenSession(sessionId)
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

      async function acknowledge(task) {
        try {
          await act('acknowledge', { id: task.id })
          showToast({ tone: 'success', text: t('toast.acknowledged') })
        } catch (err) {
          showToast({ tone: 'error', text: `${t('error.action')}：${err && err.message ? err.message : String(err)}` })
        }
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
                  onOpenSession: openSession,
                  onAck: acknowledge,
                }),
              ),
        )
      }

      return h(
        'div',
        { className: 'skb-page' },
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
                      onOpenSession: openSession,
                  onAck: acknowledge,
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
              onOpenSession: openSession,
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

    // 样式在插件装载时注入一次，挂在 document.head 上：切到聊天页、看板页面被卸载后，
    // 会话输入框上方的待确认卡片仍然有样式可用。
    const STYLE_ID = 'shanhai-kanban-styles'

    function mountStyles() {
      if (typeof document === 'undefined' || !document.head) return () => {}
      if (document.getElementById(STYLE_ID)) return () => {}
      const element = document.createElement('style')
      element.id = STYLE_ID
      element.textContent = CSS
      document.head.appendChild(element)
      return () => {
        if (element.parentNode) element.parentNode.removeChild(element)
      }
    }

    function apply(ctx) {
      ctx.effect(() => mountStyles())
      ctx.effect(() => ctx.locale.register(NS, { zh, en }))
      const t = ctx.locale.bind(NS)

      // 会话跳转走宿主提供的可选服务：宿主没有这个能力时只提示，不影响看板其他功能。
      const openSession = (sessionId) => {
        if (!sessionId) {
          showToast({ tone: 'error', text: t('toast.session_missing') })
          return
        }
        const workspace = typeof ctx.get === 'function' ? ctx.get('uiWorkspace') : null
        if (!workspace || typeof workspace.openSession !== 'function') {
          showToast({ tone: 'error', text: t('toast.session_unavailable') })
          return
        }
        try {
          workspace.openSession(sessionId)
        } catch (err) {
          showToast({ tone: 'error', text: `${t('error.action')}：${err && err.message ? err.message : String(err)}` })
        }
      }
      ctx.slots.inject('sidebar.panellist', () =>
        ctx.slots.register(
          { name: 'sidebar.panellist', id: SLOT_ID, order: 20, label: () => t('sidebar.label') },
          (props) => h(KanbanIcon, { size: props && props.size, active: props && props.active }),
        ),
      )
      ctx.slots.inject('main', () =>
        ctx.slots.register({ name: 'main', key: SLOT_ID }, () => h(KanbanPage, { t, onOpenSession: openSession })),
      )
      // 会话输入框上方的待确认卡片：任务跑到终态、这一轮还没确认时出现。
      ctx.slots.inject('conversation.input.dock', () =>
        ctx.slots.register(
          { name: 'conversation.input.dock', id: 'shanhai-kanban-confirm', order: 30 },
          (props) => h(SessionDockCard, { sessionId: props && props.sessionId, t }),
        ),
      )
      ctx.slots.inject('shell.overlay', () =>
        ctx.slots.register({ name: 'shell.overlay', id: 'shanhai-kanban-toasts', order: 95 }, () => h(ToastHost)),
      )
    }

    module.exports = { inject: ['slots', 'locale'], apply, KanbanPage, KanbanIcon, ToastHost, SessionDockCard, TaskCard }
    return module.exports
  },
})
