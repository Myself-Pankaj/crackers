/** Return international digits for WhatsApp, defaulting local numbers to India. */
export function normalizePhone(value: string, countryCode = '91'): string {
  const raw = value.trim()
  if (!raw) return ''
  if (!/^\+?[\d\s()-]+$/.test(raw)) throw new Error('Enter a valid WhatsApp phone number.')
  const code = countryCode.replace(/^\+/, '').trim()
  const digits = raw.replace(/\D/g, '')
  let number: string
  if (raw.startsWith('+')) number = digits
  else if (digits.startsWith('00')) number = digits.slice(2)
  else {
    if (!/^[1-9]\d{0,2}$/.test(code)) throw new Error('Enter a valid country code, for example 91 for India.')
    if (code === '91' && digits.length === 12 && digits.startsWith('91')) number = digits
    else number = code + (code === '91' && digits.length === 11 && digits.startsWith('0') ? digits.slice(1) : digits)
  }
  if (!/^[1-9]\d{7,14}$/.test(number) || (number.startsWith('91') && !/^91[1-9]\d{9}$/.test(number))) {
    throw new Error('Enter a valid phone number. For India (+91), enter the 10-digit number.')
  }
  return number
}
export function whatsappChatUrl(phone: string): string {
  if (!phone.trim()) throw new Error('This bill needs a customer phone number to open their WhatsApp chat.')
  // Saved bills already contain the full international number.
  const number = normalizePhone(phone.startsWith('+') ? phone : `+${phone}`)
  return `https://wa.me/${number}`
}
