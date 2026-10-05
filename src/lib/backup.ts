import { categories, categoryById } from '../data/categories.ts'
import { parseJalaliDate, todayJalali } from './jalali.ts'
import {
  ACCOUNT_KINDS,
  DEFAULT_ACCOUNT_ID,
  HOLDING_KINDS,
  defaultAccount,
  type Account,
  type AccountKind,
  type AssetLot,
  type Budget,
  type FinanceState,
  type FlowType,
  type Goal,
  type HoldingKind,
  type MonthBudget,
  type Quote,
  type QuoteSource,
  type RecurringFrequency,
  type RecurringOverride,
  type RecurringOverrideAction,
  type RecurringRule,
  type Transaction,
  type CustomCategory,
} from '../types.ts'

const STORAGE_KEY = 'luna-v1'

export function emptyState(): FinanceState {
  return {
    transactions: [],
    budgets: [],
    monthBudgets: [],
    lots: [],
    quotes: [],
    apiKey: '',
    accounts: [defaultAccount()],
    recurring: [],
    goals: [],
  categories: [],
  inflationRate: 35,
  safetyBuffer: 0,
}
}

function isKind(value: unknown): value is HoldingKind {
  return HOLDING_KINDS.includes(value as HoldingKind)
}

function isAccountKind(value: unknown): value is AccountKind {
  return ACCOUNT_KINDS.includes(value as AccountKind)
}

function isFlow(value: unknown): value is FlowType {
  return value === 'income' || value === 'expense'
}

function isSource(value: unknown): value is QuoteSource {
  return value === 'tgju' || value === 'brsapi' || value === 'manual'
}

function isFrequency(value: unknown): value is RecurringFrequency {
  return value === 'monthly' || value === 'weekly'
}

function cleanAccounts(value: unknown): Account[] {
  const accounts: Account[] = []
  if (Array.isArray(value)) {
    for (const item of value) {
      if (!item || typeof item !== 'object') continue
      const account = item as Partial<Account>
      if (typeof account.id !== 'string' || !account.id) continue
      if (typeof account.name !== 'string' || !account.name.trim()) continue
      if (!isAccountKind(account.kind)) continue
      if (typeof account.openingBalance !== 'number' || !Number.isFinite(account.openingBalance)) continue
      accounts.push({
        id: account.id,
        name: account.name.trim().slice(0, 40),
        kind: account.kind,
        openingBalance: Math.round(account.openingBalance),
        archived: account.archived === true,
      })
    }
  }
  if (accounts.length === 0) return [defaultAccount()]
  if (!accounts.some((account) => account.id === DEFAULT_ACCOUNT_ID) && accounts.every((account) => account.archived)) {
    return [defaultAccount(), ...accounts]
  }
  return accounts
}

function cleanCategories(value: unknown): CustomCategory[] {
  if (!Array.isArray(value)) return []
  const items: CustomCategory[] = []
  for (const item of value) {
    if (!item || typeof item !== 'object') continue
    const category = item as Partial<CustomCategory>
    if (typeof category.id !== 'string' || !category.id) continue
    if (categories.some((builtIn) => builtIn.id === category.id)) continue
    if (typeof category.name !== 'string' || !category.name.trim()) continue
    if (!isFlow(category.type)) continue
    const name = category.name.trim().slice(0, 24)
    if (items.some((current) => current.type === category.type && current.name === name)) continue
    if (categories.some((builtIn) => builtIn.type === category.type && builtIn.name === name)) continue
    items.push({
      id: category.id,
      name,
      type: category.type,
      tone: typeof category.tone === 'string' && /^#[0-9a-fA-F]{6}$/.test(category.tone) ? category.tone : '#8d938c',
    })
  }
  return items
}

