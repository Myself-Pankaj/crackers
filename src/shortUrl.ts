export function isShortPdfUrl(value: unknown): value is string {
  return typeof value === 'string' && /^https:\/\/is[.]gd\/[A-Za-z0-9_-]{1,64}$/.test(value)
}
export function preferredPdfUrl(bill: { pdfUrl?: string; shortPdfUrl?: string }): string {
  return isShortPdfUrl(bill.shortPdfUrl) ? bill.shortPdfUrl : bill.pdfUrl || ''
}
