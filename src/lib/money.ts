const PERSIAN = '۰۱۲۳۴۵۶۷۸۹'
const ARABIC = '٠١٢٣٤٥٦٧٨٩'

export function latinDigits(value: string) {
  return value
    .replace(/[۰-۹]/g, (digit) => String(PERSIAN.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String(ARABIC.indexOf(digit)))
}

export function toFaDigits(value: string | number) {
  return String(value).replace(/\d/g, (digit) => PERSIAN[Number(digit)] ?? digit)
}

export function formatNumber(value: number) {
  const negative = value < 0
  const rounded = Math.round(Math.abs(value) * 100) / 100
  const [whole, fraction] = String(rounded).split('.')
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, '٬')
  const body = fraction ? `${grouped}٫${fraction}` : grouped
  return `${negative ? '−' : ''}${toFaDigits(body)}`
}

export function formatCompact(value: number) {
  const abs = Math.abs(value)
  if (abs >= 1_000_000) return `${toFaDigits(Math.round(abs / 1_000_000))}م`
  if (abs >= 1_000) return `${toFaDigits(Math.round(abs / 1_000))}ه`
  return formatNumber(abs)
}

export function parseDecimal(input: string) {
  const normalized = latinDigits(input)
    .replace(/[٬,\s]/g, '')
    .replace('٫', '.')
    .replace(/[^\d.]/g, '')
  const value = Number(normalized)
  if (!Number.isFinite(value) || value < 0) return 0
  return Math.round(value * 100) / 100
}

export function parseAmount(input: string) {
  return Math.round(parseDecimal(input))
}
