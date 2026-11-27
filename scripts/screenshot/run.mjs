#!/usr/bin/env node
/**
 * Regenerate README screenshot(s) with headless Firefox and no extra npm
 * dependencies. The demo data is the committed config.json (a normal app
 * export); videos, feed entries and thumbnails come from the live URLs in it.
 *
 *   node scripts/screenshot/run.mjs [main] [settings] [search] [mobile]
 */
import { createServer } from 'node:http'
import { spawn, spawnSync } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { tmpdir } from 'node:os'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '../..')
const DIST = join(ROOT, 'dist')
const CONFIG_PATH = join(HERE, 'config.json')
const HIDE_SCROLLBARS_PATH = join(HERE, 'hide-scrollbars.css')
const OUTPUT_DIR = join(ROOT, '.github')
const BASE = '/startpage'
const HOST = '127.0.0.1'
// The public API allowlists this origin (see startpage-api/src/access.ts).
const PORT = 5173
const GATE_TIMEOUT_MS = 30_000
const FIREFOX_TIMEOUT_MS = 90_000

const SCENARIOS = {
  main: { path: `${BASE}/`, width: 1400, height: 800, output: 'screenshot.webp' },
  settings: {
    path: `${BASE}/settings`,
    width: 1400,
    height: 800,
    output: 'screenshot-settings.webp',
  },
  search: {
    path: `${BASE}/?shot=search`,
    width: 1400,
    height: 800,
    output: 'screenshot-search.webp',
  },
  mobile: { path: `${BASE}/`, width: 400, height: 900, output: 'screenshot-mobile.webp' },
}

// Makes the page's own `prefers-color-scheme` dark rule apply, so the app's
// stylesheet stays the single source of truth for the screenshot's colors.
const DARK_PREF = 'user_pref("ui.systemUsesDarkTheme", 1);\n'
const GATE_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==',
  'base64',
)

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
}

function seedScript(config) {
  const seed = {
    config: config.config,
    bookmarks: config.bookmarks,
    channels: config.channels,
    feeds: config.feeds,
    status: { feed: { fetching: { now: [], max: 0 }, fetchedAt: 0 } },
  }

  return `(() => {
  const seed = ${JSON.stringify(seed, null, 2)}

  for (const [name, value] of Object.entries(seed)) {
    try {
      localStorage.setItem(name, JSON.stringify(value))
    } catch (error) {
      console.error('screenshot seed failed for', name, error)
    }
  }
})()
`
}

// Holds the page's load event until live channel/feed content has rendered,
// then gives it a moment to settle, so Firefox's built-in --screenshot never
// captures loading spinners.
const WAIT_SCRIPT = `(() => {
  const shot = new URLSearchParams(location.search).get('shot') || 'main'

  const started = Date.now()
  let timer = 0
  let settleTimer = 0
  let released = false
  let searchKeySentAt = 0
  let searchQuerySet = false
  const release = (reason) => {
    if (released) return
    released = true
    clearInterval(timer)
    clearTimeout(settleTimer)
    const url = reason ? '/stub/release?reason=' + encodeURIComponent(reason) : '/stub/release'
    fetch(url, { cache: 'no-store' }).catch(() => {})
  }

  timer = setInterval(() => {
    if (shot === 'search') {
      const input = document.querySelector('.palette__input')
      if (input) {
        if (!searchQuerySet) {
          searchQuerySet = true
          input.value = 'SciFun'
          input.dispatchEvent(new Event('input', { bubbles: true }))
        }
      } else if (!searchKeySentAt || Date.now() - searchKeySentAt > 500) {
        // The classic wait script runs before the app's module script, so the
        // first keypresses can land before a listener exists. Retry instead
        // of assuming the app has mounted within a fixed delay.
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 's', bubbles: true }))
        searchKeySentAt = Date.now()
      }

      if (!searchQuerySet && Date.now() - started > 10000) {
        release('search palette did not open after pressing the focus-search key')
        return
      }
    }

    const videos = document.querySelectorAll('.feed__item').length
    const entries = document.querySelectorAll('.feeds__entry').length
    const paletteReady =
      shot !== 'search' || !!document.querySelector('.palette__link, .palette__error')

    // Thumbnails are lazy-loaded and Image marks them \`.hidden\` while loading
    // or on error, so waiting for all of them would only reach the ceiling.
    // Give them an extra 1s after the live content appears instead (2s
    // total) so slow thumbnail responses are less likely to show as spinners.
    if (videos > 0 && entries > 0 && paletteReady && !settleTimer)
      settleTimer = setTimeout(release, 2000)

    if (Date.now() - started > 20000) release()
  }, 100)
})()
`

