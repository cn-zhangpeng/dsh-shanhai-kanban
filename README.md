# dsh-shanhai-kanban

DeepSeek Harness 任务看板插件（山海紫穹系列）。

在 DSH 侧边栏加一个「任务看板」入口：提前创建任务、设定执行时间，从 DSH 已有工作区里
选择工作区，并把任务挂到上游任务后面串行执行。到点自动开始；DSH 当时没开会在下次启动
后补跑；中断后可继续，限流/网络等瞬时错误自动重试。

## 特性

- **预建 + 定时**：任务先「计划中」，到执行时间且上游已成功（无上游则直接）自动开始
- **工作区绑定**：从 DSH 已有的工作区列表中选择；选择上游后工作区自动继承上游
- **串行编排**：任务可挂上游任务，复用上游会话串行执行；校验循环依赖与自依赖
- **中断继续**：失败、阻塞、用户中止、token 上限等都会记为「已中断」，点「继续」接着跑；
  在任务会话里手动回复/选择后也会自动回到「执行中」
- **自动补跑**：DSH 未运行时错过的执行时间，下次启动后由调度器补跑
- **瞬时错误重试**：限流（429）、超时、网络错误、5xx 等自动重试，最多 3 次尝试
  （间隔 30 秒 / 2 分钟，可用 `DSH_KANBAN_RETRY_DELAYS` 覆盖）
- **权限预设**：每个任务可指定 DSH 权限预设，默认优先 `danger-full-access`，没有时回落
  到 DSH 默认预设
- **收尾上报**：任务会话内注册 `kanban_report` 工具，模型完成/失败/需要人工时上报一句话
  结论；完成但没上报会记为「已中断（未上报结果）」
- **会话联动**：归档/删除任务时连带归档它的执行会话（与其他未归档任务共享会话时保留）
- **中英双语**：文案跟随 DSH 全局语言；深浅色主题自适应（使用 DSW 设计变量）
- **本地持久化**：任务保存在 `%DSH_HOME%\shanhai-kanban\tasks.json`，临时文件 + rename
  原子写入，避免半截文件

## 使用

1. 打开侧边栏的「任务看板」图标。
2. 「新建任务」：填写任务名称、任务内容、工作区、执行时间；需要串行时选择上游任务
   （选择上游后工作区自动继承上游）。
3. 到执行时间且上游已成功（无上游则直接）自动开始；DSH 当时没开会，下次启动后补跑。
4. 看板每 2 秒刷新一次；「全部 / 已归档」两个标签页切换。

### 状态

| 状态 | 含义 |
|---|---|
| 计划中 `planned` | 等待执行时间 / 等待上游任务成功 |
| 执行中 `running` | 会话正在跑任务；若会话停在提问或权限审批上，卡片会显示「等待你回答 / 等待审批」 |
| 已中断 `interrupted` | 等人工、任务失败、执行出错、未上报结果或被取消；点「继续」可续跑 |
| 已成功 `succeeded` | 任务显式上报 `success`，解锁下游任务 |
| 已归档 `archived` | 从看板主视图收起 |

「等待你回答 / 等待审批」不是中断：任务仍然是执行中，你在会话里回答或批准后会自动继续。
「继续」会先取消执行会话的归档状态——会话若被用户在侧边栏删除/归档，回合会被内核直接拒绝，
表现为「回合阻塞」且没有任何执行步骤。

任务会话结束前必须调用 `kanban_report` 工具上报结果；回合正常结束但没上报，会记为
「已中断（未上报结果）」，而不是成功。

## 执行规则

- 一次运行 = 一个会话；无上游任务时新建会话，有上游任务时复用上游会话串行执行。
- 任务只有在 `planned` 状态且到达执行时间时才会启动；启动后会重置尝试次数与中断原因。
- 每个任务可设置权限预设，默认优先完全权限（`danger-full-access`）。
- 瞬时错误（限流、超时、网络、5xx 等）自动重试，最多 3 次尝试（含首次执行）；
  需要人工处理的情况不重试，直接中断。
- 上游任务未成功时，下游任务保持「计划中」，不会提前启动。
- 有未归档下游任务时，上游任务不能归档或删除。
- 任务开始执行后不能再编辑内容（只能编辑「计划中」的任务）。

## 兼容性

| 项目 | 范围 | 说明 |
|---|---|---|
| DSH | `>=0.2.0 <0.3.0`（`package.json` `engines.dsh`） | 验证基线：DSH 0.2.2-rc.5 |
| Node.js | `>=24.9.0`（`package.json` `engines.node`） | 与 DSH 运行时要求一致 |
| 第三方运行依赖 | 无 | 只用 DSH 注入的 `webServer` / `tools` / `sessions` / `sessionController` / `workspaceRegistry`，以及可选的 `permissionPresets` |

`engines.dsh` 由 DSH 安装器与 profile 启动检查：运行中的 DSH 不满足该范围时，安装或启动
会被拒绝。

## 权限与边界

