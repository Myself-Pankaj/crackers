import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pdfSmsBody, pdfSmsUrl } from '../src/sms.ts'
const bill = { id: 'HO-TEST', phone: '919876543210', customer: 'Mukesh', total: 1250.5, payment: 'Paid · Cash' }
const link = 'https://res.cloudinary.com/buymybook/raw/upload/v1/hariom%20phatak%20center/bill.pdf'
test('SMS contains a personal Diwali greeting and complete bill information', () => {
 const text = pdfSmsBody(bill, link)
 for (const expected of ['Namaste Mukesh', 'Happy Diwali!', 'HO-TEST', 'Rs. 1,250.50', 'Paid - Cash', link, 'Hari Om Phataka Center']) assert.ok(text.includes(expected))
})
test('SMS recipient and encoded message work with Android and iOS URI formats', () => {
 const standard = pdfSmsUrl(bill, link)
 assert.ok(standard.startsWith('sms:+919876543210?body='))
 assert.equal(decodeURIComponent(standard.split('?body=')[1]), pdfSmsBody(bill, link))
 assert.ok(pdfSmsUrl(bill, link, true).startsWith('sms:+919876543210&body='))
 assert.throws(() => pdfSmsUrl({ ...bill, phone: '' }, link), /phone number/)
 assert.throws(() => pdfSmsBody(bill, 'javascript:alert(1)'), /secure/)
})

test('original PDF URL survives SMS encoding without becoming the short URL', () => {
 const original = 'https://res.cloudinary.com/buymybook/raw/upload/v1/hariom%20phatak%20center/uid/HO-TEST-a.pdf'
 const result = pdfSmsUrl({ ...bill, shortPdfUrl: 'https://is.gd/badLink' }, original)
 const message = decodeURIComponent(result.split('?body=')[1])
 assert.ok(message.includes(original))
 assert.ok(!message.includes('https://is.gd/badLink'))
 assert.ok(message.includes('%20phatak%20'))
})
