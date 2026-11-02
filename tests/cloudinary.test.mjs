import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Readable } from 'node:stream'
import { cloudinaryUploadParams, cloudinarySignature, createBillPdfHandler } from '../server/bill-pdf.mjs'
const env = { CLOUDINARY_CLOUD_NAME: 'test-cloud', CLOUDINARY_API_KEY: 'test-key', CLOUDINARY_API_SECRET: 'server-only-secret' }
const response = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } })
async function call({ fetcher, headers = {}, method = 'POST', body = '%PDF-1.4\nTest PDF', config = env } = {}) {
 const req = Readable.from([Buffer.from(body)])
 req.method = method
 req.headers = { authorization: 'Bearer id-token', 'content-type': 'application/pdf', 'x-bill-id': 'HO-TEST', ...headers }
 const result = {}
 const res = { writeHead: (status, responseHeaders) => { result.status = status; result.headers = responseHeaders }, end: data => { result.body = JSON.parse(data) } }
 await createBillPdfHandler({ env: config, fetcher })(req, res)
 return result
}
test('upload requires login and rejects invalid IDs and file types before provider calls', async () => {
 const fetcher = () => { throw new Error('Must not call a provider') }
 assert.equal((await call({ fetcher, headers: { authorization: '' } })).status, 401)
 assert.equal((await call({ fetcher, headers: { 'x-bill-id': '../another-store' } })).status, 400)
 assert.equal((await call({ fetcher, headers: { 'content-type': 'text/html' } })).status, 415)
 assert.equal((await call({ fetcher, method: 'GET' })).status, 405)
})
test('missing server credentials are reported without exposing configuration', async () => {
 const result = await call({ config: {}, fetcher: () => { throw new Error('Must not fetch') } })
 assert.equal(result.status, 503)
 assert.match(result.body.error, /CLOUDINARY_CLOUD_NAME/)
})
test('the authenticated UID determines bill access and only signed PDF uploads reach Cloudinary', async () => {
 const calls = []
 const fetcher = async (url, options) => {
   calls.push(url)
   if (url.includes('accounts:lookup')) { assert.equal(JSON.parse(options.body).idToken, 'id-token'); return response({ users: [{ localId: 'verified-user' }] }) }
   if (url.includes('firestore.googleapis.com')) { assert.match(url, /stores\/verified-user\/bills\/HO-TEST$/); return response({ fields: {} }) }
   if (url.startsWith('https://is.gd/create.php')) { assert.equal(new URL(url).searchParams.get('url'), 'https://res.cloudinary.com/test-cloud/raw/upload/v1/test.pdf'); return response({ shorturl: 'https://is.gd/testBill' }) }
   assert.equal(url, 'https://api.cloudinary.com/v1_1/test-cloud/raw/upload')
   const form = options.body
   assert.equal(form.get('asset_folder'), 'hariom phatak center')
   assert.match(form.get('public_id'), /^hariom phatak center\/verified-user\/HO-TEST-[a-f0-9]{24}[.]pdf$/)
   assert.equal(form.get('api_secret'), null)
   assert.equal(form.get('overwrite'), 'false')
   assert.equal(form.get('file').type, 'application/pdf')
   assert.equal(await form.get('file').text(), '%PDF-1.4\nTest PDF')
   return response({ secure_url: 'https://res.cloudinary.com/test-cloud/raw/upload/v1/test.pdf', public_id: form.get('public_id') })
 }
 const result = await call({ fetcher })
 assert.equal(result.status, 200)
 assert.equal(calls.length, 4)
 assert.equal(result.body.shortPdfUrl, 'https://is.gd/testBill')
 assert.match(result.body.pdfUrl, /^https:\/\/res.cloudinary.com\//)
 assert.equal(JSON.stringify(result.body).includes(env.CLOUDINARY_API_SECRET), false)
})
test('upload cannot proceed without a saved bill belonging to the account', async () => {
 let count = 0
 const result = await call({ fetcher: async () => ++count === 1 ? response({ users: [{ localId: 'verified-user' }] }) : response({}, 404) })
 assert.equal(result.status, 404)
 assert.equal(count, 2)
})
test('a saved Cloudinary link is reused without another upload', async () => {
 let count = 0
 const link = { pdfUrl: 'https://res.cloudinary.com/test-cloud/raw/upload/v1/bill.pdf', pdfPath: 'hariom phatak center/verified-user/HO-TEST-existing.pdf', shortPdfUrl: 'https://is.gd/savedBill' }
 const result = await call({ fetcher: async () => ++count === 1 ? response({ users: [{ localId: 'verified-user' }] }) : response({ fields: { pdfUrl: { stringValue: link.pdfUrl }, pdfPath: { stringValue: link.pdfPath }, shortPdfUrl: { stringValue: link.shortPdfUrl } } }) })
 assert.equal(result.status, 200)
 assert.deepEqual(result.body, link)
 assert.equal(count, 2)
})
test('invalid tokens, oversized input and non-PDF contents are rejected', async () => {
 assert.equal((await call({ fetcher: async () => response({}, 400) })).status, 401)
 const fetcher = async url => url.includes('accounts:lookup') ? response({ users: [{ localId: 'verified-user' }] }) : response({ fields: {} })
 assert.equal((await call({ fetcher, headers: { 'content-length': String(6 * 1024 * 1024) } })).status, 413)
 assert.equal((await call({ fetcher, body: '<html>not a pdf</html>' })).status, 400)
})
test('upload names remain stable on retry and support both folder modes', () => {
 const first = cloudinaryUploadParams('uid', 'HO-ID', 'secret', 123)
 const retry = cloudinaryUploadParams('uid', 'HO-ID', 'secret', 456)
 assert.equal(first.public_id, retry.public_id)
 assert.equal(first.asset_folder, 'hariom phatak center')
 const fixed = cloudinaryUploadParams('uid', 'HO-ID', 'secret', 123, true)
 assert.equal(`${fixed.folder}/${fixed.public_id}`, first.public_id)
 assert.equal(cloudinarySignature({ timestamp: 123, overwrite: 'false' }, 'secret'), cloudinarySignature({ overwrite: 'false', timestamp: 123 }, 'secret'))
})
