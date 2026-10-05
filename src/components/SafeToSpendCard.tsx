import { negativeWithin, projectCashflow } from '../domain/forecast.ts'
import { safeToSpend, spendTone, type SpendTone } from '../domain/spend.ts'
import { formatDayLabel } from '../lib/jalali.ts'
import { formatNumber } from '../lib/money.ts'
import type { Account, Goal, RecurringRule, Transaction } from '../types.ts'
import { ForecastChart } from './ForecastChart.tsx'

const TONES: { id: SpendTone; label: string }[] = [
  { id: 'safe', label: 'امن' },
  { id: 'tight', label: 'کمی بالا' },
  { id: 'danger', label: 'خطرناک' },
]

function toneClass(tone: SpendTone) {
  if (tone === 'danger') return 'text-out'
  if (tone === 'tight') return 'text-gold'
  return 'text-in'
}

export function SafeToSpendCard({
  accounts,
  transactions,
  rules,
  goals,
  safetyBuffer,
  today,
}: {
  accounts: Account[]
  transactions: Transaction[]
  rules: RecurringRule[]
  goals: Goal[]
  safetyBuffer: number
  today: string
}) {
  const projection = projectCashflow({ accounts, transactions, rules, today, days: 90 })
  const base = safeToSpend({ accounts, transactions, rules, goals, safetyBuffer, today })
  const tone = spendTone(base.safeTotal, base.spendable, base.commitments, negativeWithin(projection, base.horizon))
  const spend = { ...base, tone }
  const shortfall = projection.firstNegative
  const shortAccount = accounts.find((account) => account.id === shortfall?.accountId)
  const daily = Math.round(spend.daily)

  return (
    <article className="rounded-3xl border border-gold/40 bg-panel p-5">
      <p className="text-sm text-mute">خرج امن امروز</p>
      <p className={`mt-2 text-3xl font-bold ${toneClass(tone)}`}>
        {formatNumber(Math.abs(daily))}
        <span className="ms-2 text-sm font-medium text-mute">تومان{daily < 0 ? ' کسری' : ''}</span>
      </p>
      <p className="mt-2 text-sm leading-6">
        {spend.paydayKnown
          ? `${formatNumber(spend.days)} روز تا درآمد بعدی`
          : `${formatNumber(spend.days)} روز تا پایان این ماه. درآمد تکرارشونده‌ای ثبت نشده`}
        <span className="text-mute"> · </span>
        {formatNumber(spend.paymentCount)} پرداخت در راه
      </p>
      <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
        <Row label="موجودی قابل خرج" value={spend.spendable} />
        <Row label="تعهدات قطعی" value={spend.commitments} />
        {spend.goalReserve > 0 ? <Row label="بودجه اهداف" value={spend.goalReserve} /> : null}
        {spend.safetyBuffer > 0 ? <Row label="بافر ایمنی" value={spend.safetyBuffer} /> : null}
      </dl>
      <div className="mt-4 grid grid-cols-3 gap-2" role="img" aria-label={TONES.find((item) => item.id === tone)?.label}>
        {TONES.map((item) => (
          <p
            key={item.id}
            className={`rounded-2xl px-2 py-2 text-center text-sm ${item.id === tone ? 'bg-raise font-bold' : 'text-mute'} ${item.id === tone ? toneClass(tone) : ''}`}
          >
            {item.label}
          </p>
        ))}
      </div>
      {shortfall && shortAccount ? (
        <p className="mt-4 text-sm leading-6 text-out">
          اگر برنامه فعلی بماند، {shortAccount.name} در {formatDayLabel(shortfall.date)} حدود {formatNumber(Math.abs(Math.round(shortfall.balance)))} تومان کسری دارد.
        </p>
      ) : null}
      <div className="mt-4">
        <ForecastChart accounts={accounts} transactions={transactions} rules={rules} today={today} />
      </div>
    </article>
  )
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl bg-raise px-3 py-2">
      <dt className="text-mute">{label}</dt>
      <dd>{formatNumber(Math.round(value))}</dd>
    </div>
  )
}
