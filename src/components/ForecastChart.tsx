import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { forecastSeries, type ForecastChartPoint } from '../domain/forecast.ts'
import { formatCompact, formatNumber } from '../lib/money.ts'
import type { Account, RecurringRule, Transaction } from '../types.ts'

function Tip({
  active,
  payload,
}: {
  active?: boolean
  payload?: ReadonlyArray<{ payload?: ForecastChartPoint }>
}) {
  const point = payload?.[0]?.payload
  if (!active || !point) return null
  const value = point.forecast ?? point.actual
  if (value == null) return null
  return (
    <div className="rounded-xl border border-line bg-panel px-3 py-2 text-xs shadow-lg" dir="rtl">
      <p className="text-mute">{point.label}</p>
      <p className="mt-1 font-medium">{formatNumber(Math.round(value))} تومان</p>
    </div>
  )
}

export function ForecastChart({
  accounts,
  transactions,
  rules,
  today,
}: {
  accounts: Account[]
  transactions: Transaction[]
  rules: RecurringRule[]
  today: string
}) {
  const points = forecastSeries({ accounts, transactions, rules, today, historyDays: 30, forwardDays: 30 })
  return (
    <div>
      <p className="text-sm text-mute">خط پر تا امروز واقعی است و خط‌چین موجودی پیش‌بینی‌شده است.</p>
      <div className="mt-3 h-56" dir="ltr">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
            <CartesianGrid vertical={false} stroke="var(--line)" />
            <XAxis dataKey="label" tick={{ fill: 'var(--mute)', fontSize: 11 }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={48} />
            <YAxis tickFormatter={(value) => formatCompact(Number(value))} tick={{ fill: 'var(--mute)', fontSize: 11 }} axisLine={false} tickLine={false} width={46} />
            <Tooltip content={Tip} />
            <Line type="monotone" dataKey="actual" name="واقعی" stroke="var(--gold)" strokeWidth={2} dot={false} connectNulls={false} isAnimationActive={false} />
            <Line type="monotone" dataKey="forecast" name="پیش‌بینی" stroke="var(--in)" strokeWidth={2} strokeDasharray="5 4" dot={false} connectNulls={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