| 能力 | 声明 | 具体行为 |
|---|---|---|
| 文件 | 仅任务数据 | Host 半只读写 `%DSH_HOME%\shanhai-kanban\tasks.json`；先写 `.tmp` 再 `rename`，不触碰其他文件 |
| 网络 | 仅同源本地 API | 在 DSH 的 `webServer` 上注册 `GET /api/shanhai-kanban/state` 与 `POST /api/shanhai-kanban/action`；Client 半用同源 `fetch` 调用，不访问外部域名 |
| 命令 | 无 | 不执行子进程或 shell 命令 |
| 凭据 | 无 | 不读取凭据文件或模型 API Key；仅读取可选的 `DSH_KANBAN_*` 调度配置与 `DSH_HOME` |
| 外部服务 | 无 | 不需要任何外部 API、数据库或云服务 |
| 失败边界 | 局部降级 | `webServer` 不可用时插件不启动；调度/保存异常只记录日志，不阻塞 DSH；单个任务出错只影响该任务 |

## 安装

### 方式一：插件命令（推荐）

本插件为私有本地包，直接按目录安装（profile 内以 `link:` 方式引用）：

```bash
dsh plugin --profile desktop add <本目录路径>
```

更新 / 卸载：

```bash
dsh plugin --profile desktop update dsh-shanhai-kanban
dsh plugin --profile desktop remove dsh-shanhai-kanban
```

安装后重启 DSH，侧边栏即出现「任务看板」入口。

### 方式二：手动部署 / 本地调试

1. 将本目录软链接（junction）到你的 DSH 插件目录；
2. 用 `cordis.patch.yml` 以覆盖层方式启动 Web UI：

   ```bash
   pnpm dsh web --patch ./cordis.patch.yml
   ```

3. 打开 DSH Web 界面，点侧边栏「任务看板」。

> 改完 Host 代码后，用 `plugin_manager` 对 `include:shanhai-kanban` 禁用再启用即可热重载；
> Client 改动刷新页面生效。
>
> 参考官方文档：[第一个插件](https://deepseek-harness.github.io/deepseek-harness/develop/basic/)

## 架构

```
Host 半（index.js）
  webServer / tools / sessions / sessionController / workspaceRegistry 注入
  → createStore：tasks.json 内存 Map + 防抖原子落盘
  → 15s tick 调度：到点 + 上游成功 → 创建/复用会话并发送任务 prompt
  → session/event 事件：turn/start 拉回执行中，turn/end 推进状态机与重试
  → HTTP：GET /api/shanhai-kanban/state、POST /api/shanhai-kanban/action
  → 注册收尾工具 kanban_report（仅任务执行会话可见）

Client 半（client.js）
  window.__ModuleLoader__ 装载
  → sidebar.panellist：「任务看板」入口
  → main 面板：任务列表 / 新建 / 编辑 / 立即执行 / 继续 / 取消 / 归档 / 删除
  → 每 2s 轮询 state 接口
```

## 数据与存储

| 项目 | 说明 |
|---|---|
| 文件路径 | `%DSH_HOME%\shanhai-kanban\tasks.json`；未设置 `DSH_HOME` 时默认 `~/.dsh` |
| 数据格式 | `{ "version": 1, "tasks": [...] }` |
| 写入方式 | 内存 `Map` + 60ms 防抖，临时文件写入后 `rename` 覆盖 |
| 调度周期 | 默认 15 秒，可用 `DSH_KANBAN_TICK_MS` 调整（最小 100ms） |
| 重试间隔 | 默认 `30s, 2m, 5m`，可用 `DSH_KANBAN_RETRY_DELAYS` 覆盖 |

每条任务记录包含名称、内容、工作区、上游任务、执行时间、权限预设、状态、执行会话、
尝试次数、重试时间、最后错误、最后上报与中断原因等字段。

## 目录

```
dsh-shanhai-kanban/
  package.json        # 插件元信息、engines 兼容范围与打包配置
  cordis.patch.yml    # 插件注册补丁（Host + Client 同一插件条目）
  index.js            # Host 半：存储、调度、状态机、HTTP 接口、kanban_report
  client.js           # Client 半：侧边栏入口 + 看板整页
  icon.svg            # 侧边栏图标
  locale/             # 中英文插件元信息
  tests/              # Host/Client 冒烟测试与无头 UI 检查
```

## 开发

```bash
node --check index.js
node --check client.js
npm test                  # = node tests/smoke-host.mjs && node tests/smoke-client.mjs
```

- `tests/smoke-host.mjs`：任务状态机、调度、重试、`kanban_report`、HTTP 接口与落盘。
- `tests/smoke-client.mjs`：浏览器模块工厂装载、locale、侧边栏/主面板注册与渲染。
- `tests/ui-check.mjs`：用无头 Chrome/Edge（CDP）打开 DSH Web GUI，点侧边栏「任务看板」
  并截图。DSH Web 需要鉴权，必须传入带 token 的地址：

  ```powershell
  $env:KANBAN_GUI_URL = 'http://127.0.0.1:11232/?token=...'
  node tests/ui-check.mjs
  ```

## 已知限制

- 暂不支持重复任务（v1 单次执行）。
- 有未归档下游任务时，上游任务不能归档或删除。
- 任务开始执行后不能再编辑内容（可编辑「计划中」的任务）。
- 状态与调度以 Host 进程内时间为准；DSH 长时间未启动时，错过的任务会在启动后补跑，
  但不会精确到原定时间点。

## License

MIT
