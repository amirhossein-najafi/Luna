import { useState, type FormEvent } from 'react'
import { upcomingRules } from '../domain/recurring.ts'
import { Button, PageHeader, fieldClass } from '../components/ui.tsx'
import { categoriesFor } from '../data/categories.ts'
import { JalaliDateField } from '../components/JalaliDateField.tsx'
import { formatDayLabel, todayJalali } from '../lib/jalali.ts'
import { formatNumber, parseAmount } from '../lib/money.ts'
import type { CustomCategory, FlowType, RecurringFrequency, RecurringRule } from '../types.ts'
import { useFinance } from '../store/finance.tsx'

export function PlansPage() {
  const { state, saveRecurring, deleteRecurring } = useFinance()
  const [creating, setCreating] = useState(false)
  const upcoming = upcomingRules(state.recurring, todayJalali())

  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow="تکرارشونده" title="پرداخت‌های آینده" action={<Button onClick={() => setCreating(true)}>قانون جدید</Button>} />
      <p className="text-sm text-mute">وقتی موعد برسد، تراکنش همان روز ساخته می‌شود و تاریخ بعد جلو می‌رود.</p>
      <div className="grid gap-3">
        {upcoming.length === 0 ? <p className="text-sm text-mute">پرداخت آینده‌ای نیست.</p> : null}
        {upcoming.map((rule) => (
          <article key={rule.id} className="rounded-3xl border border-line bg-panel p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-bold">{rule.title}</h2>
                <p className="mt-1 text-xs text-mute">
                  {formatDayLabel(rule.nextDate)} · {rule.frequency === 'monthly' ? 'ماهانه' : 'هفتگی'} · {rule.type === 'income' ? 'درآمد' : 'هزینه'}
                </p>
              </div>
              <p className={rule.type === 'income' ? 'font-bold text-in' : 'font-bold text-out'}>{formatNumber(rule.amount)}</p>
            </div>
            <button type="button" className="mt-3 text-xs text-mute hover:text-out" onClick={() => deleteRecurring(rule.id)}>
              حذف قانون
            </button>
          </article>
        ))}
      </div>
      {creating ? (
        <RuleForm
          accounts={state.accounts.filter((account) => !account.archived)}
          categories={state.categories}
          onClose={() => setCreating(false)}
          onSave={(rule) => {
            saveRecurring(rule)
            setCreating(false)
          }}
        />
      ) : null}
    </div>
  )
}

function RuleForm({
  accounts,
  categories,
  onSave,
  onClose,
}: {
  accounts: { id: string; name: string }[]
  categories: CustomCategory[]
  onSave: (rule: RecurringRule) => void
  onClose: () => void
}) {
  const [title, setTitle] = useState('')
  const [amount, setAmount] = useState('')
  const [type, setType] = useState<FlowType>('expense')
  const [categoryId, setCategoryId] = useState(categoriesFor('expense', categories)[0].id)
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '')
  const [frequency, setFrequency] = useState<RecurringFrequency>('monthly')
  const [nextDate, setNextDate] = useState(todayJalali())
  const [error, setError] = useState('')
  const options = categoriesFor(type, categories)

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    const value = parseAmount(amount)
    if (!title.trim() || value <= 0 || !accountId) {
      setError('عنوان، مبلغ و حساب لازم است.')
      return
    }
    onSave({
      id: '',
      title: title.trim(),
      amount: value,
      type,
      categoryId,
      accountId,
      frequency,
      nextDate,
    })
  }

  return (
    <form className="rounded-3xl border border-line bg-panel p-5" onSubmit={onSubmit}>
      <h2 className="font-bold">قانون جدید</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-sm">
          عنوان
          <input className={fieldClass} value={title} maxLength={60} onChange={(event) => setTitle(event.target.value)} />
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          مبلغ
          <input dir="ltr" className={`${fieldClass} text-end`} inputMode="numeric" value={amount} onChange={(event) => setAmount(event.target.value)} />
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          نوع
          <select
            className={fieldClass}
            value={type}
            onChange={(event) => {
              const next = event.target.value as FlowType
              setType(next)
              setCategoryId(categoriesFor(next, categories)[0].id)
            }}
          >
            <option value="expense">هزینه</option>
            <option value="income">درآمد</option>
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          دسته
          <select className={fieldClass} value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
            {options.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          حساب
          <select className={fieldClass} value={accountId} onChange={(event) => setAccountId(event.target.value)}>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          دوره
          <select className={fieldClass} value={frequency} onChange={(event) => setFrequency(event.target.value as RecurringFrequency)}>
            <option value="monthly">ماهانه</option>
            <option value="weekly">هفتگی</option>
          </select>
        </label>
        <div className="flex flex-col gap-1.5 text-sm sm:col-span-2">
          تاریخ بعد
          <JalaliDateField value={nextDate} onChange={setNextDate} />
        </div>
      </div>
      {error ? <p className="mt-2 text-sm text-out">{error}</p> : null}
      <div className="mt-4 flex gap-2">
        <Button type="submit">ذخیره</Button>
        <Button tone="ghost" onClick={onClose}>انصراف</Button>
      </div>
    </form>
  )
}
