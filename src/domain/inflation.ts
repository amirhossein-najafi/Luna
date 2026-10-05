export function monthsBetween(earlier: string, later: string) {
  const [earlyYear, earlyMonth] = earlier.split('-').map(Number)
  const [lateYear, lateMonth] = later.split('-').map(Number)
  return lateYear * 12 + (lateMonth - 1) - (earlyYear * 12 + (earlyMonth - 1))
}

export function realValue(amount: number, monthsAgo: number, annualPercent: number) {
  if (amount <= 0 || monthsAgo <= 0 || annualPercent <= 0) return Math.round(amount)
  return Math.round(amount * (1 + annualPercent / 100) ** (monthsAgo / 12))
}

export function inflationGap(currentExpense: number, previousExpense: number, annualPercent: number) {
  if (previousExpense <= 0) return null
  const baseline = realValue(previousExpense, 1, annualPercent)
  if (baseline <= 0) return null
  const percent = Math.round((Math.abs(currentExpense - baseline) / baseline) * 100)
  return { percent, higher: currentExpense > baseline, baseline }
}
