// The domain is public configuration; the Short.io API key stays on the server.
export function isShortPdfUrl(value: unknown, domain: string = import.meta.env?.VITE_SHORT_IO_DOMAIN || 'short.gy'): value is string {
  if (typeof value !== 'string' || value.length > 2048) return false
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password && !url.port
      && (url.hostname === domain.trim().toLowerCase() || url.hostname === 'is.gd')
      && /^\/[A-Za-z0-9_-]{1,255}$/.test(url.pathname) && !url.search && !url.hash
  } catch { return false }
}
export function preferredPdfUrl(bill: { pdfUrl?: string; shortPdfUrl?: string }): string {
  return isShortPdfUrl(bill.shortPdfUrl) ? bill.shortPdfUrl : bill.pdfUrl || ''
}
