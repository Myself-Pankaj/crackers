import { isShortPdfUrl } from '../src/shortUrl.ts'
const cache = new Map(), pending = new Map()
let active = 0
const queue = []
async function acquire() { if (active >= 5) await new Promise(resolve => queue.push(resolve)); else active++ }
function release() { const next = queue.shift(); if (next) next(); else active-- }
let cooldownUntil = 0
export async function shortenPdfUrl(pdfUrl, { fetcher = fetch } = {}) {
  if (cache.has(pdfUrl)) return cache.get(pdfUrl)
  if (pending.has(pdfUrl)) return pending.get(pdfUrl)
  if (Date.now() < cooldownUntil) return undefined
  const task = (async () => {
    await acquire()
    try {
      if (Date.now() < cooldownUntil) return undefined
      const url = new URL(pdfUrl)
      if (url.protocol !== 'https:' || url.hostname !== 'res.cloudinary.com') return undefined
      const request = new URL('https://is.gd/create.php')
      request.searchParams.set('format', 'json'); request.searchParams.set('url', pdfUrl)
      const response = await fetcher(request.href, { signal: AbortSignal.timeout(8000) })
      const result = await response.json()
      if (result.errorcode === 3 || response.status === 429) cooldownUntil = Date.now() + 60000
      if (!response.ok || !isShortPdfUrl(result.shorturl)) return undefined
      if (cache.size >= 500) cache.delete(cache.keys().next().value)
      cache.set(pdfUrl, result.shorturl)
      return result.shorturl
    } catch { return undefined }
    finally { release() }
  })()
  pending.set(pdfUrl, task)
  try { return await task } finally { pending.delete(pdfUrl) }
}
