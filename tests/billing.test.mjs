import { test } from 'node:test'
import assert from 'node:assert/strict'
import { calculate, billText } from '../src/model.ts'
import { demoProducts } from './fixtures.mjs'
const p = { ...demoProducts[0], stock: 25 }
test('mixed box and chillar quantities consume the same piece stock', () => {
 const result = calculate([p], [{ productId: p.id, unit: 'box', quantity: 2 }, { productId: p.id, unit: 'loose', quantity: 5 }], 10)
 assert.equal(result.required.get(p.id), 25)
 assert.equal(result.subtotal, 315)
 assert.equal(result.total, 305)
})
test('combined box and loose overselling is rejected', () => {
 assert.throws(() => calculate([p], [{ productId: p.id, unit: 'box', quantity: 2 }, { productId: p.id, unit: 'loose', quantity: 6 }], 0), /Only 25 pieces/)
})
test('invalid discounts, empty carts, missing products and fractional quantities are rejected', () => {
 assert.throws(() => calculate([p], [], 0), /at least one/)
 assert.throws(() => calculate([], [{ productId: p.id, unit: 'box', quantity: 1 }], 0), /no longer/)
 for (const quantity of [0, -1, 0.5, Infinity]) assert.throws(() => calculate([p], [{ productId: p.id, unit: 'box', quantity }], 0), /whole numbers/)
 for (const discount of [-1, 121, NaN]) assert.throws(() => calculate([p], [{ productId: p.id, unit: 'box', quantity: 1 }], discount), /Discount/)
})
test('money calculations round currency and permit a full discount', () => {
 const item = { ...p, loosePrice: 0.1 }
 const result = calculate([item], [{ productId: p.id, unit: 'loose', quantity: 3 }], 0.3)
 assert.equal(result.subtotal, 0.3)
 assert.equal(result.total, 0)
})
test('WhatsApp text includes bill quantities, payment and a demo label', () => {
 const result = calculate([p], [{ productId: p.id, unit: 'box', quantity: 1 }], 0)
 const text = billText({ ...result, id: 'SP-TEST', customer: 'Test Customer', phone: '', createdAt: '2026-11-02T10:00:00Z', demo: true, payment: 'Unpaid' })
 assert.match(text, /\[DEMO BILL\]/)
 assert.match(text, /1 box/)
 assert.match(text, /Test Customer/)
 assert.match(text, /TOTAL:/)
 assert.match(text, /Payment: Unpaid/)
})
