import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isCloudinaryBillLink, savePublishedPdfLink, PdfLinkSaveError } from '../src/pdfPublication.ts'
const link = { pdfUrl: 'https://res.cloudinary.com/buymybook/raw/upload/v1/hariom%20phatak%20center/uid/HO-TEST-a1b2c3.pdf', pdfPath: 'hariom phatak center/uid/HO-TEST-a1b2c3.pdf' }

test('a failed Firestore write keeps the uploaded Cloudinary link available', async () => {
 let error
 try { await savePublishedPdfLink(link, async () => { throw { code: 'permission-denied' } }) } catch (e) { error = e }
 assert.ok(error instanceof PdfLinkSaveError)
 assert.deepEqual(error.link, link)
 assert.match(error.message, /uploaded to Cloudinary/)
 assert.match(error.message, /Firestore blocked saving its link/)
 assert.match(error.message, /share the PDF now/)
})
test('link-save retry writes only sharing metadata', async () => {
 const writes = []
 assert.deepEqual(await savePublishedPdfLink(link, async fields => { writes.push(fields) }), link)
 assert.deepEqual(Object.keys(writes[0]).sort(), ['pdfPath', 'pdfUrl'])
})
test('only a hosted Cloudinary PDF for the same owner and bill is reused', () => {
 assert.equal(isCloudinaryBillLink(link, 'uid', 'HO-TEST'), true)
 assert.equal(isCloudinaryBillLink(link, 'another-uid', 'HO-TEST'), false)
 assert.equal(isCloudinaryBillLink(link, 'uid', 'HO-ANOTHER'), false)
 assert.equal(isCloudinaryBillLink({ ...link, pdfUrl: 'javascript:alert(1)' }, 'uid', 'HO-TEST'), false)
 assert.equal(isCloudinaryBillLink({ ...link, pdfUrl: 'https://res.cloudinary.com.example.org/fake' }, 'uid', 'HO-TEST'), false)
})
