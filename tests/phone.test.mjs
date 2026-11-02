import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalizePhone, whatsappChatUrl } from '../src/phone.ts'

test('local Indian numbers default to +91', () => {
 assert.equal(normalizePhone('98765 43210'), '919876543210')
 assert.equal(normalizePhone('09876543210'), '919876543210')
 assert.equal(normalizePhone(''), '')
})
test('pasted country codes are not doubled and other countries are supported', () => {
 for (const input of ['+91 98765-43210', '919876543210', '0091 9876543210']) assert.equal(normalizePhone(input), '919876543210')
 assert.equal(normalizePhone('2025550123', '1'), '12025550123')
 assert.equal(normalizePhone('+44 7700 900123'), '447700900123')
})
test('bad numbers fail before saving the bill', () => {
 for (const input of ['123', '987654321', '98765432101', '+91 987654321', 'number 9876543210', '+0 9876543210']) assert.throws(() => normalizePhone(input), /valid|10-digit/)
 assert.throws(() => normalizePhone('9876543210', ''), /country code/)
})
test('WhatsApp chat link uses the bill number and contains no text payload', () => {
 const link = new URL(whatsappChatUrl('919876543210'))
 assert.equal(link.origin, 'https://wa.me')
 assert.equal(link.pathname, '/919876543210')
 assert.equal(link.search, '')
 assert.equal(whatsappChatUrl('12025550123'), 'https://wa.me/12025550123')
 assert.equal(whatsappChatUrl('447700900123'), 'https://wa.me/447700900123')
 assert.throws(() => whatsappChatUrl(''), /customer phone/)
})
