import { JALALI_MONTHS, daysInMonth, formatIsoDate, parseJalaliDate, todayParts } from '../lib/jalali.ts'
import { toFaDigits } from '../lib/money.ts'
import { fieldClass } from './ui.tsx'

export function JalaliDateField({ value, onChange }: { value: string; onChange: (next: string) => void }) {
  const today = todayParts()
  const parsed = parseJalaliDate(value) ?? today
  const start = Math.min(today.year - 20, parsed.year)
  const end = Math.max(today.year + 1, parsed.year)
  const years = []
  for (let year = start; year <= end; year += 1) years.push(year)
  const maxDay = daysInMonth(parsed.year, parsed.month)

  function update(part: Partial<{ year: number; month: number; day: number }>) {
    const next = { ...parsed, ...part }
    const limit = daysInMonth(next.year, next.month)
    onChange(formatIsoDate(next.year, next.month, Math.min(next.day, limit)))
  }

  return (
    <div className="grid grid-cols-3 gap-2">
      <select aria-label="روز" className={fieldClass} value={parsed.day} onChange={(event) => update({ day: Number(event.target.value) })}>
        {Array.from({ length: maxDay }, (_, index) => index + 1).map((day) => (
          <option key={day} value={day}>
            {toFaDigits(day)}
          </option>
        ))}
      </select>
      <select aria-label="ماه" className={fieldClass} value={parsed.month} onChange={(event) => update({ month: Number(event.target.value) })}>
        {JALALI_MONTHS.map((name, index) => (
          <option key={name} value={index + 1}>
            {name}
          </option>
        ))}
      </select>
      <select aria-label="سال" className={fieldClass} value={parsed.year} onChange={(event) => update({ year: Number(event.target.value) })}>
        {years.map((year) => (
          <option key={year} value={year}>
            {toFaDigits(year)}
          </option>
        ))}
      </select>
    </div>
  )
}
