export type PdfLink = { pdfUrl: string; pdfPath: string; shortPdfUrl?: string; pdfViewerUrl?: string }
export class PdfLinkSaveError extends Error {
  readonly link: PdfLink
  readonly saveErrorCode: string
  constructor(link: PdfLink, error: unknown) {
    const code = (error as { code?: string })?.code
    super(code === 'permission-denied' || code === 'firestore/permission-denied'
      ? 'Your PDF is uploaded to Cloudinary, but Firestore blocked saving its link. Publish the current firestore.rules in Firebase Console → Firestore Database → Rules, including shortPdfUrl permission. You can share the PDF now, then retry saving the link.'
      : 'Your PDF is uploaded to Cloudinary, but its link could not be saved to the bill. You can share the PDF now, then retry saving the link.')
    this.name = 'PdfLinkSaveError'
    this.link = link
    this.saveErrorCode = code || 'unknown'
  }
}
export async function savePublishedPdfLink(link: PdfLink, save: (link: PdfLink) => Promise<void>): Promise<PdfLink> {
  try { await save(link) }
  catch (error) { throw new PdfLinkSaveError(link, error) }
  return link
}
export function isCloudinaryBillLink(link: Partial<PdfLink>, uid: string, billId: string): link is PdfLink {
  try {
    const url = new URL(link.pdfUrl || '')
    const prefix = `hariom phatak center/${uid}/${billId}-`
    return url.protocol === 'https:' && url.hostname === 'res.cloudinary.com' && /^\/[^/]+\/raw\/upload\//.test(url.pathname)
      && Boolean(link.pdfPath?.startsWith(prefix) && /^[a-f0-9]+[.]pdf$/.test(link.pdfPath.slice(prefix.length)))
  } catch { return false }
}
