export const HOLDING_KINDS = ['gold18', 'usd', 'coin'] as const

export type HoldingKind = (typeof HOLDING_KINDS)[number]
export type TransactionType = 'income' | 'expense'

export type Transaction = {
  id: string
  type: TransactionType
  amount: number
  categoryId: string
  date: string
  note: string
}

export type Budget = {
  categoryId: string
  month: string
  limit: number
}

export type Holding = {
  kind: HoldingKind
  amount: number
}

export type Quote = {
  kind: HoldingKind
  price: number
  updatedAt: string
}

export type FinanceState = {
  transactions: Transaction[]
  budgets: Budget[]
  holdings: Holding[]
  quotes: Quote[]
  apiKey: string
}

export const HOLDING_META: Record<HoldingKind, { name: string; unit: string; priceLabel: string }> = {
  gold18: { name: 'طلای ۱۸ عیار', unit: 'گرم', priceLabel: 'قیمت هر گرم' },
  usd: { name: 'دلار', unit: 'دلار', priceLabel: 'قیمت هر دلار' },
  coin: { name: 'سکه امامی', unit: 'عدد', priceLabel: 'قیمت هر سکه' },
}
