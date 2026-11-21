// Headless UI check for the Shanhai Kanban plugin.
//
// The DSH web GUI rejects unauthenticated browsers, so pass the tokenized URL
// printed by the desktop app (or obtained from the host's connection service):
//   KANBAN_GUI_URL="http://127.0.0.1:11232/?token=..." node tests/ui-check.mjs
// Optional: KANBAN_CDP_PORT, KANBAN_BROWSER, KANBAN_SHOT.
//
// Launches Edge/Chrome headless with CDP, opens the local DSH web GUI,
// clicks the "任务看板" sidebar entry, and screenshots the board page.
import { spawn } from 'node:child_process'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const GUI_URL = process.env.KANBAN_GUI_URL || 'http://127.0.0.1:11232'
const PORT = Number(process.env.KANBAN_CDP_PORT || 9333)
const BROWSER =
  process.env.KANBAN_BROWSER || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const OUT = process.env.KANBAN_SHOT || join(tmpdir(), 'kanban-ui-check.png')

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function httpJson(url) {
  const response = await fetch(url)
  return response.json()
}

async function waitForTarget(timeoutMs) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const targets = await httpJson(`http://127.0.0.1:${PORT}/json/list`)
      const page = targets.find(
        (item) => item.type === 'page' && item.url && item.url.includes('127.0.0.1:11232'),
      )
      if (page && page.webSocketDebuggerUrl) return page
    } catch {}
    await sleep(300)
  }
  throw new Error('CDP target not found')
}

class Cdp {
  constructor(ws) {
    this.ws = ws
    this.nextId = 0
    this.pending = new Map()
    ws.onmessage = (event) => {
      const message = JSON.parse(event.data)
      const resolve = this.pending.get(message.id)
      if (resolve) {
        this.pending.delete(message.id)
        resolve(message)
      }
    }
  }
  static async connect(url) {
    const ws = new WebSocket(url)
    await new Promise((resolve, reject) => {
      ws.onopen = resolve
      ws.onerror = () => reject(new Error('CDP socket failed'))
    })
    return new Cdp(ws)
  }
  send(method, params = {}) {
    const id = ++this.nextId
    return new Promise((resolve, reject) => {
      this.pending.set(id, (message) => {
        if (message.error) reject(new Error(`${method}: ${message.error.message}`))
        else resolve(message.result)
      })
      this.ws.send(JSON.stringify({ id, method, params }))
    })
  }
  async evaluate(expression) {
    const result = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    })
    if (result.exceptionDetails) {
      throw new Error(`evaluate failed: ${result.exceptionDetails.text}`)
    }
    return result.result.value
  }
}

