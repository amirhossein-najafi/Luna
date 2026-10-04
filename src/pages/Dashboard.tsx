import { Link } from 'react-router-dom'
import { DailyBars, ExpenseDonut } from '../components/Charts.tsx'
import { MarketBoard } from '../components/MarketBoard.tsx'
import { MonthSwitcher } from '../components/MonthSwitcher.tsx'
import { NetWorthChart } from '../components/NetWorthChart.tsx'
import { TransactionList } from '../components/TransactionList.tsx'
import { PageHeader } from '../components/ui.tsx'
import { cashPosition } from '../domain/ledger.ts'
import { monthInsights, savingsRate } from '../domain/insights.ts'
import { remainingCommitments, upcomingRules } from '../domain/recurring.ts'
import { netWorth } from '../domain/wealth.ts'
import { formatDayLabel, formatMonthLabel, todayJalali } from '../lib/jalali.ts'
import { formatNumber } from '../lib/money.ts'
import { expenseSlices, inMonth, recentDaySeries, totalOf } from '../lib/stats.ts'
import { useFinance } from '../store/finance.tsx'

export function DashboardPage() {
  const { state, month } = useFinance()
  const rows = inMonth(state.transactions, month)
  const income = totalOf(rows, 'income')
  const expense = totalOf(rows, 'expense')
  const balance = income - expense
  const rate = savingsRate(income, expense)
  const today = todayJalali()
  const insights = monthInsights(state.transactions, month, today)
  const liquid = cashPosition(state.accounts, state.transactions).liquid
  const worth = netWorth(state.accounts, state.transactions, state.lots, state.quotes)
  const commitments = remainingCommitments(state.recurring, month, today)
  const upcoming = upcomingRules(state.recurring, today).slice(0, 3)
  const slices = expenseSlices(rows)
  const days = recentDaySeries(rows, month)
  const top = slices.reduce<(typeof slices)[number] | null>((best, slice) => {
    if (!best || slice.value > best.value) return slice
    return best
  }, null)
  const latest = [...rows].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow="خلاصه ماه" title="داشبورد" action={<MonthSwitcher />} />

      {insights.length > 0 ? (
        <ul className="flex flex-col gap-2 rounded-3xl border border-line bg-panel px-5 py-4 text-sm">
          {insights.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      ) : null}

      <section className="grid gap-3 md:grid-cols-2">
        <article className="rounded-3xl border border-line bg-panel p-5">
          <p className="text-sm text-mute">موجودی نقدی</p>
          <p className="mt-2 text-2xl font-bold">{formatNumber(Math.round(liquid))} <span className="text-sm font-medium text-mute">تومان</span></p>
          <Link to="/accounts" className="mt-2 inline-block text-sm text-gold">حساب‌ها</Link>
        </article>
        <article className="rounded-3xl border border-gold/40 bg-panel p-5">
          <p className="text-sm text-mute">دارایی خالص</p>
          <p className="mt-2 text-2xl font-bold text-gold">{formatNumber(Math.round(worth))} <span className="text-sm font-medium text-mute">تومان</span></p>
          <div className="mt-3">
            <NetWorthChart accounts={state.accounts} transactions={state.transactions} lots={state.lots} quotes={state.quotes} />
          </div>
        </article>
      </section>

      <MarketBoard />

      <section className="grid gap-3 md:grid-cols-3">
        <Stat label="درآمد" value={formatNumber(income)} hint="تومان" tone="text-in" bar="bg-in" />
        <Stat label="هزینه" value={formatNumber(expense)} hint="تومان" tone="text-out" bar="bg-out" />
        <Stat
          label="مانده"
          value={`${balance < 0 ? '−' : ''}${formatNumber(Math.abs(balance))}`}
          hint={rate == null ? 'نرخ پس‌انداز وقتی درآمد باشد' : `نرخ پس‌انداز ${formatNumber(Math.round(rate * 100))}٪`}
          tone={balance < 0 ? 'text-out' : 'text-gold'}
          bar="bg-gold"
        />
      </section>

      <section className="grid gap-3 md:grid-cols-2">
        <article className="rounded-3xl border border-line bg-panel p-5">
          <h2 className="font-bold">تعهدات باقی‌مانده این ماه</h2>
          <p className="mt-2 text-xl font-bold">{formatNumber(commitments)} <span className="text-sm font-medium text-mute">تومان</span></p>
          <ul className="mt-3 flex flex-col gap-1 text-sm text-mute">
            {upcoming.length === 0 ? <li>پرداخت نزدیکی نیست.</li> : null}
            {upcoming.map((rule) => (
              <li key={rule.id}>
                {rule.title} — {formatDayLabel(rule.nextDate)}
              </li>
            ))}
          </ul>
          <Link to="/plans" className="mt-3 inline-block text-sm text-gold">پرداخت‌های آینده</Link>
        </article>
        <article className="rounded-3xl border border-line bg-panel p-5">
          <h2 className="font-bold">ادامه</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link to="/reports" className="rounded-2xl border border-line px-3 py-2 text-sm">گزارش</Link>
            <Link to="/goals" className="rounded-2xl border border-line px-3 py-2 text-sm">اهداف</Link>
            <Link to="/accounts" className="rounded-2xl border border-line px-3 py-2 text-sm">حساب‌ها</Link>
          </div>
        </article>
      </section>

      {rows.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-line bg-panel/70 px-6 py-12 text-center">
          <p className="font-medium">در {formatMonthLabel(month)} تراکنشی نیست</p>
          <p className="mx-auto mt-2 max-w-sm text-sm text-mute">
            یک هزینه یا درآمد ثبت کن تا مانده، نمودار دسته‌ها و روند روزها اینجا بیاید.
          </p>
          <Link
            to="/transactions?new=1"
            className="mt-5 inline-flex items-center justify-center rounded-2xl bg-gold px-4 py-2.5 text-sm font-medium text-on-gold"
          >
            ثبت تراکنش
          </Link>
        </div>
      ) : (
        <>
          <section className="grid gap-3 lg:grid-cols-2">
            <article className="rounded-3xl border border-line bg-panel p-5">
              <h2 className="font-bold">خرج دسته‌ها</h2>
              <p className="mt-1 text-sm text-mute">
                {top
                  ? `بیشترین خرج این ماه ${top.name} است، ${formatNumber(top.value)} تومان.`
                  : 'این ماه هزینه‌ای ثبت نشده.'}
              </p>
              <div className="mt-4">
                {slices.length > 0 ? (
                  <ExpenseDonut slices={slices} />
                ) : (
                  <p className="py-10 text-center text-sm text-mute">هزینه‌ای برای نمودار نیست.</p>
                )}
              </div>
            </article>
            <article className="min-w-0 rounded-3xl border border-line bg-panel p-5">
              <h2 className="font-bold">هفت روز اخیر</h2>
              <p className="mt-1 text-sm text-mute">سبز درآمد است و قرمز هزینه.</p>
              <div className="mt-4">
                <DailyBars days={days} />
              </div>
            </article>
          </section>

          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="font-bold">آخرین تراکنش‌ها</h2>
              <Link to="/transactions" className="text-sm text-gold">
                همه
              </Link>
            </div>
            <TransactionList items={latest} accounts={state.accounts} />
          </section>
        </>
      )}
    </div>
  )
}

function Stat({
  label,
  value,
  hint,
  tone,
  bar,
}: {
  label: string
  value: string
  hint: string
  tone: string
  bar: string
}) {
  return (
    <article className="rounded-3xl border border-line bg-panel p-4 sm:p-5">
      <span className={`mb-3 block h-1 w-8 rounded-full ${bar}`} />
      <p className="text-sm text-mute">{label}</p>
      <p dir="ltr" className={`mt-2 text-end text-xl font-bold tracking-tight sm:text-2xl ${tone}`}>
        {value}
      </p>
      <p className="mt-1 text-xs text-mute">{hint}</p>
    </article>
  )
}
