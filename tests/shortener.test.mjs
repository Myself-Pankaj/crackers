import { test } from 'node:test'
import assert from 'node:assert/strict'
import { shortenPdfUrl } from '../server/url-shortener.mjs'
import { isShortPdfUrl, preferredPdfUrl } from '../src/shortUrl.ts'
import { savePublishedPdfLink, PdfLinkSaveError } from '../src/pdfPublication.ts'
const source = id => `https://res.cloudinary.com/demo/raw/upload/v1/${id}.pdf?x=1&y=2`

test('shortening preserves the full encoded destination and caches the result', async () => {
 let calls = 0
 const fetcher = async request => {
   calls++
   const url = new URL(request)
   assert.equal(url.origin, 'https://is.gd')
   assert.equal(url.searchParams.get('format'), 'json')
   assert.equal(url.searchParams.get('url'), source('cached'))
   return Response.json({ shorturl: 'https://is.gd/bill123' })
 }
 assert.equal(await shortenPdfUrl(source('cached'), { fetcher }), 'https://is.gd/bill123')
 assert.equal(await shortenPdfUrl(source('cached'), { fetcher }), 'https://is.gd/bill123')
 assert.equal(calls, 1)
})
test('shortener failures leave the original PDF available', async () => {
 assert.equal(await shortenPdfUrl(source('down'), { fetcher: async () => { throw new Error('offline') } }), undefined)
 assert.equal(await shortenPdfUrl(source('invalid'), { fetcher: async () => Response.json({ shorturl: 'javascript:alert(1)' }) }), undefined)
 assert.equal(preferredPdfUrl({ pdfUrl: source('fallback') }), source('fallback'))
 assert.equal(preferredPdfUrl({ pdfUrl: source('fallback'), shortPdfUrl: 'https://is.gd/good123' }), 'https://is.gd/good123')
 assert.equal(isShortPdfUrl('https://is.gd.example.com/fake'), false)
})
test('concurrent requests for the same PDF create just one link', async () => {
 let calls = 0
 const fetcher = async () => { calls++; await new Promise(resolve => setTimeout(resolve, 5)); return Response.json({ shorturl: 'https://is.gd/once' }) }
 const values = await Promise.all(Array.from({ length: 5 }, () => shortenPdfUrl(source('concurrent'), { fetcher })))
 assert.equal(calls, 1)
 assert.deepEqual(new Set(values), new Set(['https://is.gd/once']))
})
test('short URL is saved with original metadata and survives a denied save', async () => {
 const link = { pdfUrl: source('metadata'), pdfPath: 'hariom phatak center/uid/HO-ID-abc.pdf', shortPdfUrl: 'https://is.gd/saved123' }
 let stored
 await savePublishedPdfLink(link, async fields => { stored = fields })
 assert.deepEqual(stored, link)
 await assert.rejects(savePublishedPdfLink(link, async () => { throw { code: 'permission-denied' } }), error => error instanceof PdfLinkSaveError && error.link.shortPdfUrl === link.shortPdfUrl)
})
