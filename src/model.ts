import { STORE_NAME, DIWALI_WISH } from './brand.ts'
export type Product = { id: string; name: string; category: string; piecesPerBox: number; boxPrice: number; loosePrice: number; stock: number; color: string; imageData?: string }
export type CartLine = { productId: string; unit: 'box' | 'loose'; quantity: number }
export type BillLine = CartLine & { name: string; price: number; pieces: number; amount: number }
export type Bill = { id: string; createdAt: string; customer: string; phone: string; lines: BillLine[]; subtotal: number; discount: number; total: number; payment: string; demo: boolean; pdfUrl?: string; pdfPath?: string; shortPdfUrl?: string; pdfViewerUrl?: string }
export const categories = ['All items', 'Sparklers', 'Flower pots', 'Ground chakkars', 'Rockets', 'Sound crackers', 'Gift boxes']
export const money = (value: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(value)
export function calculate(products: Product[], cart: CartLine[], discount: number) {
  if (!cart.length) throw new Error('Add at least one item to the bill.')
  const required = new Map<string, number>()
  const lines: BillLine[] = cart.map(line => {
    const p = products.find(p => p.id === line.productId)
    if (!p) throw new Error('An item is no longer available. Remove it and try again.')
    if (!Number.isSafeInteger(line.quantity) || line.quantity < 1) throw new Error('Quantities must be positive whole numbers.')
    const pieces = line.quantity * (line.unit === 'box' ? p.piecesPerBox : 1)
    required.set(p.id, (required.get(p.id) || 0) + pieces)
    const price = line.unit === 'box' ? p.boxPrice : p.loosePrice
    return { ...line, name: p.name, pieces, price, amount: Math.round(price * line.quantity * 100) / 100 }
  })
  for (const [id, count] of required) {
    const p = products.find(p => p.id === id)!
    if (count > p.stock) throw new Error(`Only ${p.stock} pieces of ${p.name} are available.`)
  }
  const subtotal = Math.round(lines.reduce((s, l) => s + l.amount, 0) * 100) / 100
  if (!Number.isFinite(discount) || discount < 0 || discount > subtotal) throw new Error('Discount must be between zero and the subtotal.')
  return { lines, subtotal, discount, total: Math.round((subtotal - discount) * 100) / 100, required }
}
export function billText(bill: Bill) {
  return `${bill.demo ? '[DEMO BILL]\n' : ''}${STORE_NAME}\nBill #${bill.id}\n${new Date(bill.createdAt).toLocaleString('en-IN')}\nCustomer: ${bill.customer || 'Walk-in customer'}\n\n${bill.lines.map(l => `${l.name}\n${l.quantity} ${l.unit === 'box' ? 'box' : 'piece'} × ${money(l.price)} = ${money(l.amount)}`).join('\n\n')}\n\nSubtotal: ${money(bill.subtotal)}\nDiscount: ${money(bill.discount)}\nTOTAL: ${money(bill.total)}\nPayment: ${bill.payment}\n\n${DIWALI_WISH}\nThank you for celebrating with us!`
}
