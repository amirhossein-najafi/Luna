import { accountBalance } from './ledger.ts'
import { shiftMonth } from '../lib/jalali.ts'
import { inMonth, totalOf } from '../lib/stats.ts'
import type { Account, Goal, Transaction } from '../types.ts'

export function goalSaved(goal: Goal, accounts: Account[], transactions: Transaction[]) {
  if (!goal.accountId) return goal.saved
  const account = accounts.find((item) => item.id === goal.accountId)
  if (!account) return goal.saved
  return Math.max(0, accountBalance(account, transactions))
}

export function monthsToGoal(remaining: number, transactions: Transaction[], month: string) {
  if (remaining <= 0) return 0
  let saved = 0
  let count = 0
  for (let index = 1; index <= 3; index += 1) {
    const rows = inMonth(transactions, shiftMonth(month, -index))
    const net = totalOf(rows, 'income') - totalOf(rows, 'expense')
    if (net > 0) {
      saved += net
      count += 1
    }
  }
  if (count === 0) return null
  return Math.ceil(remaining / (saved / count))
}
