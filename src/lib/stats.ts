import { categoryById, categoriesFor } from '../data/categories.ts'
import type { CustomCategory, Transaction, TransactionType } from '../types.ts'
import { daysInMonth, formatIsoDate, todayJalali } from './jalali.ts'
import { latinDigits, toFaDigits } from './money.ts'

export function inMonth(transactions: Transaction[], month: string) {
  return transactions.filter((tx) => tx.date.startsWith(`${month}-`))
}

export function totalOf(transactions: Transaction[], type: TransactionType) {
  return transactions.filter((tx) => tx.type === type).reduce((sum, tx) => sum + tx.amount, 0)
}

export function expenseSlices(transactions: Transaction[], extra: CustomCategory[] = []) {
  return categoriesFor('expense', extra)
    .map((category) => ({
      id: category.id,
      name: category.name,
      tone: category.tone,
      value: transactions
        .filter((tx) => tx.type === 'expense' && tx.categoryId === category.id)
        .reduce((sum, tx) => sum + tx.amount, 0),
    }))
    .filter((slice) => slice.value > 0)
}

export function recentDaySeries(transactions: Transaction[], month: string) {
  const today = todayJalali()
  const [yearText, monthText] = month.split('-')
  const year = Number(yearText)
  const monthNumber = Number(monthText)
  const maxDay = daysInMonth(year, monthNumber)
  const end = today.startsWith(`${month}-`) ? Number(today.slice(8, 10)) : maxDay
  const start = Math.max(1, end - 6)
  const days = []

  for (let day = start; day <= end; day += 1) {
    const date = formatIsoDate(year, monthNumber, day)
    const rows = transactions.filter((tx) => tx.date === date)
    days.push({
      date,
      label: toFaDigits(day),
      income: totalOf(rows, 'income'),
      expense: totalOf(rows, 'expense'),
    })
  }

  return days
}

export function spentInCategory(transactions: Transaction[], month: string, categoryId: string) {
  return totalOf(
    transactions.filter((tx) => tx.categoryId === categoryId && tx.date.startsWith(`${month}-`)),
    'expense',
  )
}

export function matchesQuery(tx: Transaction, query: string, extra: CustomCategory[] = []) {
  const needle = latinDigits(query).trim().toLowerCase()
  if (!needle) return true
  const category = categoryById(tx.categoryId, extra)?.name ?? ''
  const haystack = latinDigits(`${tx.note} ${category} ${tx.amount}`).toLowerCase()
  return haystack.includes(needle)
}
