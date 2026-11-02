import './billViewer.css'
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist/legacy/build/pdf.mjs'
import type { PDFDocumentProxy } from 'pdfjs-dist/legacy/build/pdf.mjs'
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'
import { isCloudinaryPdfUrl } from './viewerUrl'

GlobalWorkerOptions.workerSrc = workerUrl
const status = document.querySelector<HTMLElement>('#status')!
const error = document.querySelector<HTMLElement>('#error')!
const errorMessage = document.querySelector<HTMLElement>('#error-message')!
const canvas = document.querySelector<HTMLCanvasElement>('#pdf-page')!
const previous = document.querySelector<HTMLButtonElement>('#previous')!
const next = document.querySelector<HTMLButtonElement>('#next')!
const download = document.querySelector<HTMLButtonElement>('#download')!
const original = document.querySelector<HTMLAnchorElement>('#original')!
const controls = document.querySelector<HTMLElement>('#controls')!
const pageLabel = document.querySelector<HTMLElement>('#page-number')!
const pdfUrl = new URLSearchParams(location.hash.slice(1)).get('pdf') || ''
let pdf: PDFDocumentProxy | undefined, pageNumber = 1, rendering = false, blobUrl = '', loading = false
let pdfData: Uint8Array | undefined
function showError(message: string) { errorMessage.textContent = message; error.hidden = false; status.textContent = 'Bill preview unavailable'; canvas.hidden = true }
async function renderPage() {
  if (!pdf || rendering) return
  rendering = true; previous.disabled = true; next.disabled = true
  try {
    const page = await pdf.getPage(pageNumber)
    const width = Math.min(850, document.querySelector<HTMLElement>('#paper')!.clientWidth)
    const base = page.getViewport({ scale: 1 })
    const viewport = page.getViewport({ scale: width / base.width })
    const ratio = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = Math.floor(viewport.width * ratio); canvas.height = Math.floor(viewport.height * ratio)
    canvas.style.width = `${viewport.width}px`; canvas.style.height = `${viewport.height}px`
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Canvas is unavailable.')
    await page.render({ canvasContext: context, canvas, viewport, transform: ratio === 1 ? undefined : [ratio, 0, 0, ratio, 0, 0] }).promise
    canvas.hidden = false; error.hidden = true; controls.hidden = pdf.numPages < 2
    canvas.setAttribute('aria-label', `Bill page ${pageNumber} of ${pdf.numPages}`)
    pageLabel.textContent = `Page ${pageNumber} of ${pdf.numPages}`
    status.textContent = 'Your bill is ready to view or download.'
    page.cleanup()
  } catch { showError('The preview could not render on this browser. Tap Download PDF or open this page in Chrome.') }
  finally { rendering = false; previous.disabled = pageNumber <= 1; next.disabled = !pdf || pageNumber >= pdf.numPages }
}
async function loadBill() {
  if (loading || rendering) return
  if (!isCloudinaryPdfUrl(pdfUrl)) { showError('This bill link is missing or invalid. Ask the shop to resend the bill.'); return }
  loading = true; error.hidden = true; status.textContent = 'Loading your bill…'
  original.href = pdfUrl; original.hidden = false
  try {
    if (!pdfData) {
      const response = await fetch(pdfUrl, { credentials: 'omit', referrerPolicy: 'no-referrer', signal: AbortSignal.timeout(30000) })
      if (!response.ok) throw new Error('Download failed.')
      const bytes = new Uint8Array(await response.arrayBuffer())
      if (new TextDecoder().decode(bytes.subarray(0, 5)) !== '%PDF-') throw new Error('Not a PDF.')
      pdfData = bytes
      blobUrl = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }))
      download.disabled = false
    }
    if (!pdf) pdf = await getDocument({ data: pdfData.slice(), useSystemFonts: true }).promise
    await renderPage()
  } catch { showError('The bill could not load. Check your internet connection and tap Try again. You can also open the original PDF in Chrome.') }
  finally { loading = false }
}
previous.addEventListener('click', () => { if (pageNumber > 1 && !rendering) { pageNumber--; void renderPage() } })
next.addEventListener('click', () => { if (pdf && pageNumber < pdf.numPages && !rendering) { pageNumber++; void renderPage() } })
document.querySelector('#retry')!.addEventListener('click', () => void loadBill())
download.addEventListener('click', () => { if (!blobUrl) return; const anchor = document.createElement('a'); anchor.href = blobUrl; anchor.download = 'Hari-Om-Phataka-Center-Bill.pdf'; anchor.click() })
let resizeTimer: ReturnType<typeof setTimeout>
window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => { if (!loading) void renderPage() }, 200) })
void loadBill()
