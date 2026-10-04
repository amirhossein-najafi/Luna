import { JALALI_MONTHS } from './jalali.ts'
import { toFaDigits } from './money.ts'
import { HOLDING_KINDS, type HoldingKind } from '../types.ts'

const SYMBOLS: Record<HoldingKind, string> = {
  gold18: 'geram18',
  usd: 'price_dollar_rl',
  coin: 'sekee',
}

export type MarketPoint = {
  label: string
  fullDate: string
  iso: string
  price: number
}

export type MarketSeries = {
  kind: HoldingKind
  price: number
  changePct: number | null
  date: string
  points: MarketPoint[]
}

type TablePayload = {
  data?: unknown[]
}

function parseRial(cell: unknown) {
  const value = Number(String(cell ?? '').replace(/[^\d]/g, ''))
  if (!Number.isFinite(value) || value <= 0) return null
  return Math.round(value / 10)
}

function parseChangePct(cell: unknown) {
  const raw = String(cell ?? '')
  const plain = raw.replace(/<[^>]*>/g, '').replace('%', '').trim()
  const value = Number(plain.replace(/[^\d.-]/g, ''))
  if (!Number.isFinite(value)) return null
  return raw.includes('low') ? -Math.abs(value) : Math.abs(value)
}

function formatPointDate(jalali: string) {
  const parts = jalali.split('/')
  const year = parts[0]
  const month = Number(parts[1])
  const day = Number(parts[2])
  const monthName = JALALI_MONTHS[month - 1] ?? parts[1] ?? ''
  return {
    label: toFaDigits(day),
    fullDate: `${toFaDigits(day)} ${monthName}`,
    iso: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
  }
}

function parseSeries(kind: HoldingKind, payload: TablePayload): MarketSeries | null {
  if (!Array.isArray(payload.data)) return null
  const points: MarketPoint[] = []

  for (const row of payload.data) {
    if (!Array.isArray(row) || row.length < 8) continue
    const price = parseRial(row[3])
    const jalali = String(row[7] ?? '')
    if (!price || !/^\d{4}\/\d{2}\/\d{2}$/.test(jalali)) continue
    const date = formatPointDate(jalali)
    points.push({ label: date.label, fullDate: date.fullDate, iso: date.iso, price })
  }

  if (points.length === 0) return null
  const latest = payload.data[0]
  const latestRow = Array.isArray(latest) ? latest : []
  return {
    kind,
    price: points[0].price,
    changePct: parseChangePct(latestRow[5]),
    date: points[0].fullDate,
    points: [...points].reverse(),
  }
}

export async function fetchMarketBoard() {
  const results = await Promise.allSettled(
    HOLDING_KINDS.map(async (kind) => {
      const response = await fetch(
        `https://api.tgju.org/v1/market/indicator/summary-table-data/${SYMBOLS[kind]}?length=30&start=0`,
      )
      if (!response.ok) throw new Error('market')
      const payload = (await response.json()) as TablePayload
      const series = parseSeries(kind, payload)
      if (!series) throw new Error('market')
      return series
    }),
  )

  return results.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : []))
}
