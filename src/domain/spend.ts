import { daysBetween, endOfMonth, shiftDays } from '../lib/jalali.ts'
import { accountBalance } from './ledger.ts'
import { expandRules } from './recurring.ts'
import type { Account, AccountKind, Goal, RecurringRule, Transaction } from '../types.ts'

export const SPENDABLE_KINDS = ['cash', 'card', 'bank', 'wallet'] as const satisfies readonly AccountKind[]

export type SpendTone = 'safe' | 'tight' | 'danger'

export type SafeToSpend = {
  spendable: number
  commitments: number
  goalReserve: number
  safetyBuffer: number
  safeTotal: number
  daily: number
  days: number
  horizon: string
  paydayKnown: boolean
  tone: SpendTone
  paymentCount: number
}

export function isSpendable(account: Account) {
  return !account.archived && SPENDABLE_KINDS.includes(account.kind as (typeof SPENDABLE_KINDS)[number])
}

export function spendableCash(accounts: Account[], transactions: Transaction[], until?: string) {
  return accounts.filter(isSpendable).reduce((sum, account) => sum + accountBalance(account, transactions, until), 0)
}

export function spendTone(safeTotal: number, spendable: number, commitments: number, negativeInHorizon: boolean): SpendTone {
  if (negativeInHorizon || safeTotal <= 0) return 'danger'
  if (spendable > 0 && commitments > spendable * 0.6) return 'tight'
  return 'safe'
}

export function safeToSpend(input: {
  accounts: Account[]
  transactions: Transaction[]
  rules: RecurringRule[]
  goals: Goal[]
  safetyBuffer: number
  today: string
  negativeInHorizon?: boolean
}): SafeToSpend {
  const horizonEnd = shiftDays(input.today, 400)
  const upcoming = expandRules(input.rules, '1200-01-01', horizonEnd, input.transactions)
  const nextIncome = upcoming.find((item) => item.type === 'income' && item.date >= input.today)
  const paydayKnown = nextIncome != null
  const horizon = nextIncome?.date ?? endOfMonth(input.today)
  const commitmentItems = upcoming.filter((item) => {
    if (item.type !== 'expense') return false
    const account = input.accounts.find((candidate) => candidate.id === item.accountId)
    if (!account || !isSpendable(account)) return false
    if (item.date < input.today) return true
    return paydayKnown ? item.date < horizon : item.date <= horizon
  })
  const posted = postedBeforeHorizon(input.accounts, input.transactions, input.today, horizon, paydayKnown)
  const spendable = spendableCash(input.accounts, input.transactions, input.today) + posted.income
  const commitments = commitmentItems.reduce((sum, item) => sum + item.amount, 0) + posted.expense
  const goalReserve = input.goals.filter((goal) => !goal.accountId).reduce((sum, goal) => sum + Math.max(0, goal.saved), 0)
  const safetyBuffer = Math.max(0, Math.round(input.safetyBuffer))
  const safeTotal = spendable - commitments - goalReserve - safetyBuffer
  const span = daysBetween(input.today, horizon)
  const days = Math.max(1, paydayKnown ? span : span + 1)
  return {
    spendable,
    commitments,
    goalReserve,
    safetyBuffer,
    safeTotal,
    daily: safeTotal / days,
    days,
    horizon,
    paydayKnown,
    tone: spendTone(safeTotal, spendable, commitments, input.negativeInHorizon === true),
    paymentCount: commitmentItems.length + posted.count,
  }
}

function postedBeforeHorizon(accounts: Account[], transactions: Transaction[], today: string, horizon: string, paydayKnown: boolean) {
  let income = 0
  let expense = 0
  let count = 0
  for (const tx of transactions) {
    if (tx.date <= today) continue
    if (paydayKnown ? tx.date >= horizon : tx.date > horizon) continue
    if (tx.type === 'income' || tx.type === 'expense') {
      const account = accounts.find((candidate) => candidate.id === tx.accountId)
      if (!account || !isSpendable(account)) continue
      if (tx.type === 'income') income += tx.amount
      else {
        expense += tx.amount
        count += 1
      }
      continue
    }
    const from = accounts.find((candidate) => candidate.id === tx.accountId)
    const to = accounts.find((candidate) => candidate.id === tx.toAccountId)
    if (from && isSpendable(from)) expense += tx.amount
    if (to && isSpendable(to)) income += tx.amount
  }
  return { income, expense, count }
}
