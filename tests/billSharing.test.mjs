import { test } from 'node:test'
import assert from 'node:assert/strict'
import { billShareUrl, billShareData, shareBillMessage } from '../src/billSharing.ts'
import { billViewerUrl } from '../src/viewerUrl.ts'
import { pdfSmsBody, pdfSmsUrl } from '../src/sms.ts'

const pdfUrl = 'https://res.cloudinary.com/buymybook/raw/upload/v1/test.pdf'
const pdfViewerUrl = billViewerUrl(pdfUrl, 'https://shop.example')
const bill = { id: 'HO-SHARE', customer: 'Mukesh', phone: '919876543210', total: 1250.5, payment: 'Paid · Cash', pdfUrl, pdfViewerUrl }

test('share links prefer the saved mobile viewer and its short link', () => {
 assert.equal(billShareUrl(bill, 'https://shop.example'), pdfViewerUrl)
 assert.equal(billShareUrl({ ...bill, shortPdfUrl: 'https://is.gd/test' }, 'https://shop.example'), 'https://is.gd/test')
 // Older short links may point directly to PDFs; derive a mobile viewer instead.
 assert.equal(billShareUrl({ pdfUrl, shortPdfUrl: 'https://is.gd/old' }, 'https://shop.example'), pdfViewerUrl)
 assert.equal(billShareUrl({ pdfUrl }, 'http://localhost:5173'), pdfUrl)
 assert.equal(billShareUrl({ pdfUrl: 'javascript:alert(1)' }, 'https://shop.example'), '')
 assert.equal(billShareUrl({}, 'https://shop.example'), '')
})

test('SMS and the app picker receive the same greeting and bill link without a file attachment', () => {
 const data = billShareData(bill, pdfViewerUrl)
 assert.equal(data.text, pdfSmsBody(bill, pdfViewerUrl))
 assert.equal(decodeURIComponent(pdfSmsUrl(bill, pdfViewerUrl).split('?body=')[1]), data.text)
 for (const part of ['Namaste Mukesh', 'Happy Diwali!', pdfViewerUrl, 'HO-SHARE']) assert.ok(data.text.includes(part))
 assert.equal(data.files, undefined)
 assert.equal(data.url, undefined) // Keep the link in the greeting so all apps receive it together.
})

test('the app picker shares the message using the supplied navigator', async () => {
 const data = billShareData(bill, pdfViewerUrl)
 const target = { async share(payload) { assert.equal(this, target); assert.deepEqual(payload, data) } }
 assert.equal(await shareBillMessage(data, target), 'shared')
})

test('unsupported app picking copies the complete greeting and link', async () => {
 const data = billShareData(bill, pdfViewerUrl)
 let copied = ''
 assert.equal(await shareBillMessage(data, { clipboard: { async writeText(text) { copied = text } } }), 'copied')
 assert.equal(copied, data.text)
 await assert.rejects(shareBillMessage(data, {}), /cannot share/)
})

test('cancelling the app picker is silent and a failed share does not copy unexpectedly', async () => {
 const data = billShareData(bill, pdfViewerUrl)
 const clipboard = { async writeText() { assert.fail('Should not copy') } }
 assert.equal(await shareBillMessage(data, { share: async () => { throw Object.assign(new Error('Cancelled'), { name: 'AbortError' }) }, clipboard }), 'cancelled')
 await assert.rejects(shareBillMessage(data, { share: async () => { throw new Error('Share failed') }, clipboard }), /Share failed/)
})
