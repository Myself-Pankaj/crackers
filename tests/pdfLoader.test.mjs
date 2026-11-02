import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadPdfTools } from '../src/pdfLoader.ts'

test('concurrent PDF requests share the same loaded module and preserve generation tools', async () => {
 const [first, second] = await Promise.all([loadPdfTools(), loadPdfTools()])
 assert.equal(first, second)
 const bill = { id: 'HO-LAZY', createdAt: '2026-11-02T10:00:00Z', customer: 'Test', phone: '', lines: [{ productId: 'item', name: 'Crackers', unit: 'box', quantity: 1, price: 100, amount: 100, pieces: 10 }], subtotal: 100, discount: 0, total: 100, payment: 'Paid · Cash', demo: true }
 assert.ok(first.createBillPdf(bill).output().startsWith('%PDF-'))
 assert.equal(first.billPdfFile(bill).type, 'application/pdf')
 assert.equal(first.billPdfName(bill), 'HO-LAZY.pdf')
})
