import { daysInMonth } from '../lib/jalali.ts'

export type BudgetTone = 'ok' | 'near' | 'over'

export function budgetStatus(spent: number, limit: number): BudgetTone | null {
  if (limit <= 0) return null
  const ratio = spent / limit
  if (ratio > 1) return 'over'
  if (ratio >= 0.8) return 'near'
  return 'ok'
}

export function daysBeforeBudgetEnds(spent: number, limit: number, month: string, today: string) {
  if (limit <= 0 || spent <= 0 || !today.startsWith(`${month}-`)) return null
  const [yearText, monthText] = month.split('-')
  const days = daysInMonth(Number(yearText), Number(monthText))
  const day = Number(today.slice(8, 10))
  if (day <= 0 || day > days) return null
  const remaining = limit - spent
  if (remaining <= 0) return null
  const daysUntilEmpty = remaining / (spent / day)
  const daysLeft = days - day
  if (daysUntilEmpty >= daysLeft) return null
  return Math.max(1, Math.round(daysLeft - daysUntilEmpty))
}
