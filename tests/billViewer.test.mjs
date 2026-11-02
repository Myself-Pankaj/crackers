import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { createBillPdf } from '../src/pdf.ts'
import { billViewerUrl, isBillViewerUrl, isCloudinaryPdfUrl } from '../src/viewerUrl.ts'
import { shortenPdfUrl } from '../server/url-shortener.mjs'
const source = 'https://res.cloudinary.com/buymybook/raw/upload/v1/hariom%20phatak%20center/uid/HO-TEST-abc.pdf'

test('mobile viewer URL preserves the PDF address in a fragment, without exposing it in requests', () => {
 const viewer = billViewerUrl(source, 'https://myshop.netlify.app')
 const parsed = new URL(viewer)
 assert.equal(parsed.pathname, '/bill-view.html')
 assert.equal(parsed.search, '')
 assert.equal(new URLSearchParams(parsed.hash.slice(1)).get('pdf'), source)
 assert.ok(isBillViewerUrl(viewer, source))
 assert.ok(!isBillViewerUrl(viewer, source + 'other'))
 assert.ok(!isCloudinaryPdfUrl('https://res.cloudinary.com.evil.example/bill.pdf'))
 assert.throws(() => billViewerUrl('javascript:alert(1)', 'https://myshop.netlify.app'))
})
test('the short link points at the mobile viewer for the exact PDF', async () => {
 const viewer = billViewerUrl(source, 'https://viewer-test.netlify.app')
 const short = await shortenPdfUrl(source, { targetUrl: viewer, fetcher: async address => {
   assert.equal(new URL(address).searchParams.get('url'), viewer)
   return Response.json({ shorturl: 'https://is.gd/mobileBill' })
 } })
 assert.equal(short, 'https://is.gd/mobileBill')
})
test('PDF.js can parse and render the actual festive bill to a canvas', async () => {
 const require = createRequire(import.meta.url)
 const { createCanvas } = require(require.resolve('@napi-rs/canvas', { paths: [require.resolve('pdfjs-dist/package.json')] }))
 const bill = { id: 'HO-VIEW', createdAt: '2026-11-02T10:00:00Z', customer: 'Mobile Customer', phone: '919876543210', lines: [{ productId: 'item', name: 'Crackers', unit: 'box', quantity: 1, price: 100, amount: 100, pieces: 10 }], subtotal: 100, discount: 0, total: 100, payment: 'Paid · Cash', demo: true }
 const task = getDocument({ data: new Uint8Array(createBillPdf(bill).output('arraybuffer')), useSystemFonts: true })
 const pdf = await task.promise
 try {
   assert.equal(pdf.numPages, 1)
   const page = await pdf.getPage(1)
   const text = (await page.getTextContent()).items.map(item => item.str).join(' ')
   assert.match(text, /HARI OM/)
   assert.match(text, /Mobile Customer/)
   const viewport = page.getViewport({ scale: 0.6 })
   const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height))
   await page.render({ canvas, canvasContext: canvas.getContext('2d'), viewport }).promise
   assert.ok(canvas.toBuffer('image/png').length > 1000)
 } finally { await task.destroy() }
})
