import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadWorkspace, saveWorkspace } from '../src/localStore.ts'
import { prepareProductImage } from '../src/productImage.ts'
import { demoProducts } from './fixtures.mjs'
const storage = (values = {}) => ({ getItem: key => values[key] ?? null })

test('fresh workspace starts empty without invented inventory', () => {
 assert.deepEqual(loadWorkspace(storage()), { products: [], bills: [] })
})
test('legacy samples are removed while user-created stock and bills survive', () => {
 const custom = { ...demoProducts[0], id: 'user-created', name: 'My cracker', imageData: 'data:image/jpeg;base64,ABC=' }
 const bills = [{ id: 'existing-bill' }]
 const loaded = loadWorkspace(storage({ 'spark-stock': JSON.stringify([...demoProducts, custom]), 'spark-bills': JSON.stringify(bills) }))
 assert.deepEqual(loaded.products, [custom])
 assert.deepEqual(loaded.bills, bills)
})
test('current stock reloads with its saved image and no sample migration', () => {
 const products = [{ ...demoProducts[0], imageData: 'data:image/jpeg;base64,ABC=' }]
 assert.deepEqual(loadWorkspace(storage({ 'spark-workspace-v2': JSON.stringify({ products, bills: [] }) })).products, products)
})
test('one storage write saves both stock and bill; a storage failure is surfaced', () => {
 const original = globalThis.localStorage
 let writes = []
 try {
   globalThis.localStorage = { setItem: (key, value) => { writes.push([key, JSON.parse(value)]) } }
   saveWorkspace([{ id: 'stock' }], [{ id: 'bill' }])
   assert.equal(writes.length, 1)
   assert.deepEqual(writes[0][1], { products: [{ id: 'stock' }], bills: [{ id: 'bill' }] })
   globalThis.localStorage = { setItem: () => { throw new Error('Storage full') } }
   assert.throws(() => saveWorkspace([], []), /Storage full/)
 } finally { if (original === undefined) delete globalThis.localStorage; else globalThis.localStorage = original }
})
test('invalid image formats and oversized uploads are rejected before processing', async () => {
 await assert.rejects(prepareProductImage(new File(['not an image'], 'file.svg', { type: 'image/svg+xml' })), /JPG, PNG, or WebP/)
 const large = new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'large.jpg', { type: 'image/jpeg' })
 await assert.rejects(prepareProductImage(large), /smaller than 10 MB/)
})
