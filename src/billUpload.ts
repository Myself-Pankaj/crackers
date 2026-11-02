import { doc, updateDoc } from 'firebase/firestore'
import { auth, db } from './firebase'
import { billViewerUrl, isBillViewerUrl } from './viewerUrl'
import { isShortPdfUrl } from './shortUrl'
import { loadPdfTools } from './pdfLoader'
import { isCloudinaryBillLink, savePublishedPdfLink } from './pdfPublication'
import type { Bill } from './model'
import type { PdfLink } from './pdfPublication'

export async function uploadBillPdf(bill: Bill, uid: string): Promise<PdfLink> {
  const database = db
  if (!database || !auth?.currentUser || auth.currentUser.uid !== uid) throw new Error('Sign in to the bill’s store before uploading its PDF.')
  let link: PdfLink
  if (isCloudinaryBillLink(bill, uid, bill.id) && isShortPdfUrl(bill.shortPdfUrl) && (window.location.protocol !== 'https:' || bill.pdfViewerUrl === billViewerUrl(bill.pdfUrl!, window.location.origin))) {
    // Retry a failed metadata save without another PDF upload.
    link = { pdfUrl: bill.pdfUrl, pdfPath: bill.pdfPath, shortPdfUrl: bill.shortPdfUrl, ...(bill.pdfViewerUrl ? { pdfViewerUrl: bill.pdfViewerUrl } : {}) }
  } else {
    const { billPdfFile } = await loadPdfTools()
    const file = billPdfFile(bill)
    if (file.size > 4 * 1024 * 1024) throw new Error('The PDF is too large to upload (maximum 4 MB).')
    const token = await auth.currentUser.getIdToken()
    const response = await fetch('/api/bills/pdf', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/pdf', 'X-Bill-ID': bill.id }, body: file, signal: AbortSignal.timeout(100000) })
    if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('The PDF upload API is missing. On Netlify, deploy the project with netlify.toml and netlify/functions, not just dist. Add the Cloudinary credentials to Netlify environment variables with Functions scope, then redeploy.')
    const result = await response.json()
    if (!response.ok) throw new Error(result.error || 'Cloudinary PDF upload failed.')
    if (!isCloudinaryBillLink(result, uid, bill.id)) throw new Error('The upload server returned an invalid PDF link.')
    link = { pdfUrl: result.pdfUrl, pdfPath: result.pdfPath, ...(isShortPdfUrl(result.shortPdfUrl) ? { shortPdfUrl: result.shortPdfUrl } : {}), ...(isBillViewerUrl(result.pdfViewerUrl, result.pdfUrl) ? { pdfViewerUrl: result.pdfViewerUrl } : {}) }
  }
  // The PDF stays in Cloudinary. Firestore stores its original URL, short URL, and asset ID.
  return savePublishedPdfLink(link, value => updateDoc(doc(database, 'stores', uid, 'bills', bill.id), value))
}
