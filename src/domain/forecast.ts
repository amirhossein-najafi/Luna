import { formatDayLabel, shiftDays } from '../lib/jalali.ts'
import { accountBalance, cashPosition } from './ledger.ts'
import { expandRules, type PlannedOccurrence } from './recurring.ts'
import { isSpendable } from './spend.ts'
import type { Account, RecurringRule, Transaction } from '../types.ts'

export type TimelineEntry = PlannedOccurrence & {
  overdue: boolean
  balanceAfter: number
}

export type ForecastPoint = {
  date: string
  spendable: number
  liquid: number
}

export type CashProjection = {
  timeline: TimelineEntry[]
  points: ForecastPoint[]
  horizons: Array<{ days: 30 | 60 | 90; date: string; spendable: number; liquid: number }>
  firstNegative: { accountId: string; date: string; balance: number } | null
}

export type ForecastChartPoint = {
  date: string
  label: string
  actual: number | null
  forecast: number | null
}

function liquidOf(accounts: Account[], balances: Map<string, number>) {
  let cash = 0
  let debt = 0
  for (const account of accounts) {
    if (account.archived) continue
    const balance = balances.get(account.id) ?? 0
    if (account.kind === 'debt') debt += balance
    else cash += balance
  }
  return cash - debt
}

function spendableFrom(accounts: Account[], balances: Map<string, number>) {
  return accounts.filter(isSpendable).reduce((sum, account) => sum + (balances.get(account.id) ?? 0), 0)
}

function applyPosted(balances: Map<string, number>, accounts: Account[], tx: Transaction) {
  const active = new Set(accounts.map((account) => account.id))
  if ((tx.type === 'income' || tx.type === 'expense' || tx.type === 'transfer') && active.has(tx.accountId)) {
    const current = balances.get(tx.accountId) ?? 0
    balances.set(tx.accountId, tx.type === 'income' ? current + tx.amount : current - tx.amount)
  }
  if (tx.type === 'transfer' && tx.toAccountId && active.has(tx.toAccountId)) {
    balances.set(tx.toAccountId, (balances.get(tx.toAccountId) ?? 0) + tx.amount)
  }
}

function dueOn(occurrences: PlannedOccurrence[], today: string, opening: boolean, date: string) {
  return occurrences
    .filter((item) => (opening ? item.date <= today : item.date === date))
    .sort((a, b) => {
      const byDate = a.date.localeCompare(b.date)
      if (byDate !== 0) return byDate
      if (a.type !== b.type) return a.type === 'income' ? -1 : 1
      return a.title.localeCompare(b.title, 'fa')
    })
}

export function projectCashflow(input: {
  accounts: Account[]
  transactions: Transaction[]
  rules: RecurringRule[]
  today: string
  days: number
}): CashProjection {
  const days = Math.max(0, Math.round(input.days))
  const end = shiftDays(input.today, days)
  const occurrences = expandRules(input.rules, '1200-01-01', end, input.transactions)
  const active = input.accounts.filter((account) => !account.archived)
  const balances = new Map(active.map((account) => [account.id, accountBalance(account, input.transactions, input.today)]))
  const timeline: TimelineEntry[] = []
  const points: ForecastPoint[] = []
  let firstNegative: CashProjection['firstNegative'] = null

  for (let offset = 0; offset <= days; offset += 1) {
    const date = shiftDays(input.today, offset)
    if (offset > 0) {
      for (const tx of input.transactions) {
        if (tx.date === date) applyPosted(balances, active, tx)
      }
    }
    for (const item of dueOn(occurrences, input.today, offset === 0, date)) {
      const account = active.find((candidate) => candidate.id === item.accountId)
      if (!account) continue
      const current = balances.get(account.id) ?? 0
      const next = item.type === 'income' ? current + item.amount : current - item.amount
      balances.set(account.id, next)
      timeline.push({ ...item, overdue: item.date < input.today, balanceAfter: next })
      if (!firstNegative && isSpendable(account) && next < 0) {
        firstNegative = { accountId: account.id, date, balance: next }
      }
    }
    if (!firstNegative) {
      for (const account of active) {
        if (!isSpendable(account)) continue
        const balance = balances.get(account.id) ?? 0
        if (balance < 0) {
          firstNegative = { accountId: account.id, date, balance }
          break
        }
      }
    }
    points.push({
      date,
      spendable: spendableFrom(active, balances),
      liquid: liquidOf(active, balances),
    })
  }

  const horizons = ([30, 60, 90] as const).flatMap((span) => {
    const date = shiftDays(input.today, span)
    const point = points.find((item) => item.date === date)
    return point ? [{ days: span, date, spendable: point.spendable, liquid: point.liquid }] : []
  })

  return { timeline, points, horizons, firstNegative }
}

export function forecastSeries(input: {
  accounts: Account[]
  transactions: Transaction[]
  rules: RecurringRule[]
  today: string
  historyDays?: number
  forwardDays?: number
}): ForecastChartPoint[] {
  const historyDays = input.historyDays ?? 30
  const forwardDays = input.forwardDays ?? 30
  const projection = projectCashflow({ ...input, days: forwardDays })
  const rows: ForecastChartPoint[] = []
  for (let offset = historyDays; offset >= 1; offset -= 1) {
    const date = shiftDays(input.today, -offset)
    rows.push({
      date,
      label: formatDayLabel(date),
      actual: cashPosition(input.accounts, input.transactions, date).liquid,
      forecast: null,
    })
  }
  const opening = cashPosition(input.accounts, input.transactions, input.today).liquid
  rows.push({ date: input.today, label: formatDayLabel(input.today), actual: opening, forecast: opening })
  const todayPoint = projection.points[0]
  if (todayPoint && todayPoint.liquid !== opening) {
    rows.push({ date: input.today, label: 'امروز', actual: null, forecast: todayPoint.liquid })
  }
  for (const point of projection.points.slice(1)) {
    rows.push({ date: point.date, label: formatDayLabel(point.date), actual: null, forecast: point.liquid })
  }
  return rows
}

export function negativeWithin(projection: CashProjection, horizon: string) {
  return projection.firstNegative != null && projection.firstNegative.date <= horizon
}
