import { jsPDF } from 'jspdf'
import type { Bill } from './model'
import { STORE_NAME, DIWALI_WISH } from './brand.ts'

const currency = (value: number) => `Rs. ${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
export const billPdfName = (bill: Bill) => `${bill.id.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`
type Color = [number, number, number]
const maroon: Color = [112, 38, 48], gold: Color = [203, 151, 63], ink: Color = [65, 50, 44], cream: Color = [255, 248, 232], white: Color = [255, 255, 255]

export function createBillPdf(bill: Bill): jsPDF {
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' })
  pdf.setProperties({ title: `${STORE_NAME} Bill ${bill.id}`, subject: 'Sales bill', author: STORE_NAME })
  const left = 18, right = 192, bottom = 268
  let y = 0
  const text = (value: string, x: number, at: number, size = 10, bold = false, align: 'left' | 'right' | 'center' = 'left', color: Color = ink) => {
    pdf.setFont('helvetica', bold ? 'bold' : 'normal'); pdf.setFontSize(size); pdf.setTextColor(...color)
    pdf.text(value, x, at, { align })
  }
  const line = (at: number) => { pdf.setDrawColor(232, 218, 194); pdf.line(left, at, right, at) }
  const burst = (x: number, at: number, radius: number) => {
    pdf.setDrawColor(...gold); pdf.setLineWidth(0.35)
    for (let i = 0; i < 8; i++) {
      const angle = i * Math.PI / 4
      pdf.line(x + Math.cos(angle) * radius * 0.45, at + Math.sin(angle) * radius * 0.45, x + Math.cos(angle) * radius, at + Math.sin(angle) * radius)
    }
  }
  const diya = (x: number, at: number, scale = 1) => {
    pdf.setFillColor(...gold); pdf.setDrawColor(...gold)
    pdf.ellipse(x, at, 6 * scale, 2 * scale, 'F')
    pdf.ellipse(x, at + 1.2 * scale, 4.8 * scale, 2 * scale, 'F')
    pdf.setFillColor(243, 148, 52)
    pdf.triangle(x - 1.5 * scale, at - 3 * scale, x + 1.8 * scale, at - 3 * scale, x + 0.4 * scale, at - 9 * scale, 'F')
    pdf.setFillColor(255, 228, 141); pdf.ellipse(x, at - 4 * scale, 0.8 * scale, 1.7 * scale, 'F')
  }
  const tableHeader = () => {
    pdf.setFillColor(...maroon); pdf.roundedRect(left, y - 5, right - left, 10, 1, 1, 'F')
    text('Item', left + 3, y + 1, 9, true, 'left', white)
    text('Quantity', 127, y + 1, 9, true, 'right', white)
    text('Rate', 158, y + 1, 9, true, 'right', white)
    text('Amount', right - 3, y + 1, 9, true, 'right', white)
    y += 14
  }
  const nextPage = () => {
    pdf.addPage()
    text(STORE_NAME, left, 19, 14, true, 'left', maroon)
    text(bill.id, right, 19, 9, false, 'right')
    line(25); y = 37
  }
  // A warm, festive letterhead drawn as vectors so the PDF stays sharp.
  pdf.setFillColor(...maroon); pdf.roundedRect(14, 14, 182, 43, 3, 3, 'F')
  pdf.setDrawColor(...gold); pdf.roundedRect(16, 16, 178, 39, 2, 2, 'S')
  diya(30, 41, 1.2); burst(181, 31, 6)
  text('HARI OM', 48, 32, 24, true, 'left', white)
  text('PHATAKA CENTER', 48, 42, 13, true, 'left', [243, 207, 139])
  text('Lighting up your celebrations', 48, 49, 8, false, 'left', [243, 218, 181])
  text(bill.demo ? 'DEMO BILL' : 'SALES BILL', right, 65, 9, true, 'right', maroon)
  text(bill.id, left, 65, 10, true)
  line(70)
  text(new Date(bill.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) + ' IST', left, 78, 9)
  pdf.setFontSize(10)
  const customer = pdf.splitTextToSize(`Customer: ${bill.customer || 'Walk-in customer'}`, 170) as string[]
  text(customer.join('\n'), left, 88, 10)
  y = 88 + customer.length * 5
  if (bill.phone) { text(`Phone: +${bill.phone}`, left, y + 2, 10); y += 7 }
  y += 10
  tableHeader()
  bill.lines.forEach((item, index) => {
    pdf.setFontSize(10)
    const nameLines = pdf.splitTextToSize(item.name, 76) as string[]
    const height = Math.max(12, nameLines.length * 4.8 + 5)
    if (y + height > bottom) { nextPage(); tableHeader() }
    if (index % 2 === 0) { pdf.setFillColor(255, 250, 241); pdf.rect(left, y - 5, right - left, height, 'F') }
    text(nameLines.join('\n'), left + 3, y, 10)
    text(`${item.quantity} ${item.unit === 'box' ? 'box' : 'piece'}`, 127, y, 9, false, 'right')
    text(currency(item.price), 158, y, 9, false, 'right')
    text(currency(item.amount), right - 3, y, 9, true, 'right')
    y += height; line(y - 5)
  })
  if (y + 88 > bottom) nextPage()
  y += 4
  text('Subtotal', 122, y, 10); text(currency(bill.subtotal), right - 3, y, 10, false, 'right')
  y += 8
  text('Discount', 122, y, 10); text(`- ${currency(bill.discount)}`, right - 3, y, 10, false, 'right')
  y += 10
  pdf.setFillColor(...cream); pdf.roundedRect(116, y - 6, 76, 13, 2, 2, 'F')
  text('TOTAL', 122, y + 2, 13, true, 'left', maroon); text(currency(bill.total), right - 3, y + 2, 13, true, 'right', maroon)
  y += 15
  text(`Payment: ${bill.payment.replace('·', '-')}`, left, y, 10)
  y += 10
  pdf.setFillColor(...cream); pdf.roundedRect(left, y, right - left, 27, 2, 2, 'F')
  diya(32, y + 18); diya(178, y + 18)
  text(DIWALI_WISH, 105, y + 11, 11, true, 'center', maroon)
  text('May your celebrations be filled with light, joy, and togetherness.', 105, y + 19, 8, false, 'center')
  y += 34
  text('Thank you for celebrating with us!', 105, y, 9, false, 'center')
  const pages = pdf.getNumberOfPages()
  for (let i = 1; i <= pages; i++) {
    pdf.setPage(i); line(280)
    text(STORE_NAME, left, 287, 8, true, 'left', maroon)
    text(`Page ${i} of ${pages}`, right, 287, 8, false, 'right')
  }
  return pdf
}
export function billPdfFile(bill: Bill): File {
  const pdf = createBillPdf(bill)
  return new File([pdf.output('arraybuffer')], billPdfName(bill), { type: 'application/pdf' })
}