async function main() {
  const profile = await mkdtemp(join(tmpdir(), 'kanban-ui-'))
  const browser = spawn(
    BROWSER,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      `--remote-debugging-port=${PORT}`,
      `--user-data-dir=${profile}`,
      '--window-size=1440,900',
      GUI_URL,
    ],
    { stdio: 'ignore' },
  )

  try {
    const target = await waitForTarget(20000)
    const cdp = await Cdp.connect(target.webSocketDebuggerUrl)
    await cdp.send('Page.enable')
    await cdp.send('Runtime.enable')

    // Wait until the SPA has rendered the sidebar and settled.
    let ready = false
    for (let attempt = 0; attempt < 120; attempt += 1) {
      ready = await cdp.evaluate(
        "document.readyState === 'complete' && document.querySelectorAll('svg').length > 3",
      )
      if (ready) break
      await sleep(250)
    }
    if (!ready) {
      const diag = await cdp.evaluate(`(() => ({
        readyState: document.readyState,
        title: document.title,
        svgCount: document.querySelectorAll('svg').length,
        bodyText: (document.body && document.body.innerText || '').slice(0, 800),
      }))()`)
      console.log('DIAG:', JSON.stringify(diag))
      const failShot = await cdp.send('Page.captureScreenshot', { format: 'png' })
      const failPath = OUT.replace(/\.png$/, '-fail.png')
      await writeFile(failPath, Buffer.from(failShot.data, 'base64'))
      console.log('FAIL_SCREENSHOT:', failPath)
      throw new Error('GUI did not become ready')
    }

    // Dismiss the first-run "预览版说明" notice if it blocks the UI.
    await cdp.evaluate(`(() => {
      const buttons = [...document.querySelectorAll('button')]
      const more = buttons.find((b) => (b.textContent || '').trim() === '继续')
      if (more && (document.body.innerText || '').includes('预览版说明')) { more.click(); return true }
      return false
    })()`)
    await sleep(800)

    const sidebar = await cdp.evaluate(`(() => {
      const all = [...document.querySelectorAll('*')]
      const hits = all.filter((el) => {
        const text = (el.getAttribute('aria-label') || '') + ' ' + (el.getAttribute('title') || '') + ' ' + (el.textContent || '')
        return text.includes('任务看板') && el.childElementCount <= 3
      })
      return {
        count: hits.length,
        hits: hits.slice(0, 10).map((el) => ({
          tag: el.tagName,
          cls: typeof el.className === 'string' ? el.className.slice(0, 80) : '',
          aria: el.getAttribute('aria-label'),
          title: el.getAttribute('title'),
          text: (el.textContent || '').trim().slice(0, 40),
        })),
      }
    })()`)
    console.log('SIDEBAR_ENTRY:', JSON.stringify(sidebar))

    if (sidebar.count === 0) {
      const sample = await cdp.evaluate(`(() => {
        const buttons = [...document.querySelectorAll('[role="button"], button, a')]
        return buttons.slice(0, 40).map((el) => ({
          aria: el.getAttribute('aria-label'),
          title: el.getAttribute('title'),
          text: (el.textContent || '').trim().slice(0, 30),
        }))
      })()`)
      console.log('BUTTONS:', JSON.stringify(sample))
      throw new Error('sidebar entry 任务看板 not found')
    }

    const clicked = await cdp.evaluate(`(() => {
      const interactive = [...document.querySelectorAll('button, [role="button"], a')]
      const all = [...document.querySelectorAll('*')]
      const matches = (candidate) => {
        const text = (candidate.getAttribute('aria-label') || '') + ' ' + (candidate.getAttribute('title') || '') + ' ' + (candidate.textContent || '')
        return text.includes('任务看板') && candidate.childElementCount <= 3
      }
      const el = interactive.find(matches) || all.find(matches)
      if (!el) return false
      el.click()
      return true
    })()`)
    if (!clicked) throw new Error('click failed')

    let pageState = null
    for (let attempt = 0; attempt < 30; attempt += 1) {
      pageState = await cdp.evaluate(`(() => {
        const page = document.querySelector('.skb-page')
        return {
          hasPage: Boolean(page),
          hasBoard: Boolean(document.querySelector('.skb-board')),
          hasNewButton: [...document.querySelectorAll('button')].some((b) => (b.textContent || '').includes('新建任务')),
          bodyText: page ? page.innerText.slice(0, 300) : '',
        }
      })()`)
      if (pageState.hasPage && pageState.hasNewButton) break
      await sleep(300)
    }
    console.log('PAGE_STATE:', JSON.stringify(pageState))

    // Optional: switch to one status tab so a filtered view can be inspected.
    const TAB = process.env.KANBAN_TAB
    if (TAB) {
      const switched = await cdp.evaluate(`(() => {
        const button = [...document.querySelectorAll('.skb-tab')].find((el) => (el.textContent || '').trim() === ${JSON.stringify(TAB)})
        if (!button) return false
        button.click()
        return true
      })()`)
      if (!switched) throw new Error(`tab ${TAB} not found`)
      await sleep(600)
    }

    // The desktop preview notice may pop up again; keep the screenshot clean.
    await cdp.evaluate(`(() => {
      const buttons = [...document.querySelectorAll('button')]
      const more = buttons.find((b) => (b.textContent || '').trim() === '继续')
      if (more && (document.body.innerText || '').includes('预览版说明')) { more.click(); return true }
      return false
    })()`)
    await sleep(500)

    // Wait for the board data to arrive before measuring/screenshotting.
    for (let attempt = 0; attempt < 60; attempt += 1) {
      const loaded = await cdp.evaluate(
        "Boolean(document.querySelector('.skb-board, .skb-list')) || (Boolean(document.querySelector('.skb-empty')) && !(document.body.innerText || '').includes('提交中'))",
      )
      if (loaded) break
      await sleep(250)
    }

    const bodyText = await cdp.evaluate(
      "((document.querySelector('.skb-page') || document.body).innerText || '').slice(0, 1200)",
    )
    console.log('BODY_TEXT:', JSON.stringify(bodyText))

    const columns = await cdp.evaluate(`(() => {
      const board = document.querySelector('.skb-board')
      const cols = [...document.querySelectorAll('.skb-col')].map((el) => Math.round(el.getBoundingClientRect().width))
      return {
        cols,
        boardWidth: board ? Math.round(board.getBoundingClientRect().width) : null,
        grid: board ? getComputedStyle(board).gridTemplateColumns : null,
      }
    })()`)
    console.log('COLUMN_WIDTHS:', JSON.stringify(columns))

    const shot = await cdp.send('Page.captureScreenshot', { format: 'png' })
    await writeFile(OUT, Buffer.from(shot.data, 'base64'))
    console.log('SCREENSHOT:', OUT)
    if (!pageState.hasPage) throw new Error('kanban page not rendered')
    console.log('UI_CHECK: OK')
  } finally {
    browser.kill()
  }
}

main().catch((error) => {
  console.error('UI_CHECK: FAILED —', error.message)
  process.exitCode = 1
})
