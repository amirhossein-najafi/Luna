import { useState, type FormEvent } from 'react'
import { categoriesFor } from '../data/categories.ts'
import { JALALI_MONTHS, daysInMonth, formatIsoDate, parseJalaliDate, todayParts } from '../lib/jalali.ts'
import { formatNumber, parseAmount, toFaDigits } from '../lib/money.ts'
import type { Transaction, TransactionType } from '../types.ts'
import { Button, fieldClass } from './ui.tsx'

function JalaliDateField({ value, onChange }: { value: string; onChange: (next: string) => void }) {
  const today = todayParts()
  const parsed = parseJalaliDate(value) ?? today
  const years = []
  for (let year = today.year - 5; year <= today.year + 1; year += 1) years.push(year)
  const maxDay = daysInMonth(parsed.year, parsed.month)

  function update(part: Partial<{ year: number; month: number; day: number }>) {
    const next = { ...parsed, ...part }
    const limit = daysInMonth(next.year, next.month)
    onChange(formatIsoDate(next.year, next.month, Math.min(next.day, limit)))
  }

  return (
    <div className="grid grid-cols-3 gap-2">
      <select
        aria-label="روز"
        className={fieldClass}
        value={parsed.day}
        onChange={(event) => update({ day: Number(event.target.value) })}
      >
        {Array.from({ length: maxDay }, (_, index) => index + 1).map((day) => (
          <option key={day} value={day}>
            {toFaDigits(day)}
          </option>
        ))}
      </select>
      <select
        aria-label="ماه"
        className={fieldClass}
        value={parsed.month}
        onChange={(event) => update({ month: Number(event.target.value) })}
      >
        {JALALI_MONTHS.map((name, index) => (
          <option key={name} value={index + 1}>
            {name}
          </option>
        ))}
      </select>
      <select
        aria-label="سال"
        className={fieldClass}
        value={parsed.year}
        onChange={(event) => update({ year: Number(event.target.value) })}
      >
        {years.map((year) => (
          <option key={year} value={year}>
            {toFaDigits(year)}
          </option>
        ))}
      </select>
    </div>
  )
}

export function TransactionForm({
  initial,
  defaultDate,
  onSave,
  onClose,
}: {
  initial?: Transaction
  defaultDate: string
  onSave: (tx: Omit<Transaction, 'id'> & { id?: string }) => void
  onClose: () => void
}) {
  const [type, setType] = useState<TransactionType>(initial?.type ?? 'expense')
  const [amount, setAmount] = useState(initial ? String(initial.amount) : '')
  const [categoryId, setCategoryId] = useState(
    initial?.categoryId ?? categoriesFor(initial?.type ?? 'expense')[0].id,
  )
  const [date, setDate] = useState(initial?.date ?? defaultDate)
  const [note, setNote] = useState(initial?.note ?? '')
  const [error, setError] = useState('')
  const options = categoriesFor(type)
  const preview = parseAmount(amount)

  function changeType(next: TransactionType) {
    setType(next)
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
    onSave({
      id: initial?.id,
      type,
      amount: preview,
      categoryId,
      date,
      note: note.trim(),
    })
    onClose()
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={onSubmit}>
      <div className="grid grid-cols-2 gap-2 rounded-2xl bg-raise p-1">
        {(['expense', 'income'] as const).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => changeType(item)}
            className={`rounded-xl py-2 text-sm ${type === item ? 'bg-panel font-medium' : 'text-mute'}`}
            aria-pressed={type === item}
          >
            {item === 'expense' ? 'هزینه' : 'درآمد'}
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
        دسته
        <select className={fieldClass} value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
          {options.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </label>
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
          placeholder="مثلاً ناهار یا کرایه تاکسی"
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
