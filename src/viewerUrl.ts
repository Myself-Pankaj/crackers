export function isCloudinaryPdfUrl(value: string): boolean {
  try { const url = new URL(value); return url.protocol === 'https:' && url.hostname === 'res.cloudinary.com' && /^\/[^/]+\/raw\/upload\//.test(url.pathname) && /[.]pdf$/i.test(url.pathname) && !url.username && !url.password } catch { return false }
}
export function billViewerUrl(pdfUrl: string, siteOrigin: string): string {
  if (!isCloudinaryPdfUrl(pdfUrl)) throw new Error('A valid Cloudinary bill PDF link is required.')
  const base = new URL(siteOrigin)
  if (base.protocol !== 'https:' && !(base.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname))) throw new Error('A secure website address is required.')
  const viewer = new URL('/bill-view.html', base.origin)
  viewer.hash = new URLSearchParams({ pdf: pdfUrl }).toString()
  return viewer.href
}
export function isBillViewerUrl(value: unknown, pdfUrl: string): value is string {
  try { const url = new URL(String(value)); return url.protocol === 'https:' && !url.username && !url.password && url.pathname === '/bill-view.html' && !url.search && new URLSearchParams(url.hash.slice(1)).get('pdf') === pdfUrl } catch { return false }
}
