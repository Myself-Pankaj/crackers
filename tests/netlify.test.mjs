import { test } from 'node:test'
import assert from 'node:assert/strict'
import deployedHandler from '../netlify/functions/bill-pdf.mjs'
import { createNetlifyBillPdfHandler } from '../server/netlify-handler.mjs'
const env = { CLOUDINARY_CLOUD_NAME: 'test-cloud', CLOUDINARY_API_KEY: 'key', CLOUDINARY_API_SECRET: 'secret' }

test('the deployed function returns JSON for GET, rather than SPA HTML', async () => {
 const response = await deployedHandler(new Request('https://example.netlify.app/api/bills/pdf'))
 assert.equal(response.status, 405)
 assert.match(response.headers.get('content-type'), /application\/json/)
 assert.match((await response.json()).error, /POST/)
})
test('Netlify requests without authorization cannot upload', async () => {
 const response = await deployedHandler(new Request('https://example.netlify.app/api/bills/pdf', { method: 'POST', body: '%PDF-1.4\nTest', headers: { 'Content-Type': 'application/pdf', 'X-Bill-ID': 'HO-TEST' } }))
 assert.equal(response.status, 401)
})
test('the function forwards Firebase identity and binary PDF data through the shared handler', async () => {
 let uploaded = false
 const handler = createNetlifyBillPdfHandler({ env, fetcher: async (url, options) => {
   if (url.includes('accounts:lookup')) {
     assert.equal(JSON.parse(options.body).idToken, 'netlify-user-token')
     return Response.json({ users: [{ localId: 'owner' }] })
   }
   if (url.includes('firestore.googleapis.com')) { assert.match(url, /stores\/owner\/bills\/HO-TEST$/); return Response.json({ fields: {} }) }
   if (url.startsWith('https://is.gd/')) return Response.json({ shorturl: 'https://is.gd/netlifyPdf' })
   assert.equal(url, 'https://api.cloudinary.com/v1_1/test-cloud/raw/upload')
   assert.equal(await options.body.get('file').text(), '%PDF-1.4\nNetlify binary test')
   uploaded = true
   return Response.json({ secure_url: 'https://res.cloudinary.com/test-cloud/raw/upload/v1/netlify.pdf', public_id: options.body.get('public_id') })
 } })
 const request = new Request('https://example.netlify.app/api/bills/pdf', { method: 'POST', headers: { Authorization: 'Bearer netlify-user-token', 'Content-Type': 'application/pdf', 'X-Bill-ID': 'HO-TEST' }, body: new Blob(['%PDF-1.4\nNetlify binary test'], { type: 'application/pdf' }) })
 const response = await handler(request)
 assert.equal(response.status, 200)
 const result = await response.json()
 assert.equal(result.shortPdfUrl, 'https://is.gd/netlifyPdf')
 assert.ok(result.pdfPath.startsWith('hariom phatak center/owner/'))
 assert.equal(uploaded, true)
 assert.equal(response.headers.get('cache-control'), 'no-store')
})
