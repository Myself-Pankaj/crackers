import { test } from 'node:test'
import assert from 'node:assert/strict'
import { emptyProductDraft, parseProductDraft, productToDraft } from '../src/stockForm.ts'
const draft = { ...emptyProductDraft, name: 'My cracker', piecesPerBox: '10', stock: '125', boxPrice: '250.50', loosePrice: '30.75' }

test('stock and prices start empty and values save as numbers', () => {
 assert.equal(emptyProductDraft.stock, '')
 assert.equal(emptyProductDraft.boxPrice, '')
 const saved = parseProductDraft(draft, 'item-1')
 assert.equal(saved.stock, 125)
 assert.equal(saved.boxPrice, 250.5)
 assert.equal(saved.loosePrice, 30.75)
 assert.equal(saved.piecesPerBox, 10)
})
test('cleared fields are not silently converted to zero', () => {
 for (const field of ['piecesPerBox', 'stock', 'boxPrice', 'loosePrice']) assert.throws(() => parseProductDraft({ ...draft, [field]: '' }, 'id'), /Enter the box size/)
})
test('explicit zeros remain valid, fractional stock and negative prices do not', () => {
 const saved = parseProductDraft({ ...draft, stock: '0', boxPrice: '0', loosePrice: '0' }, 'id')
 assert.equal(saved.stock, 0)
 assert.equal(saved.boxPrice, 0)
 assert.throws(() => parseProductDraft({ ...draft, stock: '1.5' }, 'id'), /whole-number/)
 assert.throws(() => parseProductDraft({ ...draft, boxPrice: '-1' }, 'id'), /valid prices/)
})
test('editing preserves values and photos and allows replacing a value', () => {
 const product = { ...parseProductDraft(draft, 'item-1'), imageData: 'data:image/jpeg;base64,ABC=' }
 const form = productToDraft(product)
 assert.equal(form.stock, '125')
 const result = parseProductDraft({ ...form, stock: '200' }, product.id)
 assert.equal(result.stock, 200)
 assert.equal(result.imageData, product.imageData)
})
