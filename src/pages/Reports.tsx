import { useState } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { CashFlow } from '../components/CashFlow.tsx'
import { MonthlyBars } from '../components/Charts.tsx'
import { PageHeader, fieldClass } from '../components/ui.tsx'
import { categoriesFor } from '../data/categories.ts'
import { inflationGap, monthsBetween, realValue } from '../domain/inflation.ts'
import { categoryTrend, monthPoints, savingsRate } from '../domain/insights.ts'
import { formatMonthLabel, shiftMonth } from '../lib/jalali.ts'
import { formatCompact, formatNumber, parseAmount } from '../lib/money.ts'
import { inMonth, totalOf } from '../lib/stats.ts'
import { useFinance } from '../store/finance.tsx'

export function ReportsPage() {
  const { state, month, setInflationRate } = useFinance()
  const expenseCategories = categoriesFor('expense', state.categories)
  const [span, setSpan] = useState<6 | 12>(6)
  const [categoryId, setCategoryId] = useState(expenseCategories[0].id)
  const points = monthPoints(state.transactions, month, span)
  const trend = categoryTrend(state.transactions, month, categoryId, span)
  const current = inMonth(state.transactions, month)
  const previous = inMonth(state.transactions, shiftMonth(month, -1))
  const income = totalOf(current, 'income')
  const expense = totalOf(current, 'expense')
  const prevExpense = totalOf(previous, 'expense')
  const rate = savingsRate(income, expense)
  const category = expenseCategories.find((item) => item.id === categoryId) ?? expenseCategories[0]
  const gap = inflationGap(expense, prevExpense, state.inflationRate)
  const realPoints = points.map((point) => ({
    ...point,
    real: realValue(point.expense, Math.max(0, monthsBetween(point.month, month)), state.inflationRate),
  }))

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
          <select className={`${fieldClass} max-w-48`} aria-label="دسته" value={category.id} onChange={(event) => setCategoryId(event.target.value)}>
            {expenseCategories.map((item) => (
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

      <article className="rounded-3xl border border-line bg-panel p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-bold">خرج و تورم</h2>
            <p className="mt-1 text-sm text-mute">
              {gap
                ? `با تورم سالانه ${formatNumber(state.inflationRate)}٪، خرج این ماه ${formatNumber(gap.percent)}٪ ${gap.higher ? 'بیشتر' : 'کمتر'} از ارزش امروزِ ماه قبل است.`
                : 'ارزش امروزِ خرج ماه‌های قبل با نرخ سالانه‌ای که خودت می‌نویسی حساب می‌شود.'}
            </p>
          </div>
          <label className="flex items-center gap-2 text-xs text-mute">
            درصد سالانه
            <input
              dir="ltr"
              className={`${fieldClass} w-24 text-end`}
              inputMode="numeric"
              aria-label="نرخ تورم سالانه"
              defaultValue={state.inflationRate}
              key={state.inflationRate}
              onBlur={(event) => setInflationRate(parseAmount(event.currentTarget.value))}
            />
          </label>
        </div>
        <div className="mt-4 h-56" dir="ltr">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={realPoints} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--line)" />
              <XAxis dataKey="label" tick={{ fill: 'var(--mute)', fontSize: 10 }} axisLine={false} tickLine={false} interval={0} />
              <YAxis tickFormatter={(value) => formatCompact(Number(value))} tick={{ fill: 'var(--mute)', fontSize: 11 }} axisLine={false} tickLine={false} width={42} />
              <Tooltip
                content={({ active, payload }) => {
                  const row = payload?.[0]?.payload as { label?: string; expense?: number; real?: number } | undefined
                  if (!active || !row) return null
                  return (
                    <div className="rounded-xl border border-line bg-panel px-3 py-2 text-xs" dir="rtl">
                      <p className="text-mute">{row.label}</p>
                      <p className="mt-1">خرج {formatNumber(row.expense ?? 0)}</p>
                      <p>ارزش امروز {formatNumber(row.real ?? 0)}</p>
                    </div>
                  )
                }}
              />
              <Line type="monotone" dataKey="expense" name="خرج" stroke="var(--out)" strokeWidth={2} dot={false} isAnimationActive={false} />
              <Line type="monotone" dataKey="real" name="ارزش امروز" stroke="var(--gold)" strokeWidth={2} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </article>

      <article className="rounded-3xl border border-line bg-panel p-5">
        <h2 className="font-bold">جریان پول</h2>
        <p className="mt-1 text-sm text-mute">درآمد از چپ وارد می‌شود و هزینه و پس‌انداز از راست خارج می‌شوند.</p>
        <div className="mt-4 overflow-x-auto">
          <CashFlow transactions={current} categories={state.categories} />
        </div>
      </article>
    </div>
  )
}
