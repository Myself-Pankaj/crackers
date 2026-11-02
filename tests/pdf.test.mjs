import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createBillPdf, billPdfFile, billPdfName } from '../src/pdf.ts'
import { calculate } from '../src/model.ts'
import { demoProducts } from './fixtures.mjs'

const product = { ...demoProducts[0], stock: 25 }
const calc = calculate([product], [
 { productId: product.id, unit: 'box', quantity: 1 },
 { productId: product.id, unit: 'loose', quantity: 1 },
], 5)
const bill = { ...calc, id: 'SP-TEST', customer: 'Test Customer', phone: '919876543210', createdAt: '2026-11-02T10:00:00Z', demo: false, payment: 'Paid · Cash' }

test('PDF includes both box and chillar lines and correct total', () => {
 const pdf = createBillPdf(bill)
 const output = pdf.output()
 assert.ok(output.startsWith('%PDF-'))
 assert.match(output, /1 box/)
 assert.match(output, /1 piece/)
 assert.match(output, /Rs\. 130\.00/)
 assert.match(output, /Test Customer/)
 assert.match(output, /SP-TEST/)
 assert.match(output, /HARI OM/)
 assert.match(output, /PHATAKA CENTER/)
 assert.match(output, /Hari Om Phataka Center/)
 assert.match(output, /Wishing you and your family a Happy Diwali!/)
 assert.equal(pdf.getNumberOfPages(), 1)
})
test('long bills paginate, retain all items and include page footers', () => {
 const lines = Array.from({ length: 125 }, (_, i) => ({ ...bill.lines[0], name: `Cracker Item ${i + 1}`, productId: `item-${i}` }))
 const pdf = createBillPdf({ ...bill, lines })
 assert.ok(pdf.getNumberOfPages() > 1)
 const output = pdf.output()
 assert.match(output, /Cracker Item 1\)/)
 assert.match(output, /Cracker Item 125/)
 assert.match(output, /Page 1 of/)
 assert.match(output, /TOTAL/)
})
test('file sharing receives a named PDF file', async () => {
 const file = billPdfFile(bill)
 assert.equal(file.type, 'application/pdf')
 assert.equal(file.name, 'SP-TEST.pdf')
 assert.ok((await file.text()).startsWith('%PDF-'))
 assert.equal(billPdfName({ ...bill, id: '../unsafe/name' }), '___unsafe_name.pdf')
})
