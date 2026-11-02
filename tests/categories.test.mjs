import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cleanCategoryName, categoryId, mergeCategories } from '../src/categories.ts'
import { parseProductDraft, emptyProductDraft } from '../src/stockForm.ts'

test('custom categories merge with defaults and existing inventory without duplicates', () => {
 assert.deepEqual(mergeCategories(['All items', 'Sparklers'], ['Fancy Fireworks', ' sparklers '], ['Fancy   Fireworks', 'Combo packs']), ['All items', 'Sparklers', 'Fancy Fireworks', 'Combo packs'])
})
test('category names normalize spaces and use consistent safe document IDs', () => {
 assert.equal(cleanCategoryName('  Fancy   Fireworks  '), 'Fancy Fireworks')
 assert.equal(categoryId(' Fancy   Fireworks '), categoryId('fancy fireworks'))
 assert.equal(categoryId('Fancy / Combo').includes('/'), false)
})
test('empty, reserved and overly long names are rejected', () => {
 for (const value of ['', '  ', 'a'.repeat(51), 'All items', '__add_category__']) assert.throws(() => cleanCategoryName(value))
 assert.equal(cleanCategoryName('a'.repeat(50)).length, 50)
})
test('a stock item can save a user-defined category', () => {
 const product = parseProductDraft({ ...emptyProductDraft, name: 'My item', category: ' Fancy   Fireworks ', stock: '20', boxPrice: '100', loosePrice: '12' }, 'item-id')
 assert.equal(product.category, 'Fancy Fireworks')
})