async function build() {
  const result = spawnSync('npm', ['run', 'build'], {
    cwd: ROOT,
    env: { ...process.env, VITE_GIT_COMMIT: 'screenshot' },
    stdio: 'inherit',
  })
  if (result.status !== 0) throw new Error(`npm run build failed (${result.status})`)
}

async function createScreenshotServer(config) {
  const seed = seedScript(config)
  const hideScrollbarsCss = readFileSync(HIDE_SCROLLBARS_PATH, 'utf8')
  let gateReleased = false
  let failure = null
  const gateWaiters = new Set()

  const releaseGate = () => {
    if (gateReleased) return
    gateReleased = true
    for (const waiter of [...gateWaiters]) waiter()
    gateWaiters.clear()
  }

  const respond = (res, status, body, type) => {
    if (res.writableEnded) return
    res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' })
    res.end(body)
  }

  const serveGate = (req, res) => {
    if (gateReleased) return respond(res, 200, GATE_PNG, 'image/png')

    const timeout = setTimeout(releaseGate, GATE_TIMEOUT_MS)
    const waiter = () => {
      clearTimeout(timeout)
      respond(res, 200, GATE_PNG, 'image/png')
    }
    gateWaiters.add(waiter)
    req.on('close', () => gateWaiters.delete(waiter))
  }

  const indexHtml = () => {
    let html = readFileSync(join(DIST, 'index.html'), 'utf8')
    html = html.replace(
      '<head>',
      '<head>\n    <link rel="stylesheet" href="/stub/hide-scrollbars.css" />\n' +
        '    <script src="/stub/seed.js"></script>',
    )
    html = html.replace(
      '</body>',
      '    <img src="/stub/gate" width="0" height="0" alt="" aria-hidden="true" />\n' +
        '    <script src="/stub/wait.js"></script>\n  </body>',
    )
    return html
  }

  const serveStatic = (pathname, res) => {
    let relative
    if (pathname === BASE || pathname === `${BASE}/`) relative = ''
    else if (pathname.startsWith(`${BASE}/`)) relative = pathname.slice(BASE.length + 1)
    else if (pathname === '/favicon.svg' || pathname === '/404.html') relative = pathname.slice(1)
    else return respond(res, 404, 'Not found', 'text/plain')

    const file = resolve(DIST, relative)
    if (file !== DIST && !file.startsWith(`${DIST}/`))
      return respond(res, 403, 'Forbidden', 'text/plain')

    if (!relative || !existsSync(file)) {
      if (pathname === BASE || pathname === `${BASE}/` || pathname.startsWith(`${BASE}/`))
        return respond(res, 200, indexHtml(), MIME['.html'])
      return respond(res, 404, 'Not found', 'text/plain')
    }

    respond(res, 200, readFileSync(file), MIME[extname(file)] || 'application/octet-stream')
  }

  const server = createServer((req, res) => {
    const url = new URL(req.url, `http://${HOST}:${PORT}`)
    const pathname = url.pathname

    if (pathname === '/stub/hide-scrollbars.css')
      return respond(res, 200, hideScrollbarsCss, MIME['.css'])
    if (pathname === '/stub/seed.js') return respond(res, 200, seed, MIME['.js'])
    if (pathname === '/stub/wait.js') return respond(res, 200, WAIT_SCRIPT, MIME['.js'])
    if (pathname === '/stub/gate') return serveGate(req, res)
    if (pathname === '/stub/release') {
      // The browser reports a failed scenario on the same request that releases
      // the load-event gate, so there is no race with a second report request.
      if (url.searchParams.has('reason')) failure = url.searchParams.get('reason')
      releaseGate()
      return respond(res, 204, '', 'text/plain')
    }

    return serveStatic(pathname, res)
  })

  await new Promise((done, fail) => {
    server.once('error', () => fail(new Error(`Port ${PORT} is busy; stop the dev server first`)))
    server.listen(PORT, HOST, done)
  })

  return {
    resetGate() {
      gateReleased = false
      failure = null
    },
    getFailure: () => failure,
    close: () => new Promise((done) => server.close(done)),
  }
}

