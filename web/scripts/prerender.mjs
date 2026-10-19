// Turns the built single-page app into static HTML that search engines and link previews can read.
//
// Run after `vite build` (npm run prerender). It serves dist/ locally, opens the home page in headless
// Chrome, follows every internal link to a public page, and saves each rendered page as
// dist/<path>/index.html. It also writes:
//   dist/spa.html     the untouched app shell, served for signed-in areas (admin, contractor dashboards)
//   dist/404.html     the "page not found" page, served with a 404 status for unknown addresses
//   dist/robots.txt   and dist/sitemap.xml (indexable pages only)
//
// The CloudFront function in infra/bootstrap.yaml maps requests onto these files; its SPA_ROUTES list
// must match SPA_ROUTES here.
//
// Environment:
//   VITE_SITE_URL   the public site's address (default https://dfwlawnpros.com)
//   SEO_INDEXABLE   "false" for non-production sites: robots.txt then blocks all crawling
//   CHROME_PATH     Chrome/Chromium executable (default: the usual install locations)
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer-core'

const DIST = fileURLToPath(new URL('../dist/', import.meta.url))
const SITE_URL = (process.env.VITE_SITE_URL || 'https://dfwlawnpros.com').replace(/\/$/, '')
const INDEXABLE = process.env.SEO_INDEXABLE !== 'false'

/** Served from the app shell, never prerendered: signed-in areas, per-visitor pages and the ad landing page. */
const SPA_ROUTES = /^\/(admin|contractor|login|thank-you|lawn-quote)(\/|$)/
const PRERENDERED_EXCEPTIONS = new Set(['/contractor/signup'])
const isSpaRoute = (path) => SPA_ROUTES.test(path) && !PRERENDERED_EXCEPTIONS.has(path)

const NOT_FOUND_PROBE = '/__prerender-not-found'

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.txt': 'text/plain',
}

function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  ]
  const found = candidates.find((p) => p && existsSync(p))
  if (!found) throw new Error('Chrome not found. Install Google Chrome or set CHROME_PATH.')
  return found
}

/** Serves dist/ like the live site: real files as-is, every other path gets the app shell. */
function serve(shell) {
  const server = createServer(async (req, res) => {
    const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname)
    const file = join(DIST, normalize(path))
    if (extname(path) && file.startsWith(DIST) && existsSync(file)) {
      res.writeHead(200, { 'content-type': TYPES[extname(path)] ?? 'application/octet-stream' })
      res.end(await readFile(file))
    } else {
      res.writeHead(200, { 'content-type': TYPES['.html'] })
      res.end(shell)
    }
  })
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)))
}

/** Internal links on the page, as normalized paths (no query, hash or trailing slash). */
const linksOn = (page) =>
  page.$$eval('a[href]', (anchors) =>
    anchors
      .map((a) => new URL(a.getAttribute('href'), location.href))
      .filter((u) => u.origin === location.origin)
      .map((u) => u.pathname.replace(/\/+$/, '') || '/'),
  )

async function render(page, origin, path) {
  const response = await page.goto(origin + path, { waitUntil: 'networkidle0', timeout: 30_000 })
  if (!response?.ok()) throw new Error(`${path}: HTTP ${response?.status()}`)
  await page.waitForFunction(() => document.getElementById('root')?.childElementCount > 0, { timeout: 10_000 })
  const html = '<!doctype html>\n' + (await page.evaluate(() => document.documentElement.outerHTML))
  const noindex = await page.$eval('head', (head) => !!head.querySelector('meta[name="robots"][content*="noindex"]'))
  return { html, noindex, links: await linksOn(page) }
}

const outFile = (path) => (path === '/' ? join(DIST, 'index.html') : join(DIST, path, 'index.html'))

async function main() {
  const shell = await readFile(join(DIST, 'index.html'), 'utf8')
  const server = await serve(shell)
  const origin = `http://127.0.0.1:${server.address().port}`
  const browser = await puppeteer.launch({ executablePath: findChrome(), headless: true, args: ['--no-sandbox'] })

  const pages = new Map() // path -> { html, noindex }
  let notFound
  try {
    const page = await browser.newPage()
    await page.setViewport({ width: 1280, height: 900 })
    // Tells the app it's being snapshotted (no analytics, no tracking calls; see IS_PRERENDER).
    await page.evaluateOnNewDocument(() => {
      window.__PRERENDER__ = true
    })
    // Only our own files load: no API, map, image, font or analytics requests. The HTML is what matters.
    await page.setRequestInterception(true)
    page.on('request', (req) => (req.url().startsWith(origin) ? req.continue() : req.abort()))
    page.on('pageerror', (err) => console.warn(`  page error: ${err.message}`))

    const queue = ['/']
    const seen = new Set(queue)
    while (queue.length) {
      const path = queue.shift()
      const result = await render(page, origin, path)
      pages.set(path, result)
      console.log(`  ${path}${result.noindex ? '  (noindex)' : ''}`)
      for (const link of result.links) {
        if (!seen.has(link) && !isSpaRoute(link) && !extname(link)) {
          seen.add(link)
          queue.push(link)
        }
      }
    }
    notFound = (await render(page, origin, NOT_FOUND_PROBE)).html
  } finally {
    await browser.close()
    server.close()
  }

  for (const [path, { html }] of pages) {
    await mkdir(join(outFile(path), '..'), { recursive: true })
    await writeFile(outFile(path), html)
  }
  await writeFile(join(DIST, 'spa.html'), shell)
  await writeFile(join(DIST, '404.html'), notFound)

  const indexable = [...pages].filter(([, p]) => !p.noindex).map(([path]) => path)
  await writeFile(
    join(DIST, 'sitemap.xml'),
    '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
      indexable.map((path) => `  <url><loc>${SITE_URL}${path === '/' ? '/' : path}</loc></url>`).join('\n') +
      '\n</urlset>\n',
  )
  await writeFile(
    join(DIST, 'robots.txt'),
    INDEXABLE
      ? `User-agent: *\nDisallow: /admin\nDisallow: /contractor/\nAllow: /contractor/signup\nDisallow: /login\nDisallow: /thank-you\n\nSitemap: ${SITE_URL}/sitemap.xml\n`
      : 'User-agent: *\nDisallow: /\n',
  )
  console.log(`Prerendered ${pages.size} pages (${indexable.length} in the sitemap), 404.html, spa.html, robots.txt.`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