function cleanTransaction(value: unknown, accountIds: Set<string>, fallbackId: string, extra: CustomCategory[]): Transaction | null {
  if (!value || typeof value !== 'object') return null
  const tx = value as Partial<Transaction> & { updatedAt?: string }
  if (typeof tx.id !== 'string' || !tx.id) return null
  if (tx.type !== 'income' && tx.type !== 'expense' && tx.type !== 'transfer') return null
  if (typeof tx.amount !== 'number' || !Number.isFinite(tx.amount)) return null
  if (typeof tx.date !== 'string' || !parseJalaliDate(tx.date)) return null
  if (typeof tx.note !== 'string') return null
  const amount = Math.round(tx.amount)
  if (amount <= 0) return null
  const accountId = typeof tx.accountId === 'string' && accountIds.has(tx.accountId) ? tx.accountId : fallbackId
  const stamp = new Date().toISOString()
  const createdAt = typeof tx.createdAt === 'string' && tx.createdAt ? tx.createdAt : stamp
  const updatedAt = typeof tx.updatedAt === 'string' && tx.updatedAt ? tx.updatedAt : createdAt
  const note = tx.note.trim().slice(0, 140)

  if (tx.type === 'transfer') {
    const toAccountId = typeof tx.toAccountId === 'string' ? tx.toAccountId : ''
    if (!accountIds.has(toAccountId) || toAccountId === accountId) return null
    return {
      id: tx.id,
      type: 'transfer',
      amount,
      categoryId: '',
      accountId,
      toAccountId,
      date: tx.date,
      note,
      createdAt,
      updatedAt,
    }
  }

  if (typeof tx.categoryId !== 'string') return null
  const category = categoryById(tx.categoryId, extra)
  if (!category || category.type !== tx.type) return null
  return {
    id: tx.id,
    type: tx.type,
    amount,
    categoryId: tx.categoryId,
    accountId,
    date: tx.date,
    note,
    createdAt,
    updatedAt,
    recurringId: typeof tx.recurringId === 'string' ? tx.recurringId : undefined,
  }
}

function cleanBudget(value: unknown, extra: CustomCategory[]): Budget | null {
  if (!value || typeof value !== 'object') return null
  const budget = value as Partial<Budget>
  if (typeof budget.categoryId !== 'string' || !budget.categoryId) return null
  if (categoryById(budget.categoryId, extra)?.type !== 'expense') return null
  if (typeof budget.month !== 'string' || !/^\d{4}-\d{2}$/.test(budget.month)) return null
  if (typeof budget.limit !== 'number' || !Number.isFinite(budget.limit)) return null
  const limit = Math.round(budget.limit)
  if (limit <= 0) return null
  return { categoryId: budget.categoryId, month: budget.month, limit }
}

function cleanMonthBudgets(value: unknown): MonthBudget[] {
  if (!Array.isArray(value)) return []
  const budgets: MonthBudget[] = []
  for (const item of value) {
    if (!item || typeof item !== 'object') continue
    const budget = item as Partial<MonthBudget>
    if (typeof budget.month !== 'string' || !/^\d{4}-\d{2}$/.test(budget.month)) continue
    if (typeof budget.limit !== 'number' || !Number.isFinite(budget.limit)) continue
    const limit = Math.round(budget.limit)
    if (limit <= 0) continue
    budgets.push({ month: budget.month, limit })
  }
  return budgets
}

function cleanLots(value: unknown, holdings: unknown): AssetLot[] {
  if (Array.isArray(value)) {
    const lots: AssetLot[] = []
    for (const item of value) {
      if (!item || typeof item !== 'object') continue
      const lot = item as Partial<AssetLot>
      if (typeof lot.id !== 'string' || !lot.id) continue
      if (!isKind(lot.kind)) continue
      if (typeof lot.quantity !== 'number' || !Number.isFinite(lot.quantity) || lot.quantity <= 0) continue
      if (typeof lot.unitCost !== 'number' || !Number.isFinite(lot.unitCost) || lot.unitCost < 0) continue
      if (typeof lot.date !== 'string' || !parseJalaliDate(lot.date)) continue
      lots.push({
        id: lot.id,
        kind: lot.kind,
        quantity: Math.round(lot.quantity * 100) / 100,
        unitCost: Math.round(lot.unitCost),
        date: lot.date,
        note: typeof lot.note === 'string' ? lot.note.trim().slice(0, 80) : '',
      })
    }
    return lots
  }

  if (!Array.isArray(holdings)) return []
  const lots: AssetLot[] = []
  for (const item of holdings) {
    if (!item || typeof item !== 'object') continue
    const holding = item as { kind?: unknown; amount?: unknown }
    if (!isKind(holding.kind)) continue
    if (typeof holding.amount !== 'number' || !Number.isFinite(holding.amount) || holding.amount <= 0) continue
    lots.push({
      id: `opening-${holding.kind}`,
      kind: holding.kind,
      quantity: Math.round(holding.amount * 100) / 100,
      unitCost: 0,
      date: todayJalali(),
      note: 'مانده قبلی',
    })
  }
  return lots
}

