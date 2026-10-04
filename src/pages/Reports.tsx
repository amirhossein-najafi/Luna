import { useState } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { MonthlyBars } from '../components/Charts.tsx'
import { PageHeader, fieldClass } from '../components/ui.tsx'
import { categoriesFor } from '../data/categories.ts'
import { categoryTrend, monthPoints, savingsRate } from '../domain/insights.ts'
import { formatMonthLabel, shiftMonth } from '../lib/jalali.ts'
import { formatCompact, formatNumber } from '../lib/money.ts'
import { inMonth, totalOf } from '../lib/stats.ts'
import { useFinance } from '../store/finance.tsx'

export function ReportsPage() {
  const { state, month } = useFinance()
  const [span, setSpan] = useState<6 | 12>(6)
  const [categoryId, setCategoryId] = useState(categoriesFor('expense')[0].id)
  const points = monthPoints(state.transactions, month, span)
  const trend = categoryTrend(state.transactions, month, categoryId, span)
  const current = inMonth(state.transactions, month)
  const previous = inMonth(state.transactions, shiftMonth(month, -1))
  const income = totalOf(current, 'income')
  const expense = totalOf(current, 'expense')
  const prevExpense = totalOf(previous, 'expense')
  const rate = savingsRate(income, expense)
  const category = categoriesFor('expense').find((item) => item.id === categoryId)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow={formatMonthLabel(month)}
        title="گزارش"
        action={
          <div className="flex rounded-2xl bg-raise p-1">
            {([6, 12] as const).map((item) => (
              <button
                key={item}
                type="button"
                className={`rounded-xl px-3 py-1.5 text-sm ${span === item ? 'bg-panel font-medium' : 'text-mute'}`}
                onClick={() => setSpan(item)}
              >
                {formatNumber(item)} ماه
              </button>
            ))}
          </div>
        }
      />

      <section className="grid gap-3 md:grid-cols-3">
        <article className="rounded-3xl border border-line bg-panel p-5">
          <p className="text-sm text-mute">نرخ پس‌انداز</p>
          <p className="mt-2 text-2xl font-bold text-gold">{rate == null ? '—' : `${formatNumber(Math.round(rate * 100))}٪`}</p>
          <p className="mt-1 text-xs text-mute">{rate == null ? 'این ماه درآمدی نیست.' : 'سهم مانده از درآمد این ماه'}</p>
        </article>
        <article className="rounded-3xl border border-line bg-panel p-5">
          <p className="text-sm text-mute">خرج این ماه</p>
          <p className="mt-2 text-2xl font-bold">{formatNumber(expense)}</p>
          <p className="mt-1 text-xs text-mute">
            {prevExpense > 0
              ? `${expense <= prevExpense ? 'کمتر' : 'بیشتر'} از ${formatMonthLabel(shiftMonth(month, -1))} با ${formatNumber(prevExpense)}`
              : 'ماه قبل هزینه‌ای نبود.'}
          </p>
        </article>
        <article className="rounded-3xl border border-line bg-panel p-5">
          <p className="text-sm text-mute">درآمد این ماه</p>
          <p className="mt-2 text-2xl font-bold text-in">{formatNumber(income)}</p>
        </article>
      </section>

      <article className="rounded-3xl border border-line bg-panel p-5">
        <h2 className="font-bold">درآمد در برابر هزینه</h2>
        <div className="mt-4">
          <MonthlyBars points={points.map((point) => ({ label: point.label, income: point.income, expense: point.expense }))} />
        </div>
      </article>

      <article className="rounded-3xl border border-line bg-panel p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-bold">روند دسته</h2>
            <p className="mt-1 text-sm text-mute">{category?.name}</p>
          </div>
          <select className={`${fieldClass} max-w-48`} aria-label="دسته" value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
            {categoriesFor('expense').map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </div>
        <div className="mt-4 h-56" dir="ltr">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--line)" />
              <XAxis dataKey="label" tick={{ fill: 'var(--mute)', fontSize: 10 }} axisLine={false} tickLine={false} interval={0} />
              <YAxis tickFormatter={(value) => formatCompact(Number(value))} tick={{ fill: 'var(--mute)', fontSize: 11 }} axisLine={false} tickLine={false} width={42} />
              <Tooltip
                content={({ active, payload }) => {
                  const row = payload?.[0]?.payload as { label?: string; spent?: number } | undefined
                  if (!active || !row) return null
                  return (
                    <div className="rounded-xl border border-line bg-panel px-3 py-2 text-xs" dir="rtl">
                      <p className="text-mute">{row.label}</p>
                      <p className="mt-1">{formatNumber(row.spent ?? 0)} تومان</p>
                    </div>
                  )
                }}
              />
              <Line type="monotone" dataKey="spent" name="هزینه" stroke="var(--gold)" strokeWidth={2} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </article>
    </div>
  )
}
