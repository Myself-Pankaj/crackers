import { test } from 'node:test'
import assert from 'node:assert/strict'
import { shortenPdfUrl } from '../server/url-shortener.mjs'
import { isShortPdfUrl, preferredPdfUrl } from '../src/shortUrl.ts'
import { savePublishedPdfLink, PdfLinkSaveError } from '../src/pdfPublication.ts'
const env = { SHORT_IO_API_KEY: 'shortio-test-key', VITE_SHORT_IO_DOMAIN: 'short.gy' }
const source = id => `https://res.cloudinary.com/demo/raw/upload/v1/${id}.pdf?x=1&y=2`

test('shortening preserves the full encoded destination and caches the result', async () => {
 let calls = 0
 const fetcher = async (request, options) => {
   calls++
   const url = new URL(request)
   assert.equal(url.href, 'https://api.short.io/links')
   assert.equal(options.method, 'POST')
   assert.equal(options.headers.Authorization, env.SHORT_IO_API_KEY)
   assert.equal(options.headers['Content-Type'], 'application/json')
   assert.equal(JSON.parse(options.body).domain, env.VITE_SHORT_IO_DOMAIN)
   assert.equal(JSON.parse(options.body).allowDuplicates, false)
   assert.equal(JSON.parse(options.body).originalURL, source('cached'))
   return Response.json({ shortURL: 'https://short.gy/bill123' })
 }
 assert.equal(await shortenPdfUrl(source('cached'), { fetcher, env }), 'https://short.gy/bill123')
 assert.equal(await shortenPdfUrl(source('cached'), { fetcher, env }), 'https://short.gy/bill123')
 assert.equal(calls, 1)
})
test('shortener failures leave the original PDF available', async () => {
 assert.equal(await shortenPdfUrl(source('down'), { env, fetcher: async () => { throw new Error('offline') } }), undefined)
 assert.equal(await shortenPdfUrl(source('invalid'), { env, fetcher: async () => Response.json({ shortURL: 'javascript:alert(1)' }) }), undefined)
 assert.equal(preferredPdfUrl({ pdfUrl: source('fallback') }), source('fallback'))
 assert.equal(preferredPdfUrl({ pdfUrl: source('fallback'), shortPdfUrl: 'https://short.gy/good123' }), 'https://short.gy/good123')
 assert.equal(isShortPdfUrl('https://is.gd.example.com/fake'), false)
})
test('concurrent requests for the same PDF create just one link', async () => {
 let calls = 0
 const fetcher = async () => { calls++; await new Promise(resolve => setTimeout(resolve, 5)); return Response.json({ shortURL: 'https://short.gy/once' }) }
 const values = await Promise.all(Array.from({ length: 5 }, () => shortenPdfUrl(source('concurrent'), { fetcher, env })))
 assert.equal(calls, 1)
 assert.deepEqual(new Set(values), new Set(['https://short.gy/once']))
})
test('short URL is saved with original metadata and survives a denied save', async () => {
 const link = { pdfUrl: source('metadata'), pdfPath: 'hariom phatak center/uid/HO-ID-abc.pdf', shortPdfUrl: 'https://short.gy/saved123' }
 let stored
 await savePublishedPdfLink(link, async fields => { stored = fields })
 assert.deepEqual(stored, link)
 await assert.rejects(savePublishedPdfLink(link, async () => { throw { code: 'permission-denied' } }), error => error instanceof PdfLinkSaveError && error.link.shortPdfUrl === link.shortPdfUrl)
})

test('missing or malformed Short.io settings skip provider calls', async () => {
 let calls = 0
 const fetcher = async () => { calls++; throw new Error('Must not fetch') }
 for (const config of [{}, { SHORT_IO_API_KEY: 'key' }, { ...env, VITE_SHORT_IO_DOMAIN: 'https://short.gy/path' }]) {
   assert.equal(await shortenPdfUrl(source('unconfigured'), { env: config, fetcher }), undefined)
 }
 assert.equal(calls, 0)
})
test('account domains are validated and cached separately', async () => {
 const pdfUrl = source('domain-cache')
 for (const domain of ['shop.short.gy', 'bills.example.com']) {
   const shortURL = `https://${domain}/bill123`
   const config = { ...env, VITE_SHORT_IO_DOMAIN: domain }
   const fetcher = async (address, options) => {
     assert.equal(address, 'https://api.short.io/links')
     assert.equal(JSON.parse(options.body).domain, domain)
     return Response.json({ shortURL })
   }
   assert.equal(await shortenPdfUrl(pdfUrl, { env: config, fetcher }), shortURL)
   assert.equal(isShortPdfUrl(shortURL, domain), true)
 }
 assert.equal(isShortPdfUrl('https://is.gd/legacy'), true)
 for (const shortURL of ['https://evil.example/bill', 'https://short.gy.evil.example/bill', 'https://user:pass@short.gy/bill', 'http://short.gy/bill', 'https://short.gy/bill?redirect=evil', 'https://is.gd/legacy']) {
   assert.equal(await shortenPdfUrl(source(`reject-${shortURL}`), { env, fetcher: async () => Response.json({ shortURL }) }), undefined)
 }
})
test('invalid destinations never reach Short.io', async () => {
 let calls = 0
 const fetcher = async () => { calls++; throw new Error('Must not fetch') }
 assert.equal(await shortenPdfUrl('https://evil.example/bill.pdf', { env, fetcher }), undefined)
 assert.equal(await shortenPdfUrl(source('target'), { env, fetcher, targetUrl: 'https://evil.example/' }), undefined)
 assert.equal(calls, 0)
})
test('Short.io rate limits preserve fallback and pause subsequent requests', async () => {
 let calls = 0
 const fetcher = async () => { calls++; return new Response('Rate limited', { status: 429 }) }
 assert.equal(await shortenPdfUrl(source('rate-limit'), { env, fetcher }), undefined)
 assert.equal(await shortenPdfUrl(source('cooldown'), { env, fetcher }), undefined)
 assert.equal(calls, 1)
})
