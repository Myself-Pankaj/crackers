import { isBillViewerUrl } from '../src/viewerUrl.ts'
import { isShortPdfUrl } from '../src/shortUrl.ts'
const cache = new Map(), pending = new Map()
let active = 0
const queue = []
async function acquire() { if (active >= 5) await new Promise(resolve => queue.push(resolve)); else active++ }
function release() { const next = queue.shift(); if (next) next(); else active-- }
let cooldownUntil = 0
export async function shortenPdfUrl(pdfUrl, { fetcher = fetch, targetUrl = pdfUrl } = {}) {
  if (targetUrl !== pdfUrl && !isBillViewerUrl(targetUrl, pdfUrl)) return undefined
  if (cache.has(targetUrl)) return cache.get(targetUrl)
  if (pending.has(targetUrl)) return pending.get(targetUrl)
  if (Date.now() < cooldownUntil) return undefined
  const task = (async () => {
    await acquire()
    try {
      if (Date.now() < cooldownUntil) return undefined
      const url = new URL(pdfUrl)
      if (url.protocol !== 'https:' || url.hostname !== 'res.cloudinary.com') return undefined
      const request = new URL('https://is.gd/create.php')
      request.searchParams.set('format', 'json'); request.searchParams.set('url', targetUrl)
      const response = await fetcher(request.href, { signal: AbortSignal.timeout(8000) })
      const result = await response.json()
      if (result.errorcode === 3 || response.status === 429) cooldownUntil = Date.now() + 60000
      if (!response.ok || !isShortPdfUrl(result.shorturl)) return undefined
      if (cache.size >= 500) cache.delete(cache.keys().next().value)
      cache.set(targetUrl, result.shorturl)
      return result.shorturl
    } catch { return undefined }
    finally { release() }
  })()
  pending.set(targetUrl, task)
  try { return await task } finally { pending.delete(targetUrl) }
}
