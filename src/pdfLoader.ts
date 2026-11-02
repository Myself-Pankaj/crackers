export type PdfTools = typeof import('./pdf.ts')
let pending: Promise<PdfTools> | undefined
export function loadPdfTools(): Promise<PdfTools> {
  pending ??= import('./pdf.ts').catch(error => { pending = undefined; throw error })
  return pending
}
