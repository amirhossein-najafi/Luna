import { useEffect, useState } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { cashPosition } from '../domain/ledger.ts'
import { quantityOf } from '../domain/wealth.ts'
import { fetchMarketBoard, type MarketSeries } from '../lib/market.ts'
import { formatCompact, formatNumber } from '../lib/money.ts'
import { HOLDING_KINDS, type Account, type AssetLot, type Quote, type Transaction } from '../types.ts'

type Point = { label: string; net: number }

function Tip({
  active,
  payload,
}: {
  active?: boolean
  payload?: ReadonlyArray<{ payload?: Point }>
}) {
  const point = payload?.[0]?.payload
  if (!active || !point) return null
  return (
    <div className="rounded-xl border border-line bg-panel px-3 py-2 text-xs shadow-lg" dir="rtl">
      <p className="text-mute">{point.label}</p>
      <p className="mt-1 font-medium">{formatNumber(Math.round(point.net))} تومان</p>
    </div>
  )
}

export function NetWorthChart({
  accounts,
  transactions,
  lots,
  quotes,
}: {
  accounts: Account[]
  transactions: Transaction[]
  lots: AssetLot[]
  quotes: Quote[]
}) {
  const [series, setSeries] = useState<MarketSeries[] | null>(null)

  useEffect(() => {
    let cancelled = false
    void fetchMarketBoard().then((next) => {
      if (!cancelled) setSeries(next)
    }).catch(() => {
      if (!cancelled) setSeries([])
    })
    return () => {
      cancelled = true
    }
  }, [])

  if (series == null) return <p className="py-8 text-center text-sm text-mute">در حال چیدن نمودار دارایی خالص…</p>
  const spine = series.reduce<MarketSeries | null>((best, item) => {
    if (!best || item.points.length > best.points.length) return item
    return best
  }, null)
  if (!spine || spine.points.length < 2) return <p className="py-8 text-center text-sm text-mute">برای نمودار ۳۰ روز، قیمت بازار کافی نیست.</p>

  const points: Point[] = spine.points.map((point) => {
    const liquid = cashPosition(accounts, transactions, point.iso).liquid
    const assets = HOLDING_KINDS.reduce((sum, kind) => {
      const price = series.find((item) => item.kind === kind)?.points.find((row) => row.iso === point.iso)?.price
        ?? quotes.find((quote) => quote.kind === kind)?.price
        ?? 0
      return sum + quantityOf(lots, kind, point.iso) * price
    }, 0)
    return { label: point.fullDate, net: liquid + assets }
  })
  const first = points[0].net
  const last = points[points.length - 1].net
  const delta = first !== 0 ? ((last - first) / Math.abs(first)) * 100 : null

  return (
    <div>
      <p className={`text-sm ${delta != null && delta < 0 ? 'text-out' : 'text-in'}`}>
        {delta == null
          ? 'مقایسه با ابتدای این بازه ممکن نیست.'
          : `${delta >= 0 ? '↑' : '↓'} ${formatNumber(Math.abs(Math.round(delta * 10) / 10))}٪ نسبت به ابتدای ۳۰ روز`}
      </p>
      <div className="mt-3 h-56" dir="ltr">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
            <CartesianGrid vertical={false} stroke="var(--line)" />
            <XAxis dataKey="label" tick={{ fill: 'var(--mute)', fontSize: 11 }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={48} />
            <YAxis tickFormatter={(value) => formatCompact(Number(value))} tick={{ fill: 'var(--mute)', fontSize: 11 }} axisLine={false} tickLine={false} width={46} />
            <Tooltip content={Tip} />
            <Line type="monotone" dataKey="net" name="دارایی خالص" stroke="var(--gold)" strokeWidth={2} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
