import { useState, type FormEvent } from 'react'
import { goalSaved, monthsToGoal } from '../domain/goals.ts'
import { Button, PageHeader, fieldClass } from '../components/ui.tsx'
import { formatNumber, parseAmount } from '../lib/money.ts'
import type { Goal } from '../types.ts'
import { useFinance } from '../store/finance.tsx'

export function GoalsPage() {
  const { state, month, saveGoal, deleteGoal } = useFinance()
  const [creating, setCreating] = useState(false)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow="پس‌انداز هدفمند" title="اهداف" action={<Button onClick={() => setCreating(true)}>هدف جدید</Button>} />
      {state.goals.length === 0 && !creating ? (
        <p className="text-sm text-mute">هنوز هدفی نیست. مثلاً خرید لپ‌تاپ یا صندوق اضطراری.</p>
      ) : null}
      <div className="grid gap-3">
        {state.goals.map((goal) => {
          const saved = goalSaved(goal, state.accounts, state.transactions)
          const ratio = goal.target > 0 ? Math.min(saved / goal.target, 1) : 0
          const remaining = Math.max(goal.target - saved, 0)
          const months = monthsToGoal(remaining, state.transactions, month)
          const account = state.accounts.find((item) => item.id === goal.accountId)
          return (
            <article key={goal.id} className="rounded-3xl border border-line bg-panel p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-bold">{goal.title}</h2>
                  <p className="mt-1 text-xs text-mute">{account ? `از حساب ${account.name}` : 'مبلغ دستی'}</p>
                </div>
                <button type="button" className="text-xs text-mute hover:text-out" onClick={() => deleteGoal(goal.id)}>
                  حذف
                </button>
              </div>
              <p className="mt-3 text-sm">
                {formatNumber(Math.round(saved))} از {formatNumber(goal.target)} تومان
              </p>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-raise">
                <div className="h-full rounded-full bg-gold" style={{ width: `${ratio * 100}%` }} />
              </div>
              <p className="mt-2 text-xs text-mute">
                {formatNumber(Math.round(ratio * 100))}٪
                {remaining <= 0
                  ? ' · به هدف رسیدی'
                  : months == null
                    ? ' · برای تخمین زمان، چند ماه پس‌انداز مثبت لازم است'
                    : months === 0
                      ? ''
                      : ` · با روند فعلی ${formatNumber(months)} ماه دیگر`}
              </p>
            </article>
          )
        })}
      </div>
      {creating ? (
        <GoalForm
          accounts={state.accounts}
          onClose={() => setCreating(false)}
          onSave={(goal) => {
            saveGoal(goal)
            setCreating(false)
          }}
        />
      ) : null}
    </div>
  )
}

function GoalForm({
  accounts,
  onSave,
  onClose,
}: {
  accounts: { id: string; name: string; archived: boolean }[]
  onSave: (goal: Goal) => void
  onClose: () => void
}) {
  const [title, setTitle] = useState('')
  const [target, setTarget] = useState('')
  const [saved, setSaved] = useState('')
  const [accountId, setAccountId] = useState('')
  const [error, setError] = useState('')

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    const amount = parseAmount(target)
    if (!title.trim() || amount <= 0) {
      setError('عنوان و مبلغ هدف لازم است.')
      return
    }
    onSave({
      id: '',
      title: title.trim(),
      target: amount,
      saved: accountId ? 0 : parseAmount(saved),
      accountId: accountId || undefined,
    })
  }

  return (
    <form className="rounded-3xl border border-line bg-panel p-5" onSubmit={onSubmit}>
      <h2 className="font-bold">هدف جدید</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-sm">
          عنوان
          <input className={fieldClass} value={title} maxLength={60} onChange={(event) => setTitle(event.target.value)} />
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          مبلغ هدف
          <input dir="ltr" className={`${fieldClass} text-end`} inputMode="numeric" value={target} onChange={(event) => setTarget(event.target.value)} />
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          وصل به حساب
          <select className={fieldClass} value={accountId} onChange={(event) => setAccountId(event.target.value)}>
            <option value="">مبلغ دستی</option>
            {accounts.filter((account) => !account.archived).map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
        </label>
        {accountId ? null : (
          <label className="flex flex-col gap-1.5 text-sm">
            پس‌انداز فعلی
            <input dir="ltr" className={`${fieldClass} text-end`} inputMode="numeric" value={saved} onChange={(event) => setSaved(event.target.value)} />
          </label>
        )}
      </div>
      {error ? <p className="mt-2 text-sm text-out">{error}</p> : null}
      <div className="mt-4 flex gap-2">
        <Button type="submit">ذخیره</Button>
        <Button tone="ghost" onClick={onClose}>انصراف</Button>
      </div>
    </form>
  )
}