function cleanQuotes(value: unknown): Quote[] {
  const quotes = new Map<HoldingKind, Quote>()
  if (!Array.isArray(value)) return []
  for (const item of value) {
    if (!item || typeof item !== 'object') continue
    const quote = item as Partial<Quote> & { updatedAt?: unknown }
    if (!isKind(quote.kind)) continue
    if (typeof quote.price !== 'number' || !Number.isFinite(quote.price)) continue
    const price = Math.round(quote.price)
    if (price <= 0) continue
    const fetchedAt =
      typeof quote.fetchedAt === 'string'
        ? quote.fetchedAt
        : typeof quote.updatedAt === 'string'
          ? quote.updatedAt
          : new Date().toISOString()
    quotes.set(quote.kind, {
      kind: quote.kind,
      price,
      source: isSource(quote.source) ? quote.source : 'manual',
      fetchedAt,
      marketAt: typeof quote.marketAt === 'string' ? quote.marketAt : undefined,
    })
  }
  return [...quotes.values()]
}

function isOverrideAction(value: unknown): value is RecurringOverrideAction {
  return value === 'skip' || value === 'postpone' || value === 'edit' || value === 'posted'
}

function cleanOverrides(value: unknown, type: FlowType, accountIds: Set<string>, extra: CustomCategory[]): RecurringOverride[] {
  if (!Array.isArray(value)) return []
  const overrides: RecurringOverride[] = []
  for (const item of value) {
    if (!item || typeof item !== 'object') continue
    const row = item as Partial<RecurringOverride>
    if (typeof row.occurrenceDate !== 'string' || !parseJalaliDate(row.occurrenceDate)) continue
    if (!isOverrideAction(row.action)) continue
    const next: RecurringOverride = { occurrenceDate: row.occurrenceDate, action: row.action }
    if (typeof row.amount === 'number' && Number.isFinite(row.amount) && row.amount > 0) next.amount = Math.round(row.amount)
    if (typeof row.categoryId === 'string' && categoryById(row.categoryId, extra)?.type === type) next.categoryId = row.categoryId
    if (typeof row.accountId === 'string' && accountIds.has(row.accountId)) next.accountId = row.accountId
    if (typeof row.date === 'string' && parseJalaliDate(row.date)) next.date = row.date
    if (typeof row.transactionId === 'string' && row.transactionId) next.transactionId = row.transactionId.slice(0, 80)
    overrides.push(next)
  }
  return overrides.slice(0, 240)
}

function cleanRecurring(value: unknown, accountIds: Set<string>, extra: CustomCategory[]): RecurringRule[] {
  if (!Array.isArray(value)) return []
  const rules: RecurringRule[] = []
  for (const item of value) {
    if (!item || typeof item !== 'object') continue
    const rule = item as Partial<RecurringRule>
    if (typeof rule.id !== 'string' || !rule.id) continue
    if (typeof rule.title !== 'string' || !rule.title.trim()) continue
    if (!isFlow(rule.type)) continue
    if (typeof rule.amount !== 'number' || !Number.isFinite(rule.amount) || rule.amount <= 0) continue
    if (typeof rule.categoryId !== 'string') continue
    const category = categoryById(rule.categoryId, extra)
    if (!category || category.type !== rule.type) continue
    if (typeof rule.accountId !== 'string' || !accountIds.has(rule.accountId)) continue
    if (!isFrequency(rule.frequency)) continue
    if (typeof rule.nextDate !== 'string' || !parseJalaliDate(rule.nextDate)) continue
    if (rule.endDate != null && (typeof rule.endDate !== 'string' || !parseJalaliDate(rule.endDate))) continue
    rules.push({
      id: rule.id,
      title: rule.title.trim().slice(0, 60),
      amount: Math.round(rule.amount),
      type: rule.type,
      categoryId: rule.categoryId,
      accountId: rule.accountId,
      frequency: rule.frequency,
      nextDate: rule.nextDate,
      endDate: rule.endDate,
      overrides: cleanOverrides(rule.overrides, rule.type, accountIds, extra),
    })
  }
  return rules
}

