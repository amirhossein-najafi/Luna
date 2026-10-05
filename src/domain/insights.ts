import { categoriesFor } from '../data/categories.ts'
import { daysInMonth, formatMonthLabel, shiftMonth } from '../lib/jalali.ts'
import { formatNumber } from '../lib/money.ts'
import { inMonth, spentInCategory, totalOf } from '../lib/stats.ts'
import type { CustomCategory, Transaction } from '../types.ts'

export function savingsRate(income: number, expense: number) {
  if (income <= 0) return null
  return (income - expense) / income
}

export function monthPoints(transactions: Transaction[], endMonth: string, count: number) {
  const points = []
  for (let index = count - 1; index >= 0; index -= 1) {
    const month = shiftMonth(endMonth, -index)
    const rows = inMonth(transactions, month)
    points.push({
      month,
      label: formatMonthLabel(month),
      income: totalOf(rows, 'income'),
      expense: totalOf(rows, 'expense'),
    })
  }
  return points
}

export function categoryTrend(transactions: Transaction[], endMonth: string, categoryId: string, count: number) {
  return monthPoints(transactions, endMonth, count).map((point) => ({
    ...point,
    spent: spentInCategory(transactions, point.month, categoryId),
  }))
}

export function forecastSpend(transactions: Transaction[], month: string, today: string) {
  if (!today.startsWith(`${month}-`)) return null
  const expense = totalOf(inMonth(transactions, month), 'expense')
  const day = Number(today.slice(8, 10))
  if (expense <= 0 || day <= 0) return null
  const [yearText, monthText] = month.split('-')
  const days = daysInMonth(Number(yearText), Number(monthText))
  return Math.round((expense / day) * days)
}

export function monthInsights(transactions: Transaction[], month: string, today: string, extra: CustomCategory[] = []) {
  const lines: string[] = []
  const previous = shiftMonth(month, -1)
  const expense = totalOf(inMonth(transactions, month), 'expense')
  const previousExpense = totalOf(inMonth(transactions, previous), 'expense')

  if (previousExpense > 0 && expense !== previousExpense) {
    const percent = Math.round((Math.abs(expense - previousExpense) / previousExpense) * 100)
    const name = formatMonthLabel(previous)
    lines.push(
      expense < previousExpense
        ? `این ماه ${formatNumber(percent)}٪ کمتر از ${name} خرج کردی.`
        : `این ماه ${formatNumber(percent)}٪ بیشتر از ${name} خرج کردی.`,
    )
  }

  let fastest: { name: string; percent: number } | null = null
  for (const category of categoriesFor('expense', extra)) {
    const current = spentInCategory(transactions, month, category.id)
    const before = spentInCategory(transactions, previous, category.id)
    if (before <= 0 || current <= before) continue
    const percent = Math.round(((current - before) / before) * 100)
    if (!fastest || percent > fastest.percent) fastest = { name: category.name, percent }
  }
  if (fastest) lines.push(`هزینه ${fastest.name} ${formatNumber(fastest.percent)}٪ بیشتر شده.`)

  const forecast = forecastSpend(transactions, month, today)
  if (forecast != null) {
    lines.push(`با روند فعلی تا پایان ماه حدود ${formatNumber(forecast)} تومان خرج خواهی کرد.`)
  }

  return lines.slice(0, 3)
}
