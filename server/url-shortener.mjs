import { isBillViewerUrl } from '../src/viewerUrl.ts'
import { isShortPdfUrl } from '../src/shortUrl.ts'
const cache = new Map(), pending = new Map()
let active = 0
const queue = []
async function acquire() { if (active >= 5) await new Promise(resolve => queue.push(resolve)); else active++ }
function release() { const next = queue.shift(); if (next) next(); else active-- }
let cooldownUntil = 0
export async function shortenPdfUrl(pdfUrl, { fetcher = fetch, targetUrl = pdfUrl, env = process.env } = {}) {
  const domain = env.VITE_SHORT_IO_DOMAIN?.trim().toLowerCase()
  const apiKey = env.SHORT_IO_API_KEY?.trim()
  if (!apiKey || !domain || !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?[.])+[a-z]{2,63}$/.test(domain)) return undefined
  const cacheKey = `${domain}\n${targetUrl}`
  if (targetUrl !== pdfUrl && !isBillViewerUrl(targetUrl, pdfUrl)) return undefined
  if (cache.has(cacheKey)) return cache.get(cacheKey)
  if (pending.has(cacheKey)) return pending.get(cacheKey)
  if (Date.now() < cooldownUntil) return undefined
  const task = (async () => {
    await acquire()
    try {
      if (Date.now() < cooldownUntil) return undefined
      const url = new URL(pdfUrl)
      if (url.protocol !== 'https:' || url.hostname !== 'res.cloudinary.com') return undefined
      const response = await fetcher('https://api.short.io/links', {
        method: 'POST',
        headers: { Authorization: apiKey, Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain, originalURL: targetUrl, allowDuplicates: false }),
        signal: AbortSignal.timeout(8000),
      })
      if (response.status === 429) cooldownUntil = Date.now() + 60000
      const result = await response.json()
      if (!response.ok || !isShortPdfUrl(result.shortURL, domain) || new URL(result.shortURL).hostname !== domain) return undefined
      if (cache.size >= 500) cache.delete(cache.keys().next().value)
      cache.set(cacheKey, result.shortURL)
      return result.shortURL
    } catch { return undefined }
    finally { release() }
  })()
  pending.set(cacheKey, task)
  try { return await task } finally { pending.delete(cacheKey) }
}
