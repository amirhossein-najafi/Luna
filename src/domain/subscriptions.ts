import { daysBetween, shiftDate } from '../lib/jalali.ts'
import type { RecurringRule, Transaction } from '../types.ts'
import { normalizeMerchant } from './inbox.ts'

export type SubscriptionHint = {
  title: string
  amount: number
  accountId: string
  categoryId: string
  frequency: 'weekly' | 'monthly'
  nextDate: string
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 1) return sorted[mid]
  return Math.round((sorted[mid - 1] + sorted[mid]) / 2)
}

export function detectSubscriptions(transactions: Transaction[], rules: RecurringRule[]): SubscriptionHint[] {
  const groups = new Map<string, Transaction[]>()
  for (const tx of transactions) {
    if (tx.type !== 'expense' || tx.amount <= 0) continue
    const merchant = normalizeMerchant(tx.note)
    if (!merchant) continue
    const key = `${merchant}|${tx.accountId}`
    const rows = groups.get(key) ?? []
    rows.push(tx)
    groups.set(key, rows)
  }

  const hints: SubscriptionHint[] = []
  for (const rows of groups.values()) {
    const mid = median(rows.map((tx) => tx.amount))
    if (mid <= 0) continue
    const inliers = rows.filter((tx) => Math.abs(tx.amount - mid) / mid <= 0.15)
    if (inliers.length < 3) continue
    const ordered = [...inliers].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))
    const dates = [...new Set(ordered.map((tx) => tx.date))]
    if (dates.length < 3) continue
    const gaps = dates.slice(1).map((date, index) => daysBetween(dates[index], date))
    const monthly = gaps.every((gap) => gap >= 25 && gap <= 35)
    const weekly = gaps.every((gap) => gap >= 5 && gap <= 9)
    if (!monthly && !weekly) continue
    const last = ordered[ordered.length - 1]
    const frequency = monthly ? 'monthly' : 'weekly'
    const title = last.note.trim().slice(0, 60)
    const covered = rules.some(
      (rule) => rule.accountId === last.accountId && normalizeMerchant(rule.title) === normalizeMerchant(title),
    )
    if (covered || !last.categoryId) continue
    hints.push({
      title,
      amount: median(inliers.map((tx) => tx.amount)),
      accountId: last.accountId,
      categoryId: last.categoryId,
      frequency,
      nextDate: shiftDate(dates[dates.length - 1], frequency),
    })
  }
  return hints
}
