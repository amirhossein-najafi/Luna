import { shiftDate } from '../lib/jalali.ts'
import type { FlowType, RecurringOverride, RecurringRule, Transaction } from '../types.ts'

const STEP_LIMIT = 160

export type PlannedOccurrence = {
  ruleId: string
  occurrenceDate: string
  date: string
  amount: number
  type: FlowType
  categoryId: string
  accountId: string
  title: string
}

export type OccurrencePatch = {
  amount?: number
  categoryId?: string
  accountId?: string
}

export function occurrenceTransactionId(ruleId: string, occurrenceDate: string) {
  return `recur-${ruleId}-${occurrenceDate}`
}

function findOverride(rule: RecurringRule, occurrenceDate: string) {
  return rule.overrides?.find((item) => item.occurrenceDate === occurrenceDate)
}

function effectiveDate(override: RecurringOverride | undefined, occurrenceDate: string) {
  if (override?.action === 'postpone' && override.date) return override.date
  return occurrenceDate
}

export function isOccurrencePosted(rule: RecurringRule, occurrenceDate: string, transactions: Transaction[]) {
  const id = occurrenceTransactionId(rule.id, occurrenceDate)
  if (transactions.some((tx) => tx.id === id)) return true
  if (transactions.some((tx) => tx.recurringId === rule.id && tx.date === occurrenceDate)) return true
  return findOverride(rule, occurrenceDate)?.action === 'posted'
}

function isResolved(rule: RecurringRule, occurrenceDate: string, transactions: Transaction[]) {
  const action = findOverride(rule, occurrenceDate)?.action
  return action === 'skip' || action === 'posted' || isOccurrencePosted(rule, occurrenceDate, transactions)
}

function toOccurrence(rule: RecurringRule, occurrenceDate: string, override: RecurringOverride | undefined, date: string): PlannedOccurrence {
  return {
    ruleId: rule.id,
    occurrenceDate,
    date,
    amount: override?.amount && override.amount > 0 ? Math.round(override.amount) : rule.amount,
    type: rule.type,
    categoryId: override?.categoryId || rule.categoryId,
    accountId: override?.accountId || rule.accountId,
    title: rule.title,
  }
}

export function expandRecurring(rule: RecurringRule, from: string, to: string, transactions: Transaction[]) {
  if (from > to) return []
  const items: PlannedOccurrence[] = []
  let cursor = rule.nextDate
  for (let guard = 0; guard < STEP_LIMIT; guard += 1) {
    if (rule.endDate && cursor > rule.endDate) break
    const override = findOverride(rule, cursor)
    const date = effectiveDate(override, cursor)
    if (!isResolved(rule, cursor, transactions) && date >= from && date <= to) {
      items.push(toOccurrence(rule, cursor, override, date))
    }
    if (cursor > to && date > to) break
    const advanced = shiftDate(cursor, rule.frequency)
    if (advanced <= cursor) break
    cursor = advanced
  }
  return items
}

export function expandRules(rules: RecurringRule[], from: string, to: string, transactions: Transaction[]) {
  return rules
    .flatMap((rule) => expandRecurring(rule, from, to, transactions))
    .sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title, 'fa'))
}

export function isCadenceDate(rule: RecurringRule, occurrenceDate: string) {
  let cursor = rule.nextDate
  for (let guard = 0; guard < STEP_LIMIT; guard += 1) {
    if (rule.endDate && cursor > rule.endDate) return false
    if (cursor === occurrenceDate) return true
    if (cursor > occurrenceDate) return false
    const advanced = shiftDate(cursor, rule.frequency)
    if (advanced <= cursor) return false
    cursor = advanced
  }
  return false
}

function withOverride(rule: RecurringRule, next: RecurringOverride): RecurringRule {
  const overrides = (rule.overrides ?? []).filter((item) => item.occurrenceDate !== next.occurrenceDate)
  return { ...rule, overrides: [...overrides, next] }
}

function replaceRule(rules: RecurringRule[], rule: RecurringRule) {
  return rules.map((item) => (item.id === rule.id ? rule : item))
}

export function skipOccurrence(rules: RecurringRule[], ruleId: string, occurrenceDate: string) {
  const rule = rules.find((item) => item.id === ruleId)
  if (!rule || !isCadenceDate(rule, occurrenceDate)) return { rules, changed: false }
  if (findOverride(rule, occurrenceDate)?.action === 'posted') return { rules, changed: false }
  return {
    rules: replaceRule(rules, withOverride(rule, { occurrenceDate, action: 'skip' })),
    changed: true,
  }
}

export function postponeOccurrence(rules: RecurringRule[], ruleId: string, occurrenceDate: string, date: string) {
  const rule = rules.find((item) => item.id === ruleId)
  if (!rule || !isCadenceDate(rule, occurrenceDate) || !date) return { rules, changed: false }
  const current = findOverride(rule, occurrenceDate)
  if (current?.action === 'posted' || current?.action === 'skip') return { rules, changed: false }
  return {
    rules: replaceRule(
      rules,
      withOverride(rule, {
        occurrenceDate,
        action: 'postpone',
        date,
        amount: current?.amount,
        categoryId: current?.categoryId,
        accountId: current?.accountId,
      }),
    ),
    changed: true,
  }
}

export function editOccurrence(rules: RecurringRule[], ruleId: string, occurrenceDate: string, patch: OccurrencePatch) {
  const rule = rules.find((item) => item.id === ruleId)
  if (!rule || !isCadenceDate(rule, occurrenceDate)) return { rules, changed: false }
  const current = findOverride(rule, occurrenceDate)
  if (current?.action === 'posted' || current?.action === 'skip') return { rules, changed: false }
  return {
    rules: replaceRule(
      rules,
      withOverride(rule, {
        occurrenceDate,
        action: current?.action === 'postpone' ? 'postpone' : 'edit',
        date: current?.date,
        amount: patch.amount ?? current?.amount,
        categoryId: patch.categoryId ?? current?.categoryId,
        accountId: patch.accountId ?? current?.accountId,
      }),
    ),
    changed: true,
  }
}

export function payOccurrence(
  rules: RecurringRule[],
  transactions: Transaction[],
  ruleId: string,
  occurrenceDate: string,
  now = new Date().toISOString(),
) {
  const rule = rules.find((item) => item.id === ruleId)
  if (!rule || !isCadenceDate(rule, occurrenceDate)) return { rules, transactions, changed: false }
  if (isResolved(rule, occurrenceDate, transactions)) return { rules, transactions, changed: false }
  const override = findOverride(rule, occurrenceDate)
  const occurrence = toOccurrence(rule, occurrenceDate, override, effectiveDate(override, occurrenceDate))
  const tx: Transaction = {
    id: occurrenceTransactionId(rule.id, occurrenceDate),
    type: occurrence.type,
    amount: occurrence.amount,
    categoryId: occurrence.categoryId,
    accountId: occurrence.accountId,
    date: occurrence.date,
    note: rule.title,
    createdAt: now,
    updatedAt: now,
    recurringId: rule.id,
  }
  return {
    rules: replaceRule(
      rules,
      withOverride(rule, {
        occurrenceDate,
        action: 'posted',
        amount: occurrence.amount,
        categoryId: occurrence.categoryId,
        accountId: occurrence.accountId,
        date: occurrence.date === occurrenceDate ? undefined : occurrence.date,
        transactionId: tx.id,
      }),
    ),
    transactions: [tx, ...transactions.filter((item) => item.id !== tx.id)],
    changed: true,
  }
}
