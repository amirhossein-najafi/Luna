import { shiftDate } from '../lib/jalali.ts'
import type { RecurringRule, Transaction } from '../types.ts'

export function rollRecurring(rules: RecurringRule[], transactions: Transaction[], today: string) {
  const nextTransactions = [...transactions]
  let changed = false
  const nextRules = rules.map((rule) => {
    let cursor = rule.nextDate
    let guard = 0
    while (cursor <= today && guard < 36) {
      if (rule.endDate && cursor > rule.endDate) break
      const id = `recur-${rule.id}-${cursor}`
      if (!nextTransactions.some((tx) => tx.id === id)) {
        const stamp = new Date().toISOString()
        nextTransactions.unshift({
          id,
          type: rule.type,
          amount: rule.amount,
          categoryId: rule.categoryId,
          accountId: rule.accountId,
          date: cursor,
          note: rule.title,
          createdAt: stamp,
          updatedAt: stamp,
          recurringId: rule.id,
        })
        changed = true
      }
      const advanced = shiftDate(cursor, rule.frequency)
      if (advanced <= cursor) break
      cursor = advanced
      guard += 1
    }
    if (cursor === rule.nextDate) return rule
    changed = true
    return { ...rule, nextDate: cursor }
  })
  return { rules: nextRules, transactions: nextTransactions, changed }
}

export function upcomingRules(rules: RecurringRule[], today: string) {
  return [...rules].filter((rule) => rule.nextDate >= today).sort((a, b) => a.nextDate.localeCompare(b.nextDate))
}

export function remainingCommitments(rules: RecurringRule[], month: string, today: string) {
  return rules
    .filter((rule) => rule.type === 'expense' && rule.nextDate.startsWith(`${month}-`) && rule.nextDate >= today)
    .reduce((sum, rule) => sum + rule.amount, 0)
}
