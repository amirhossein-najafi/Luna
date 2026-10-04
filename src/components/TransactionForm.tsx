import { useState, type FormEvent } from 'react'
import { categoriesFor } from '../data/categories.ts'
import { parseJalaliDate } from '../lib/jalali.ts'
import { formatNumber, parseAmount } from '../lib/money.ts'
import { ACCOUNT_META, type Account, type Transaction, type TransactionType } from '../types.ts'
import { JalaliDateField } from './JalaliDateField.tsx'
import { Button, fieldClass } from './ui.tsx'

const TYPE_LABEL: Record<TransactionType, string> = {
  expense: 'هزینه',
  income: 'درآمد',
  transfer: 'انتقال',
}

export function TransactionForm({
  initial,
  defaultDate,
  accounts,
  onSave,
  onClose,
}: {
  initial?: Transaction
  defaultDate: string
  accounts: Account[]
  onSave: (tx: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => void
  onClose: () => void
}) {
  const openAccounts = accounts.filter((account) => !account.archived || account.id === initial?.accountId || account.id === initial?.toAccountId)
  const [type, setType] = useState<TransactionType>(initial?.type ?? 'expense')
  const [amount, setAmount] = useState(initial ? String(initial.amount) : '')
  const [categoryId, setCategoryId] = useState(
    initial?.categoryId || categoriesFor('expense')[0].id,
  )
  const [accountId, setAccountId] = useState(initial?.accountId || openAccounts[0]?.id || '')
  const [toAccountId, setToAccountId] = useState(initial?.toAccountId || openAccounts.find((account) => account.id !== accountId)?.id || '')
  const [date, setDate] = useState(initial?.date ?? defaultDate)
  const [note, setNote] = useState(initial?.note ?? '')
  const [error, setError] = useState('')
  const options = type === 'transfer' ? [] : categoriesFor(type)
  const preview = parseAmount(amount)

  function changeType(next: TransactionType) {
    setType(next)
    if (next === 'transfer') return
    const nextOptions = categoriesFor(next)
    if (!nextOptions.some((category) => category.id === categoryId)) {
      setCategoryId(nextOptions[0].id)
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (preview <= 0) {
      setError('مبلغ باید بیشتر از صفر باشد.')
      return
    }
    if (!parseJalaliDate(date)) {
      setError('تاریخ شمسی معتبر نیست.')
      return
    }
    if (!accountId) {
      setError('یک حساب انتخاب کن.')
      return
    }
    if (type === 'transfer' && (!toAccountId || toAccountId === accountId)) {
      setError('مقصد انتقال باید حساب دیگری باشد.')
      return
    }
    onSave({
      id: initial?.id,
      type,
      amount: preview,
      categoryId: type === 'transfer' ? '' : categoryId,
      accountId,
      toAccountId: type === 'transfer' ? toAccountId : undefined,
      date,
      note: note.trim(),
    })
    onClose()
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={onSubmit}>
      <div className="grid grid-cols-3 gap-2 rounded-2xl bg-raise p-1">
        {(['expense', 'income', 'transfer'] as const).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => changeType(item)}
            className={`rounded-xl py-2 text-sm ${type === item ? 'bg-panel font-medium' : 'text-mute'}`}
            aria-pressed={type === item}
          >
            {TYPE_LABEL[item]}
          </button>
        ))}
      </div>
      <label className="flex flex-col gap-1.5 text-sm">
        مبلغ (تومان)
        <input
          autoFocus
          dir="ltr"
          inputMode="numeric"
          className={`${fieldClass} text-end`}
          value={amount}
          placeholder="مثلاً ۱۵۰۰۰۰"
          onChange={(event) => setAmount(event.target.value)}
        />
        {preview > 0 ? <span className="text-xs text-mute">{formatNumber(preview)} تومان</span> : null}
      </label>
      <label className="flex flex-col gap-1.5 text-sm">
        {type === 'transfer' ? 'از حساب' : 'حساب'}
        <select className={fieldClass} value={accountId} onChange={(event) => setAccountId(event.target.value)}>
          {openAccounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name} · {ACCOUNT_META[account.kind]}
            </option>
          ))}
        </select>
      </label>
      {type === 'transfer' ? (
        <label className="flex flex-col gap-1.5 text-sm">
          به حساب
          <select className={fieldClass} value={toAccountId} onChange={(event) => setToAccountId(event.target.value)}>
            {openAccounts
              .filter((account) => account.id !== accountId)
              .map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name} · {ACCOUNT_META[account.kind]}
                </option>
              ))}
          </select>
        </label>
      ) : (
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
      )}
      <div className="flex flex-col gap-1.5 text-sm">
        تاریخ
        <JalaliDateField value={date} onChange={setDate} />
      </div>
      <label className="flex flex-col gap-1.5 text-sm">
        یادداشت
        <input
          className={fieldClass}
          value={note}
          maxLength={140}
          placeholder={type === 'transfer' ? 'مثلاً برداشت از بانک' : 'مثلاً ناهار یا کرایه تاکسی'}
          onChange={(event) => setNote(event.target.value)}
        />
      </label>
      {error ? <p className="text-sm text-out">{error}</p> : null}
      <div className="flex gap-2">
        <Button type="submit" className="flex-1">
          ذخیره
        </Button>
        <Button tone="ghost" onClick={onClose}>
          انصراف
        </Button>
      </div>
    </form>
  )
}