function cleanGoals(value: unknown, accountIds: Set<string>): Goal[] {
  if (!Array.isArray(value)) return []
  const goals: Goal[] = []
  for (const item of value) {
    if (!item || typeof item !== 'object') continue
    const goal = item as Partial<Goal>
    if (typeof goal.id !== 'string' || !goal.id) continue
    if (typeof goal.title !== 'string' || !goal.title.trim()) continue
    if (typeof goal.target !== 'number' || !Number.isFinite(goal.target) || goal.target <= 0) continue
    if (typeof goal.saved !== 'number' || !Number.isFinite(goal.saved) || goal.saved < 0) continue
    const accountId = typeof goal.accountId === 'string' && accountIds.has(goal.accountId) ? goal.accountId : undefined
    goals.push({
      id: goal.id,
      title: goal.title.trim().slice(0, 60),
      target: Math.round(goal.target),
      saved: Math.round(goal.saved),
      accountId,
    })
  }
  return goals
}

export function normalizeState(value: unknown): FinanceState {
  const source = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  const accounts = cleanAccounts(source.accounts)
  const accountIds = new Set(accounts.map((account) => account.id))
  const fallbackId = accountIds.has(DEFAULT_ACCOUNT_ID) ? DEFAULT_ACCOUNT_ID : accounts[0].id
  const customCategories = cleanCategories(source.categories)
  const transactions = Array.isArray(source.transactions)
    ? source.transactions.flatMap((item) => {
        const tx = cleanTransaction(item, accountIds, fallbackId, customCategories)
        return tx ? [tx] : []
      })
    : []
  const budgets = Array.isArray(source.budgets)
    ? source.budgets.flatMap((item) => {
        const budget = cleanBudget(item, customCategories)
        return budget ? [budget] : []
      })
    : []
  const inflationRate =
    typeof source.inflationRate === 'number' && Number.isFinite(source.inflationRate)
      ? Math.min(200, Math.max(0, Math.round(source.inflationRate)))
      : 35
  return {
    transactions,
    budgets,
    monthBudgets: cleanMonthBudgets(source.monthBudgets),
    lots: cleanLots(source.lots, source.holdings),
    quotes: cleanQuotes(source.quotes),
    apiKey: typeof source.apiKey === 'string' ? source.apiKey : '',
    accounts,
    recurring: cleanRecurring(source.recurring, accountIds, customCategories),
    goals: cleanGoals(source.goals, accountIds),
    categories: customCategories,
    inflationRate,
    safetyBuffer:
      typeof source.safetyBuffer === 'number' && Number.isFinite(source.safetyBuffer) ? Math.max(0, Math.round(source.safetyBuffer)) : 0,
  }
}

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyState()
    return normalizeState(JSON.parse(raw))
  } catch {
    return emptyState()
  }
}

export function saveState(state: FinanceState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    /* Private mode can reject storage writes. */
  }
}

export function serializeBackup(state: FinanceState) {
  const data: Omit<FinanceState, 'apiKey'> & { apiKey?: string } = { ...state }
  delete data.apiKey
  return JSON.stringify({ app: 'luna', version: 2, ...data }, null, 2)
}

export function parseBackup(text: string) {
  const raw = JSON.parse(text) as unknown
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('shape')
  }
  const source = raw as Record<string, unknown>
  const known = ['transactions', 'budgets', 'holdings', 'lots', 'quotes', 'accounts']
  if (source.app !== 'luna' && !known.some((key) => key in source)) {
    throw new Error('shape')
  }
  return normalizeState(source)
}
