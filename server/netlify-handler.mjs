import { Readable } from 'node:stream'
import { createBillPdfHandler } from './bill-pdf.mjs'

/** Adapt Netlify's web Request/Response API to the shared upload handler. */
export function createNetlifyBillPdfHandler(options) {
  const handle = createBillPdfHandler(options)
  return async function billPdf(request) {
    const req = request.body ? Readable.fromWeb(request.body) : Readable.from([])
    req.method = request.method
    req.headers = Object.fromEntries(request.headers.entries())
    let status = 500, headers = {}, body = ''
    await handle(req, {
      writeHead(code, values) { status = code; headers = values },
      end(value) { body = value },
    })
    return new Response(body, { status, headers })
  }
}