async function capture(scenario) {
  const profile = await mkdtemp(join(tmpdir(), 'startpage-shot-'))
  await writeFile(join(profile, 'user.js'), DARK_PREF)
  const png = join(profile, 'shot.png')
  const args = [
    '--headless',
    '--no-remote',
    '--profile',
    profile,
    '--window-size',
    `${scenario.width},${scenario.height}`,
    '--screenshot',
    png,
    `http://${HOST}:${PORT}${scenario.path}`,
  ]

  let output = ''
  const child = spawn('firefox', args, { stdio: ['ignore', 'pipe', 'pipe'] })
  child.stdout.on('data', (chunk) => (output += chunk))
  child.stderr.on('data', (chunk) => (output += chunk))

  const timeout = setTimeout(() => child.kill('SIGKILL'), FIREFOX_TIMEOUT_MS)
  let code
  try {
    code = await new Promise((done, fail) => {
      child.once('error', (error) =>
        fail(new Error(`run firefox (is it installed and in PATH?): ${error.message}`)),
      )
      child.once('close', done)
    })
  } finally {
    clearTimeout(timeout)
  }

  if (code !== 0 || !existsSync(png)) {
    await rm(profile, { recursive: true, force: true })
    throw new Error(`Firefox screenshot failed (${code}):\n${output}`)
  }

  return { png, profile }
}

async function toWebP(png, webp) {
  const converted = spawnSync('cwebp', ['-quiet', '-lossless', '-o', webp, png], {
    encoding: 'utf8',
  })
  if (converted.error)
    throw new Error(`run cwebp (is it installed and in PATH?): ${converted.error.message}`)
  if (converted.status !== 0)
    throw new Error(
      `cwebp failed (${converted.status ?? converted.signal}): ${converted.stderr?.trim() ?? ''}`,
    )
}

async function main() {
  const requested = process.argv.slice(2).filter((arg) => !arg.startsWith('-'))
  const names = requested.length ? requested : ['main']
  const unknown = names.filter((name) => !(name in SCENARIOS))
  if (unknown.length) throw new Error(`Unknown screenshot scenario: ${unknown.join(', ')}`)

  const config = JSON.parse(await readFile(CONFIG_PATH, 'utf8'))
  for (const key of ['config', 'bookmarks', 'channels', 'feeds']) {
    if (!config[key]) throw new Error(`config.json is missing "${key}"`)
  }

  await build()
  const server = await createScreenshotServer(config)

  try {
    for (const name of names) {
      const scenario = SCENARIOS[name]
      server.resetGate()
      process.stdout.write(`Capturing ${name}...\n`)

      const { png, profile } = await capture(scenario)
      try {
        const reason = server.getFailure()
        if (reason) throw new Error(`Capturing ${name} failed: ${reason}`)
        const webp = join(OUTPUT_DIR, scenario.output)
        await toWebP(png, webp)
        process.stdout.write(`  wrote ${webp}\n`)
      } finally {
        await rm(profile, { recursive: true, force: true })
      }
    }
  } finally {
    await server.close()
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
