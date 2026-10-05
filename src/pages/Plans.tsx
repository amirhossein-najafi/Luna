import { useState, type FormEvent } from 'react'
import { JalaliDateField } from '../components/JalaliDateField.tsx'
import { SubscriptionHints } from '../components/SubscriptionHints.tsx'
import { Button, PageHeader, fieldClass } from '../components/ui.tsx'
import { categoriesFor } from '../data/categories.ts'
import { projectCashflow, type TimelineEntry } from '../domain/forecast.ts'
import { formatDayLabel, todayJalali } from '../lib/jalali.ts'
import { formatNumber, parseAmount } from '../lib/money.ts'
import { useFinance } from '../store/finance.tsx'
import type { Account, CustomCategory, FlowType, RecurringFrequency, RecurringRule } from '../types.ts'

export function PlansPage() {
  const { state, saveRecurring, deleteRecurring, payOccurrence, skipOccurrence, postponeOccurrence, editOccurrence } = useFinance()
  const [creating, setCreating] = useState(false)
  const today = todayJalali()
  const projection = projectCashflow({
    accounts: state.accounts,
    transactions: state.transactions,
    rules: state.recurring,
    today,
    days: 90,
  })
  const overdue = projection.timeline.filter((item) => item.overdue)
  const upcoming = projection.timeline.filter((item) => !item.overdue)
  const groups = groupByDate(upcoming)
  const shortfall = projection.firstNegative
  const shortAccount = state.accounts.find((account) => account.id === shortfall?.accountId)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow="تایم‌لاین پول" title="پرداخت‌های آینده" action={<Button onClick={() => setCreating(true)}>قانون جدید</Button>} />
      <p className="text-sm text-mute">تا وقتی پرداخت را تأیید نکنی تراکنشی ساخته نمی‌شود. رد کردن، عقب انداختن و ویرایش فقط همان نوبت را عوض می‌کند.</p>

      <section className="grid gap-3 sm:grid-cols-3">
        {projection.horizons.map((item) => (
          <article key={item.days} className="rounded-3xl border border-line bg-panel p-4">
            <p className="text-sm text-mute">{formatNumber(item.days)} روز بعد</p>
            <p className={`mt-2 text-xl font-bold ${item.spendable < 0 ? 'text-out' : ''}`}>{formatNumber(Math.round(item.spendable))}</p>
            <p className="mt-1 text-xs text-mute">موجودی قابل خرج · {formatDayLabel(item.date)}</p>
          </article>
        ))}
      </section>

      {shortfall && shortAccount ? (
        <p className="rounded-3xl border border-out/40 bg-panel px-5 py-4 text-sm leading-6 text-out">
          اگر برنامه فعلی بماند، {shortAccount.name} در {formatDayLabel(shortfall.date)} حدود {formatNumber(Math.abs(Math.round(shortfall.balance)))} تومان کسری دارد.
        </p>
      ) : null}

      {overdue.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="font-bold">عقب‌افتاده</h2>
          {overdue.map((item) => (
            <OccurrenceCard
              key={`${item.ruleId}-${item.occurrenceDate}`}
              item={item}
              accounts={state.accounts}
              categories={state.categories}
              onPay={() => payOccurrence(item.ruleId, item.occurrenceDate)}
              onSkip={() => skipOccurrence(item.ruleId, item.occurrenceDate)}
              onPostpone={(date) => postponeOccurrence(item.ruleId, item.occurrenceDate, date)}
              onEdit={(patch) => editOccurrence(item.ruleId, item.occurrenceDate, patch)}
            />
          ))}
        </section>
      ) : null}

      <section className="flex flex-col gap-5">
        {groups.length === 0 && overdue.length === 0 ? <p className="text-sm text-mute">در ۹۰ روز آینده پرداختی نیست.</p> : null}
        {groups.map((group) => (
          <div key={group.date} className="flex flex-col gap-3">
            <h2 className="text-sm font-bold text-mute">{formatDayLabel(group.date)}</h2>
            {group.items.map((item) => (
              <OccurrenceCard
                key={`${item.ruleId}-${item.occurrenceDate}`}
                item={item}
                accounts={state.accounts}
                categories={state.categories}
                onPay={() => payOccurrence(item.ruleId, item.occurrenceDate)}
                onSkip={() => skipOccurrence(item.ruleId, item.occurrenceDate)}
                onPostpone={(date) => postponeOccurrence(item.ruleId, item.occurrenceDate, date)}
                onEdit={(patch) => editOccurrence(item.ruleId, item.occurrenceDate, patch)}
              />
            ))}
          </div>
        ))}
      </section>

      {state.recurring.length > 0 ? (
        <section className="rounded-3xl border border-line bg-panel p-5">
          <h2 className="font-bold">قانون‌ها</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {state.recurring.map((rule) => (
              <li key={rule.id} className="flex items-center justify-between gap-3 text-sm">
                <span>
                  {rule.title}
                  <span className="ms-2 text-xs text-mute">{rule.frequency === 'monthly' ? 'ماهانه' : 'هفتگی'}</span>
                </span>
                <button type="button" className="text-xs text-mute hover:text-out" onClick={() => deleteRecurring(rule.id)}>
                  حذف قانون
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

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

      <SubscriptionHints />
    </div>
  )
}

function groupByDate(items: TimelineEntry[]) {
  const groups: { date: string; items: TimelineEntry[] }[] = []
  for (const item of items) {
    const last = groups[groups.length - 1]
    if (!last || last.date !== item.date) groups.push({ date: item.date, items: [item] })
    else last.items.push(item)
  }
  return groups
}

function OccurrenceCard({
  item,
  accounts,
  categories,
  onPay,
  onSkip,
  onPostpone,
  onEdit,
}: {
  item: TimelineEntry
  accounts: Account[]
  categories: CustomCategory[]
  onPay: () => void
  onSkip: () => void
  onPostpone: (date: string) => void
  onEdit: (patch: { amount: number; categoryId: string; accountId: string }) => void
}) {
  const [moving, setMoving] = useState(false)
  const [editing, setEditing] = useState(false)
  const [date, setDate] = useState(item.date)
  const [amount, setAmount] = useState(String(item.amount))
  const [categoryId, setCategoryId] = useState(item.categoryId)
  const [accountId, setAccountId] = useState(item.accountId)
  const account = accounts.find((candidate) => candidate.id === item.accountId)
  const options = categoriesFor(item.type, categories)

  return (
    <article className="rounded-3xl border border-line bg-panel p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-bold">{item.title}</h3>
          <p className="mt-1 text-xs text-mute">
            {account?.name ?? 'حساب'} · بعد از این نوبت {formatNumber(Math.round(item.balanceAfter))}
          </p>
        </div>
        <p className={item.type === 'income' ? 'font-bold text-in' : 'font-bold text-out'}>
          {item.type === 'income' ? '+' : '−'}
          {formatNumber(item.amount)}
        </p>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button onClick={onPay}>پرداخت شد</Button>
        <Button tone="ghost" onClick={onSkip}>رد کردن</Button>
        <Button tone="ghost" onClick={() => setMoving((value) => !value)}>عقب انداختن</Button>
        <Button tone="ghost" onClick={() => setEditing((value) => !value)}>ویرایش فقط این دفعه</Button>
      </div>
      {moving ? (
        <div className="mt-3 flex flex-col gap-2">
          <JalaliDateField value={date} onChange={setDate} />
          <Button
            onClick={() => {
              onPostpone(date)
              setMoving(false)
            }}
          >
            ثبت تعویق
          </Button>
        </div>
      ) : null}
      {editing ? (
        <form
          className="mt-3 grid gap-2 sm:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault()
            const value = parseAmount(amount)
            if (value <= 0 || !accountId) return
            onEdit({ amount: value, categoryId, accountId })
            setEditing(false)
          }}
        >
          <input dir="ltr" className={`${fieldClass} text-end`} inputMode="numeric" aria-label="مبلغ این نوبت" value={amount} onChange={(event) => setAmount(event.target.value)} />
          <select className={fieldClass} aria-label="دسته این نوبت" value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
            {options.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          <select className={fieldClass} aria-label="حساب این نوبت" value={accountId} onChange={(event) => setAccountId(event.target.value)}>
            {accounts.filter((candidate) => !candidate.archived).map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.name}
              </option>
            ))}
          </select>
          <Button type="submit">ذخیره این نوبت</Button>
        </form>
      ) : null}
    </article>
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
