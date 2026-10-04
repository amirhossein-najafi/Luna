import type { HoldingKind, Quote } from '../types.ts'

type Row = Record<string, unknown>

export class QuoteError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'QuoteError'
  }
}

const MATCHERS: Record<HoldingKind, (label: string) => number> = {
  coin: (label) => {
    if (/ir_coin_emami|coin_emami|emami|امامی/.test(label)) return 3
    return 0
  },
  usd: (label) => {
    if (/cad|aud|کانادا|استرالیا/.test(label)) return 0
    if (/\busd\b/.test(label)) return 3
    if (label.includes('دلار')) return 1
    return 0
  },
  gold18: (label) => {
    if (/24|۲۴/.test(label)) return 0
    if (!/18|۱۸/.test(label)) return 0
    if (/gold|طلا|ayar|عیار|xau/.test(label)) return 3
    return 0
  },
}

function rowsFrom(data: unknown) {
  const rows: Row[] = []
  const visit = (value: unknown) => {
    if (!Array.isArray(value)) return
    for (const item of value) {
      if (item && typeof item === 'object') rows.push(item as Row)
    }
  }
  if (Array.isArray(data)) visit(data)
  if (data && typeof data === 'object') {
    for (const value of Object.values(data as Record<string, unknown>)) visit(value)
  }
  return rows
}

function labelOf(row: Row) {
  return `${row.symbol ?? ''} ${row.name ?? ''} ${row.name_en ?? ''} ${row.title ?? ''}`.toLowerCase()
}

function priceOf(row: Row) {
  const raw = row.price ?? row.p ?? row.value
  const numeric =
    typeof raw === 'number'
      ? raw
      : typeof raw === 'string'
        ? Number(raw.replace(/[٬,\s]/g, '').replace('٫', '.'))
        : Number.NaN
  if (!Number.isFinite(numeric) || numeric <= 0) return null
  const unit = String(row.unit ?? '')
  const toman = unit.includes('ریال') && !unit.includes('تومان') ? numeric / 10 : numeric
  return Math.round(toman)
}

function pickQuotes(rows: Row[]) {
  const used = new Set<number>()
  const quotes: Quote[] = []
  const order: HoldingKind[] = ['coin', 'usd', 'gold18']

  for (const kind of order) {
    let bestIndex = -1
    let bestScore = 0
    let bestPrice = 0
    rows.forEach((row, index) => {
      if (used.has(index)) return
      const score = MATCHERS[kind](labelOf(row))
      const price = priceOf(row)
      if (!price || score <= bestScore) return
      bestScore = score
      bestIndex = index
      bestPrice = price
    })
    if (bestIndex < 0) continue
    used.add(bestIndex)
    quotes.push({ kind, price: bestPrice, updatedAt: new Date().toISOString() })
  }

  return quotes
}

export async function fetchMarketQuotes(apiKey: string) {
  let response: Response
  try {
    response = await fetch(
      `https://Api.BrsApi.ir/Market/Gold_Currency.php?key=${encodeURIComponent(apiKey)}`,
    )
  } catch {
    throw new QuoteError('اتصال به سرویس قیمت برقرار نشد. قیمت را دستی وارد کن.')
  }

  if (!response.ok) {
    throw new QuoteError('سرویس قیمت پاسخ نداد. قیمت را دستی وارد کن.')
  }

  let data: unknown
  try {
    data = await response.json()
  } catch {
    throw new QuoteError('پاسخ قیمت قابل خواندن نبود.')
  }

  const quotes = pickQuotes(rowsFrom(data))
  if (quotes.length === 0) {
    const message =
      data && typeof data === 'object' && 'message' in data ? String(data.message) : ''
    throw new QuoteError(message || 'در پاسخ سرویس، قیمت قابل استفاده پیدا نشد.')
  }
  return quotes
}
