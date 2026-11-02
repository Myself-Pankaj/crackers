import type { Bill } from './model'
import { STORE_NAME, DIWALI_WISH } from './brand.ts'
import { normalizePhone } from './phone.ts'

type SmsBill = Pick<Bill, 'id'> & Partial<Pick<Bill, 'customer' | 'total' | 'payment'>>

export function pdfSmsBody(bill: SmsBill, pdfUrl: string): string {
  const url = new URL(pdfUrl)
  if (url.protocol !== 'https:') throw new Error('A secure PDF download link is required.')
  const amount = typeof bill.total === 'number' && Number.isFinite(bill.total) ? `\nAmount: Rs. ${bill.total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : ''
  const payment = bill.payment ? `\nPayment: ${bill.payment.replace('·', '-')}` : ''
  return `Namaste ${bill.customer?.trim() || 'Customer'},\n\n${DIWALI_WISH} May your home be filled with light, happiness, and prosperity.\n\nBill: ${bill.id}${amount}${payment}\nView or download your PDF bill:\n${url.href}\n\nThank you for celebrating with us!\n${STORE_NAME}`
}
export function pdfSmsUrl(bill: SmsBill & Pick<Bill, 'phone'>, pdfUrl: string, ios = false): string {
  if (!bill.phone) throw new Error('Add a customer phone number to send an SMS.')
  const phone = normalizePhone(bill.phone.startsWith('+') ? bill.phone : `+${bill.phone}`)
  // iOS Messages uses &body; other handlers use the RFC 5724 query syntax.
  return `sms:+${phone}${ios ? '&' : '?'}body=${encodeURIComponent(pdfSmsBody(bill, pdfUrl))}`
}
