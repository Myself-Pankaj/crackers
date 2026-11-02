import type { Product } from './model'
import { cleanCategoryName } from './categories.ts'

type NumericField = 'piecesPerBox' | 'stock' | 'boxPrice' | 'loosePrice'
export type ProductDraft = Omit<Product, 'id' | NumericField> & Record<NumericField, string>
export const emptyProductDraft: ProductDraft = {
  name: '', category: 'Sparklers', piecesPerBox: '10', boxPrice: '', loosePrice: '', stock: '', color: 'orange', imageData: '',
}
export function productToDraft(product: Product): ProductDraft {
  return { name: product.name, category: product.category, color: product.color, imageData: product.imageData || '',
    piecesPerBox: String(product.piecesPerBox), stock: String(product.stock), boxPrice: String(product.boxPrice), loosePrice: String(product.loosePrice) }
}
export function parseProductDraft(draft: ProductDraft, id: string): Product {
  const fields: NumericField[] = ['piecesPerBox', 'stock', 'boxPrice', 'loosePrice']
  if (fields.some(field => draft[field].trim() === '')) throw new Error('Enter the box size, stock, box price, and loose piece price. Enter 0 if a value is zero.')
  const product: Product = { ...draft, id, name: draft.name.trim(), category: cleanCategoryName(draft.category), piecesPerBox: Number(draft.piecesPerBox), stock: Number(draft.stock), boxPrice: Number(draft.boxPrice), loosePrice: Number(draft.loosePrice) }
  if (!product.name || product.name.length > 100 || !Number.isSafeInteger(product.piecesPerBox) || product.piecesPerBox < 1 || !Number.isSafeInteger(product.stock) || product.stock < 0 || !Number.isFinite(product.boxPrice) || !Number.isFinite(product.loosePrice) || product.boxPrice < 0 || product.loosePrice < 0) {
    throw new Error('Use a name, whole-number stock and box size, and valid prices.')
  }
  return product
}
