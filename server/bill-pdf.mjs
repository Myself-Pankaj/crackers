import { createHash, createHmac } from 'node:crypto'
import { billViewerUrl } from '../src/viewerUrl.ts'
import { shortenPdfUrl } from './url-shortener.mjs'
import { isShortPdfUrl } from '../src/shortUrl.ts'
import { defaultFirebaseConfig } from '../src/firebaseConfig.ts'

export const CLOUDINARY_FOLDER = 'hariom phatak center'
const MAX_PDF = 4 * 1024 * 1024
class HttpError extends Error { constructor(status, message) { super(message); this.status = status } }
export function cloudinarySignature(params, secret) {
  const input = Object.keys(params).sort().map(key => `${key}=${params[key]}`).join('&')
  return createHash('sha1').update(input + secret).digest('hex')
}
export function cloudinaryUploadParams(uid, billId, secret, timestamp, fixedFolders = false) {
  const suffix = createHmac('sha256', secret).update(`${uid}/${billId}`).digest('hex').slice(0, 24)
  const filename = `${uid}/${billId}-${suffix}.pdf`
  return { timestamp, overwrite: 'false', public_id: fixedFolders ? filename : `${CLOUDINARY_FOLDER}/${filename}`, [fixedFolders ? 'folder' : 'asset_folder']: CLOUDINARY_FOLDER }
}
function cloudinaryLink(value) {
  try { const url = new URL(value); return url.protocol === 'https:' && url.hostname === 'res.cloudinary.com' } catch { return false }
}
async function readPdf(req) {
  if (Number(req.headers['content-length']) > MAX_PDF) throw new HttpError(413, 'PDF exceeds the 4 MB limit.')
  const parts = []; let size = 0
  for await (const chunk of req) { size += chunk.length; if (size > MAX_PDF) throw new HttpError(413, 'PDF exceeds the 4 MB limit.'); parts.push(chunk) }
  const buffer = Buffer.concat(parts)
  if (!buffer.subarray(0, 5).equals(Buffer.from('%PDF-'))) throw new HttpError(400, 'A valid PDF file is required.')
  return buffer
}
export function createBillPdfHandler({ env = process.env, fetcher = fetch } = {}) {
  return async function handleBillPdf(req, res) {
    const viewerFor = pdfUrl => {
      try {
        const origin = env.PUBLIC_SITE_URL || req.headers.origin || env.URL
        if (!origin || new URL(origin).protocol !== 'https:') return undefined
        return billViewerUrl(pdfUrl, origin)
      } catch { return undefined }
    }
    const reply = (status, body) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); res.end(JSON.stringify(body)) }
    try {
      if (req.method !== 'POST') throw new HttpError(405, 'Use POST to upload a bill PDF.')
      const token = /^Bearer ([^\s]+)$/.exec(req.headers.authorization || '')?.[1]
      if (!token) throw new HttpError(401, 'Sign in before uploading a bill.')
      const billId = req.headers['x-bill-id']
      if (typeof billId !== 'string' || !/^[A-Za-z0-9_-]{1,100}$/.test(billId)) throw new HttpError(400, 'A valid bill number is required.')
      if (req.headers['content-type']?.split(';')[0] !== 'application/pdf') throw new HttpError(415, 'Upload a PDF file.')
      const cloudName = env.CLOUDINARY_CLOUD_NAME
      if (!cloudName || !/^[a-z0-9_-]+$/i.test(cloudName) || !env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET) throw new HttpError(503, 'Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET on the server and restart it.')
      const apiKey = env.VITE_FIREBASE_API_KEY || defaultFirebaseConfig.apiKey
      const account = await fetcher(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken: token }), signal: AbortSignal.timeout(8000) })
      const accountData = await account.json()
      const uid = accountData.users?.[0]?.localId
      if (!account.ok || !uid || accountData.users[0].disabled) throw new HttpError(401, 'Your sign-in has expired. Sign in again.')
      const project = env.VITE_FIREBASE_PROJECT_ID || defaultFirebaseConfig.projectId
      const database = env.VITE_FIREBASE_DATABASE_ID || '(default)'
      const saved = await fetcher(`https://firestore.googleapis.com/v1/projects/${encodeURIComponent(project)}/databases/${encodeURIComponent(database)}/documents/stores/${encodeURIComponent(uid)}/bills/${billId}`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(8000) })
      if (!saved.ok) throw new HttpError(saved.status === 404 ? 404 : 403, 'Save the bill to your Firebase store before uploading its PDF. Check Firestore permissions.')
      const document = await saved.json()
      const oldUrl = document.fields?.pdfUrl?.stringValue, oldPath = document.fields?.pdfPath?.stringValue
      if (cloudinaryLink(oldUrl) && oldPath?.startsWith(`${CLOUDINARY_FOLDER}/${uid}/`)) {
        req.resume()
        const existingShort = document.fields?.shortPdfUrl?.stringValue
        const pdfViewerUrl = viewerFor(oldUrl)
        const sameTarget = (document.fields?.pdfViewerUrl?.stringValue || undefined) === pdfViewerUrl
        const shortPdfUrl = isShortPdfUrl(existingShort) && sameTarget ? existingShort : await shortenPdfUrl(oldUrl, { fetcher, targetUrl: pdfViewerUrl || oldUrl })
        reply(200, { pdfUrl: oldUrl, pdfPath: oldPath, ...(pdfViewerUrl ? { pdfViewerUrl } : {}), ...(shortPdfUrl ? { shortPdfUrl } : {}) }); return
      }
      const file = await readPdf(req)
      const params = cloudinaryUploadParams(uid, billId, env.CLOUDINARY_API_SECRET, Math.floor(Date.now() / 1000), env.CLOUDINARY_FOLDER_MODE === 'fixed')
      const form = new FormData()
      for (const [key, value] of Object.entries(params)) form.set(key, String(value))
      form.set('api_key', env.CLOUDINARY_API_KEY)
      form.set('signature', cloudinarySignature(params, env.CLOUDINARY_API_SECRET))
      form.set('file', new Blob([file], { type: 'application/pdf' }), `${billId}.pdf`)
      const uploaded = await fetcher(`https://api.cloudinary.com/v1_1/${cloudName}/raw/upload`, { method: 'POST', body: form, signal: AbortSignal.timeout(30000) })
      const result = await uploaded.json()
      const expectedPath = params.folder ? `${params.folder}/${params.public_id}` : params.public_id
      if (!uploaded.ok || !cloudinaryLink(result.secure_url) || result.public_id !== expectedPath) throw new HttpError(502, 'Cloudinary upload failed. Check the cloud name, API credentials, and folder mode in your server settings.')
      const pdfViewerUrl = viewerFor(result.secure_url)
      const shortPdfUrl = await shortenPdfUrl(result.secure_url, { fetcher, targetUrl: pdfViewerUrl || result.secure_url })
      reply(200, { pdfUrl: result.secure_url, pdfPath: result.public_id, ...(pdfViewerUrl ? { pdfViewerUrl } : {}), ...(shortPdfUrl ? { shortPdfUrl } : {}) })
    } catch (e) {
      req.resume()
      reply(e.status || 502, { error: e instanceof HttpError ? e.message : 'The PDF upload service could not complete the request. Check your connection and retry.' })
    }
  }
}
