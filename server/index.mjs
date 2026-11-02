import { createServer } from 'node:http'
import { createReadStream, existsSync, statSync } from 'node:fs'
import { resolve, extname, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createBillPdfHandler } from './bill-pdf.mjs'
const root = fileURLToPath(new URL('../', import.meta.url))
for (const name of ['.env', '.env.local']) { const file = resolve(root, name); if (existsSync(file)) process.loadEnvFile(file) }
const dist = resolve(root, 'dist')
const upload = createBillPdfHandler()
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' }
createServer(async (req, res) => {
  let url
  try { url = new URL(req.url, 'http://localhost') } catch { res.writeHead(400); res.end(); return }
  if (url.pathname === '/api/bills/pdf') { await upload(req, res); return }
  if (url.pathname.startsWith('/api/')) { res.writeHead(404); res.end(); return }
  if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); res.end(); return }
  let requested
  try { requested = resolve(dist, `.${decodeURIComponent(url.pathname)}`) } catch { res.writeHead(400); res.end(); return }
  if (!requested.startsWith(dist + sep) && requested !== dist) { res.writeHead(403); res.end(); return }
  const file = existsSync(requested) && statSync(requested).isFile() ? requested : resolve(dist, 'index.html')
  if (!existsSync(file)) { res.writeHead(503); res.end('Build the app first with pnpm build.'); return }
  res.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff' })
  if (req.method === 'HEAD') res.end(); else createReadStream(file).pipe(res)
}).listen(Number(process.env.PORT) || 3000, process.env.HOST || '127.0.0.1', () => console.log(`Hari Om app: http://${process.env.HOST || '127.0.0.1'}:${process.env.PORT || 3000}`))
