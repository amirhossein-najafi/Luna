import { parseJalaliDate } from './jalali.ts'
import {
  HOLDING_KINDS,
  type Budget,
  type FinanceState,
  type Holding,
  type HoldingKind,
  type Quote,
  type Transaction,
} from '../types.ts'

const STORAGE_KEY = 'luna-v1'

export function emptyState(): FinanceState {
  return {
    transactions: [],
    budgets: [],
    holdings: HOLDING_KINDS.map((kind) => ({ kind, amount: 0 })),
    quotes: [],
    apiKey: '',
  }
}

function isKind(value: unknown): value is HoldingKind {
  return HOLDING_KINDS.includes(value as HoldingKind)
}

function cleanTransaction(value: unknown): Transaction | null {
  if (!value || typeof value !== 'object') return null
  const tx = value as Partial<Transaction>
  if (typeof tx.id !== 'string' || !tx.id) return null
  if (tx.type !== 'income' && tx.type !== 'expense') return null
  if (typeof tx.amount !== 'number' || !Number.isFinite(tx.amount)) return null
  if (typeof tx.categoryId !== 'string' || !tx.categoryId) return null
  if (typeof tx.date !== 'string' || !parseJalaliDate(tx.date)) return null
  if (typeof tx.note !== 'string') return null
  const amount = Math.round(tx.amount)
  if (amount <= 0) return null
  return {
    id: tx.id,
    type: tx.type,
    amount,
    categoryId: tx.categoryId,
    date: tx.date,
    note: tx.note.trim().slice(0, 140),
  }
}

function cleanBudget(value: unknown): Budget | null {
  if (!value || typeof value !== 'object') return null
  const budget = value as Partial<Budget>
  if (typeof budget.categoryId !== 'string' || !budget.categoryId) return null
  if (typeof budget.month !== 'string' || !/^\d{4}-\d{2}$/.test(budget.month)) return null
  if (typeof budget.limit !== 'number' || !Number.isFinite(budget.limit)) return null
  const limit = Math.round(budget.limit)
  if (limit <= 0) return null
  return { categoryId: budget.categoryId, month: budget.month, limit }
}

function cleanHoldings(value: unknown): Holding[] {
  const amounts = new Map<HoldingKind, number>()
  if (Array.isArray(value)) {
    for (const item of value) {
      if (!item || typeof item !== 'object') continue
      const holding = item as Partial<Holding>
      if (!isKind(holding.kind)) continue
      if (typeof holding.amount !== 'number' || !Number.isFinite(holding.amount) || holding.amount < 0) continue
      amounts.set(holding.kind, Math.round(holding.amount * 100) / 100)
    }
  }
  return HOLDING_KINDS.map((kind) => ({ kind, amount: amounts.get(kind) ?? 0 }))
}

function cleanQuotes(value: unknown): Quote[] {
  const quotes = new Map<HoldingKind, Quote>()
  if (!Array.isArray(value)) return []
  for (const item of value) {
    if (!item || typeof item !== 'object') continue
    const quote = item as Partial<Quote>
    if (!isKind(quote.kind)) continue
    if (typeof quote.price !== 'number' || !Number.isFinite(quote.price)) continue
    const price = Math.round(quote.price)
    if (price <= 0) continue
    quotes.set(quote.kind, {
      kind: quote.kind,
      price,
      updatedAt: typeof quote.updatedAt === 'string' ? quote.updatedAt : new Date().toISOString(),
    })
  }
  return [...quotes.values()]
}

export function normalizeState(value: unknown): FinanceState {
  const source = value && typeof value === 'object' ? (value as Partial<FinanceState>) : {}
  const transactions = Array.isArray(source.transactions)
    ? source.transactions.flatMap((item) => {
        const tx = cleanTransaction(item)
        return tx ? [tx] : []
      })
    : []
  const budgets = Array.isArray(source.budgets)
    ? source.budgets.flatMap((item) => {
        const budget = cleanBudget(item)
        return budget ? [budget] : []
      })
    : []
  return {
    transactions,
    budgets,
    holdings: cleanHoldings(source.holdings),
    quotes: cleanQuotes(source.quotes),
    apiKey: typeof source.apiKey === 'string' ? source.apiKey : '',
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
  return JSON.stringify({ app: 'luna', version: 1, ...state }, null, 2)
}

export function parseBackup(text: string) {
  const raw = JSON.parse(text) as unknown
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('shape')
  }
  const source = raw as Record<string, unknown>
  const known = ['transactions', 'budgets', 'holdings', 'quotes', 'apiKey']
  if (source.app !== 'luna' && !known.some((key) => key in source)) {
    throw new Error('shape')
  }
  return normalizeState(source)
}
