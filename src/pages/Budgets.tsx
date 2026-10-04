import { useEffect, useState } from 'react'
import { categoriesFor } from '../data/categories.ts'
import { MonthSwitcher } from '../components/MonthSwitcher.tsx'
import { PageHeader, fieldClass } from '../components/ui.tsx'
import { formatNumber, parseAmount } from '../lib/money.ts'
import { spentInCategory } from '../lib/stats.ts'
import { useFinance } from '../store/finance.tsx'

export function BudgetsPage() {
  const { state, month, setBudget } = useFinance()
  const categories = categoriesFor('expense')

  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow="سقف هر دسته" title="بودجه" action={<MonthSwitcher />} />
      <p className="text-sm text-mute">برای هر دسته از هزینه‌های این ماه یک سقف بگذار. اگر خالی بماند، بودجه‌ای حساب نمی‌شود.</p>
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
  onSave,
}: {
  name: string
  tone: string
  spent: number
  limit: number
  onSave: (limit: number) => void
}) {
  const [draft, setDraft] = useState(limit ? String(limit) : '')
  useEffect(() => {
    setDraft(limit ? String(limit) : '')
  }, [limit])

  const ratio = limit > 0 ? spent / limit : 0
  const over = limit > 0 && spent > limit
  const width = Math.min(ratio, 1) * 100

  return (
    <article className="rounded-3xl border border-line bg-panel p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="size-2.5 rounded-full" style={{ background: tone }} />
          <h2 className="font-medium">{name}</h2>
        </div>
        <p className={`text-sm ${over ? 'text-out' : 'text-mute'}`}>
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
          onBlur={() => onSave(parseAmount(draft))}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur()
          }}
        />
      </label>
      {limit > 0 ? (
        <>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-raise">
            <div className="h-full rounded-full" style={{ width: `${width}%`, background: over ? 'var(--out)' : tone }} />
          </div>
          <p className={`mt-2 text-xs ${over ? 'text-out' : 'text-mute'}`}>
            {over
              ? `${formatNumber(spent - limit)} تومان از سقف گذشته`
              : `${formatNumber(Math.round(ratio * 100))}٪ از سقف پر شده`}
          </p>
        </>
      ) : spent > 0 ? (
        <p className="mt-3 text-xs text-mute">خرج ثبت شده، ولی سقفی نداری.</p>
      ) : null}
    </article>
  )
}
