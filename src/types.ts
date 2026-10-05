export const HOLDING_KINDS = ['gold18', 'usd', 'coin'] as const
export const ACCOUNT_KINDS = ['cash', 'card', 'bank', 'savings', 'wallet', 'investment', 'debt'] as const

export type HoldingKind = (typeof HOLDING_KINDS)[number]
export type AccountKind = (typeof ACCOUNT_KINDS)[number]
export type FlowType = 'income' | 'expense'
export type TransactionType = FlowType | 'transfer'
export type QuoteSource = 'tgju' | 'brsapi' | 'manual'
export type RecurringFrequency = 'monthly' | 'weekly'
export type RecurringOverrideAction = 'skip' | 'postpone' | 'edit' | 'posted'

export type RecurringOverride = {
  occurrenceDate: string
  action: RecurringOverrideAction
  amount?: number
  categoryId?: string
  accountId?: string
  date?: string
  transactionId?: string
}

export const DEFAULT_ACCOUNT_ID = 'cash-wallet'

export type Account = {
  id: string
  name: string
  kind: AccountKind
  openingBalance: number
  archived: boolean
}

export type Transaction = {
  id: string
  type: TransactionType
  amount: number
  categoryId: string
  accountId: string
  toAccountId?: string
  date: string
  note: string
  createdAt: string
  updatedAt: string
  recurringId?: string
}

export type Budget = {
  categoryId: string
  month: string
  limit: number
}

export type MonthBudget = {
  month: string
  limit: number
}

export type AssetLot = {
  id: string
  kind: HoldingKind
  quantity: number
  unitCost: number
  date: string
  note: string
}

export type Quote = {
  kind: HoldingKind
  price: number
  source: QuoteSource
  fetchedAt: string
  marketAt?: string
}

export type RecurringRule = {
  id: string
  title: string
  amount: number
  type: FlowType
  categoryId: string
  accountId: string
  frequency: RecurringFrequency
  nextDate: string
  endDate?: string
  overrides?: RecurringOverride[]
}

export type Goal = {
  id: string
  title: string
  target: number
  saved: number
  accountId?: string
}

export type CustomCategory = {
  id: string
  name: string
  type: FlowType
  tone: string
}

export type FinanceState = {
  transactions: Transaction[]
  budgets: Budget[]
  monthBudgets: MonthBudget[]
  lots: AssetLot[]
  quotes: Quote[]
  apiKey: string
  accounts: Account[]
  recurring: RecurringRule[]
  goals: Goal[]
  categories: CustomCategory[]
  inflationRate: number
  safetyBuffer: number
}

export const HOLDING_META: Record<HoldingKind, { name: string; unit: string; priceLabel: string }> = {
  gold18: { name: 'طلای ۱۸ عیار', unit: 'گرم', priceLabel: 'قیمت هر گرم' },
  usd: { name: 'دلار', unit: 'دلار', priceLabel: 'قیمت هر دلار' },
  coin: { name: 'سکه امامی', unit: 'عدد', priceLabel: 'قیمت هر سکه' },
}

export const ACCOUNT_META: Record<AccountKind, string> = {
  cash: 'نقد',
  card: 'کارت',
  bank: 'بانک',
  savings: 'پس‌انداز',
  wallet: 'کیف پول دیجیتال',
  investment: 'سرمایه‌گذاری',
  debt: 'بدهی',
}

export function defaultAccount(): Account {
  return { id: DEFAULT_ACCOUNT_ID, name: 'کیف پول', kind: 'cash', openingBalance: 0, archived: false }
}
