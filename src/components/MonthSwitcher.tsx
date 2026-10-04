import { currentMonth, formatMonthLabel } from '../lib/jalali.ts'
import { useFinance } from '../store/finance.tsx'

export function MonthSwitcher() {
  const { month, setMonth, shiftMonthBy } = useFinance()
  const viewingNow = month === currentMonth()

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1 rounded-2xl border border-line bg-panel p-1">
        <button
          type="button"
          onClick={() => shiftMonthBy(-1)}
          aria-label="ماه قبل"
          className="grid size-9 place-items-center rounded-xl text-lg hover:bg-raise"
        >
          <span dir="ltr">›</span>
        </button>
        <span className="min-w-28 px-2 text-center text-sm font-medium">{formatMonthLabel(month)}</span>
        <button
          type="button"
          onClick={() => shiftMonthBy(1)}
          aria-label="ماه بعد"
          className="grid size-9 place-items-center rounded-xl text-lg hover:bg-raise"
        >
          <span dir="ltr">‹</span>
        </button>
      </div>
      {viewingNow ? null : (
        <button
          type="button"
          onClick={() => setMonth(currentMonth())}
          className="rounded-2xl px-3 py-2 text-sm text-gold hover:bg-raise"
        >
          ماه جاری
        </button>
      )}
    </div>
  )
}
