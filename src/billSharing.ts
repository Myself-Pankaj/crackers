import type { Bill } from './model'
import { STORE_NAME } from './brand.ts'
import { billViewerUrl, isBillViewerUrl, isCloudinaryPdfUrl } from './viewerUrl.ts'
import { isShortPdfUrl } from './shortUrl.ts'
import { pdfSmsBody } from './sms.ts'

export function billShareUrl(bill: Pick<Bill, 'pdfUrl' | 'pdfViewerUrl' | 'shortPdfUrl'>, origin: string): string {
  if (!bill.pdfUrl || !isCloudinaryPdfUrl(bill.pdfUrl)) return ''
  // Saved short links also belong to older bills without viewer metadata.
  if (isShortPdfUrl(bill.shortPdfUrl)) return bill.shortPdfUrl
  if (isBillViewerUrl(bill.pdfViewerUrl, bill.pdfUrl)) return bill.pdfViewerUrl
  try {
    const viewer = billViewerUrl(bill.pdfUrl, origin)
    // Local development links cannot be opened on the customer's phone.
    if (new URL(viewer).protocol === 'https:') return viewer
  } catch { /* A valid hosted PDF remains shareable without a viewer. */ }
  return bill.pdfUrl
}

export function billShareData(bill: Bill, url: string): ShareData {
  return { title: `${STORE_NAME} · Bill ${bill.id}`, text: pdfSmsBody(bill, url) }
}

type ShareTarget = {
  share?: (data: ShareData) => Promise<void>
  clipboard?: { writeText: (text: string) => Promise<void> }
}

export async function shareBillMessage(data: ShareData, target: ShareTarget): Promise<'shared' | 'copied' | 'cancelled'> {
  if (target.share) {
    try { await target.share(data); return 'shared' }
    catch (error) {
      if ((error as { name?: string })?.name === 'AbortError') return 'cancelled'
      throw error
    }
  }
  if (!target.clipboard) throw new Error('This browser cannot share messages. Open the app in your phone’s browser and try again.')
  await target.clipboard.writeText(data.text || '')
  return 'copied'
}
