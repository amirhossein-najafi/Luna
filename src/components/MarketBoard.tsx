import { useEffect, useRef, useState } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { fetchMarketBoard, type MarketSeries } from '../lib/market.ts'
import { formatCompact, formatNumber } from '../lib/money.ts'
import { useFinance } from '../store/finance.tsx'
import { HOLDING_KINDS, HOLDING_META, type HoldingKind } from '../types.ts'

function formatPct(value: number) {
  const sign = value > 0 ? '+' : value < 0 ? '−' : ''
  return `${sign}${formatNumber(Math.abs(value))}٪`
}

function DateTick({
  x = 0,
  y = 0,
  payload,
  index = 0,
  visibleTicksCount = 1,
}: {
  x?: string | number
  y?: string | number
  payload?: { value?: string }
  index?: number
  visibleTicksCount?: number
}) {
  const last = Math.max(visibleTicksCount - 1, 0)
  const anchor = index <= 0 ? 'start' : index >= last ? 'end' : 'middle'
  return (
    <text x={x} y={y} dy={12} textAnchor={anchor} fill="var(--mute)" fontSize={11}>
      {payload?.value}
    </text>
  )
}

function PriceTip({
  active,
  payload,
}: {
  active?: boolean
  payload?: ReadonlyArray<{ payload?: { fullDate?: string; price?: number } }>
}) {
  const point = payload?.[0]?.payload
  if (!active || !point) return null
  return (
    <div className="rounded-xl border border-line bg-panel px-3 py-2 text-xs shadow-lg" dir="rtl">
      <p className="text-mute">{point.fullDate}</p>
      <p className="mt-1 font-medium">{formatNumber(point.price ?? 0)} تومان</p>
    </div>
  )
}

export function MarketBoard() {
  const { setQuotes } = useFinance()
  const saveQuotes = useRef(setQuotes)
  const [series, setSeries] = useState<MarketSeries[]>([])
  const [selected, setSelected] = useState<HoldingKind>('usd')
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')

  useEffect(() => {
    saveQuotes.current = setQuotes
  }, [setQuotes])

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const next = await fetchMarketBoard()
        if (cancelled) return
        if (next.length === 0) {
          setStatus('error')
          return
        }
        setSeries(next)
        setStatus('ready')
        saveQuotes.current(
          next.map((item) => ({
            kind: item.kind,
            price: item.price,
            source: 'tgju' as const,
            fetchedAt: new Date().toISOString(),
            marketAt: item.points.at(-1)?.iso,
          })),
        )
      } catch {
        if (!cancelled) setStatus('error')
      }
    }

    void load()
    const timer = window.setInterval(() => void load(), 5 * 60 * 1000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [])

  const active = series.find((item) => item.kind === selected) ?? series[0]

  return (
    <section className="flex flex-col gap-3">
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {HOLDING_KINDS.map((kind) => {
          const item = series.find((entry) => entry.kind === kind)
          const change = item?.changePct
          const pressed = active?.kind === kind
          return (
            <button
              key={kind}
              type="button"
              aria-pressed={pressed}
              onClick={() => setSelected(kind)}
              className={`rounded-2xl border px-3 py-3 text-start transition ${
                pressed ? 'border-gold bg-panel' : 'border-line bg-panel hover:border-gold/50'
              }`}
            >
              <p className="truncate text-xs text-mute">{HOLDING_META[kind].name}</p>
              <p className="mt-1 truncate text-sm font-bold" dir="ltr">
                {item ? formatNumber(item.price) : status === 'loading' ? '…' : '—'}
              </p>
              <p className={`mt-1 text-xs ${change == null ? 'text-mute' : change < 0 ? 'text-out' : 'text-in'}`} dir="ltr">
                {change == null ? 'تومان' : formatPct(change)}
              </p>
            </button>
          )
        })}
      </div>

      <article className="rounded-3xl border border-line bg-panel p-4 sm:p-5">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="font-bold">روند {active ? HOLDING_META[active.kind].name : 'بازار'}</h2>
            <p className="mt-1 text-sm text-mute">
              {active ? `۳۰ روز اخیر، آخرین قیمت ${active.date}` : 'قیمت بازار آزاد به تومان'}
            </p>
          </div>
        </div>
        {active ? (
          <div className="mt-4 h-56" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={active.points} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
                <CartesianGrid vertical={false} stroke="var(--line)" />
                <XAxis
                  dataKey="fullDate"
                  tick={DateTick}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                  minTickGap={48}
                  height={28}
                  tickMargin={10}
                  padding={{ left: 12, right: 16 }}
                />
                <YAxis
                  tickFormatter={(value) => formatCompact(Number(value))}
                  tick={{ fill: 'var(--mute)', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={46}
                  tickMargin={8}
                  domain={['auto', 'auto']}
                />
                <Tooltip content={PriceTip} />
                <Line type="monotone" dataKey="price" name="قیمت" stroke="var(--gold)" strokeWidth={2} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="py-10 text-center text-sm text-mute">
            {status === 'loading' ? 'در حال دریافت قیمت بازار…' : 'قیمت بازار الان در دسترس نیست.'}
          </p>
        )}
      </article>
    </section>
  )
}
