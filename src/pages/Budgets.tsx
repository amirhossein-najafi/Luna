import { useEffect, useState } from 'react'
import { categoriesFor } from '../data/categories.ts'
import { budgetStatus, daysBeforeBudgetEnds } from '../domain/budget.ts'
import { MonthSwitcher } from '../components/MonthSwitcher.tsx'
import { PageHeader, fieldClass } from '../components/ui.tsx'
import { todayJalali } from '../lib/jalali.ts'
import { formatNumber, parseAmount, toFaDigits } from '../lib/money.ts'
import { spentInCategory, totalOf, inMonth } from '../lib/stats.ts'
import { useFinance } from '../store/finance.tsx'

export function BudgetsPage() {
  const { state, month, setBudget, setMonthBudget } = useFinance()
  const categories = categoriesFor('expense', state.categories)
  const monthLimit = state.monthBudgets.find((budget) => budget.month === month)?.limit ?? 0
  const monthSpent = totalOf(inMonth(state.transactions, month), 'expense')

  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow="سقف هر دسته" title="بودجه" action={<MonthSwitcher />} />
      <p className="text-sm text-mute">زیر ۸۰٪ سبز است، از ۸۰ تا ۱۰۰ نزدیک سقف، و بالاتر از سقف قرمز.</p>
      <BudgetRow
        name="سقف کل ماه"
        tone="var(--gold)"
        spent={monthSpent}
        limit={monthLimit}
        month={month}
        onSave={(next) => setMonthBudget({ month, limit: next })}
      />
      <div className="grid gap-3">
        {categories.map((category) => {
          const spent = spentInCategory(state.transactions, month, category.id)
          const limit = state.budgets.find((budget) => budget.categoryId === category.id && budget.month === month)?.limit ?? 0
          return (
            <BudgetRow
              key={`${category.id}-${month}`}
              name={category.name}
              tone={category.tone}
              spent={spent}
              limit={limit}
              month={month}
              onSave={(next) => setBudget({ categoryId: category.id, month, limit: next })}
            />
          )
        })}
      </div>
    </div>
  )
}

function BudgetRow({
  name,
  tone,
  spent,
  limit,
  month,
  onSave,
}: {
  name: string
  tone: string
  spent: number
  limit: number
  month: string
  onSave: (limit: number) => void
}) {
  const [draft, setDraft] = useState(limit ? String(limit) : '')
  useEffect(() => {
    setDraft(limit ? String(limit) : '')
  }, [limit])

  const ratio = limit > 0 ? spent / limit : 0
  const status = budgetStatus(spent, limit)
  const runway = daysBeforeBudgetEnds(spent, limit, month, todayJalali())
  const toneClass = status === 'over' ? 'text-out' : status === 'near' ? 'text-gold' : 'text-in'
  const bar = status === 'over' ? 'var(--out)' : status === 'near' ? 'var(--gold)' : tone
  const width = Math.min(ratio, 1) * 100

  return (
    <article className="rounded-3xl border border-line bg-panel p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="size-2.5 rounded-full" style={{ background: tone }} />
          <h2 className="font-medium">{name}</h2>
        </div>
        <p className={`text-sm ${status ? toneClass : 'text-mute'}`}>
          {formatNumber(spent)}
          {limit > 0 ? ` از ${formatNumber(limit)}` : ''} تومان
        </p>
      </div>
      <label className="mt-3 flex flex-col gap-1.5 text-xs text-mute">
        سقف این ماه
        <input
          dir="ltr"
          className={`${fieldClass} text-end`}
          inputMode="numeric"
          value={draft}
          placeholder="بدون سقف"
          onChange={(event) => setDraft(event.target.value)}
          onBlur={(event) => onSave(parseAmount(event.currentTarget.value))}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur()
          }}
        />
      </label>
      {limit > 0 ? (
        <>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-raise">
            <div className="h-full rounded-full" style={{ width: `${width}%`, background: bar }} />
          </div>
          <p className={`mt-2 text-xs ${toneClass}`}>
            {status === 'over'
              ? `${formatNumber(spent - limit)} تومان از سقف گذشته`
              : `${formatNumber(Math.round(ratio * 100))}٪ از سقف پر شده`}
            {runway ? ` · با روند فعلی ${toFaDigits(runway)} روز قبل از پایان ماه تمام می‌شود` : ''}
          </p>
        </>
      ) : spent > 0 ? (
        <p className="mt-3 text-xs text-mute">خرج ثبت شده، ولی سقفی نداری.</p>
      ) : null}
    </article>
  )
}
