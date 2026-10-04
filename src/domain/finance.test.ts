import { describe, expect, it } from 'vitest'
import { daysBeforeBudgetEnds } from './budget.ts'
import { monthInsights, savingsRate } from './insights.ts'
import { accountBalance, cashPosition } from './ledger.ts'
import { mergeQuotes } from './quotes.ts'
import { rollRecurring } from './recurring.ts'
import { unrealizedGain } from './wealth.ts'
import { parseBackup, serializeBackup } from '../lib/backup.ts'
import { totalOf } from '../lib/stats.ts'
import { defaultAccount, type Account, type Quote, type Transaction } from '../types.ts'

function tx(partial: Partial<Transaction> & Pick<Transaction, 'id' | 'type' | 'amount' | 'date'>): Transaction {
  return {
    categoryId: partial.type === 'expense' ? 'food' : partial.type === 'income' ? 'salary' : '',
    accountId: 'cash-wallet',
    note: '',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...partial,
  }
}

describe('quotes and backup', () => {
  it('merges prices and keeps a kind that did not arrive', () => {
    const current: Quote[] = [{ kind: 'coin', price: 10, source: 'manual', fetchedAt: '2026-01-01T00:00:00.000Z' }]
    const incoming: Quote[] = [{ kind: 'usd', price: 20, source: 'tgju', fetchedAt: '2026-02-01T00:00:00.000Z' }]
    const merged = mergeQuotes(current, incoming)
    expect(merged.map((quote) => quote.kind).sort()).toEqual(['coin', 'usd'])
  })

  it('leaves the api key out of a backup and still reads version 1', () => {
    const raw = {
      app: 'luna',
      version: 1,
      apiKey: 'secret',
      transactions: [{ id: 'a', type: 'expense', amount: 250000, categoryId: 'food', date: '1405-07-01', note: 'ناهار' }],
      budgets: [],
      holdings: [{ kind: 'gold18', amount: 2 }],
      quotes: [{ kind: 'usd', price: 1000, updatedAt: '2026-01-01T00:00:00.000Z' }],
    }
    const state = parseBackup(JSON.stringify(raw))
    expect(state.transactions).toHaveLength(1)
    expect(state.transactions[0].accountId).toBe(defaultAccount().id)
    expect(state.transactions[0].createdAt).toBeTruthy()
    expect(state.lots).toEqual([expect.objectContaining({ kind: 'gold18', quantity: 2, unitCost: 0 })])
    expect(state.quotes[0]).toMatchObject({ kind: 'usd', source: 'manual', price: 1000 })
    const file = JSON.parse(serializeBackup({ ...state, apiKey: 'secret' })) as { apiKey?: string; version: number }
    expect(file.apiKey).toBeUndefined()
    expect(file.version).toBe(2)

    const broken = parseBackup(JSON.stringify({
      app: 'luna',
      transactions: [
        { id: 'bad', type: 'expense', amount: 10, categoryId: 'salary', date: '1405-07-01', note: '' },
        { id: 'ok', type: 'income', amount: 10, categoryId: 'salary', date: '1405-07-01', note: '' },
      ],
    }))
    expect(broken.transactions.map((item) => item.id)).toEqual(['ok'])
  })
})

describe('ledger', () => {
  const wallet = defaultAccount()
  const bank: Account = { id: 'bank', name: 'بانک', kind: 'bank', openingBalance: 1000, archived: false }

  it('ignores transfers in income and expense totals', () => {
    const rows = [
      tx({ id: '1', type: 'income', amount: 500, date: '1405-07-01', accountId: 'cash-wallet' }),
      tx({ id: '2', type: 'expense', amount: 100, date: '1405-07-02', accountId: 'cash-wallet' }),
      tx({ id: '3', type: 'transfer', amount: 50, date: '1405-07-03', accountId: 'bank', toAccountId: 'cash-wallet' }),
    ]
    expect(totalOf(rows, 'income')).toBe(500)
    expect(totalOf(rows, 'expense')).toBe(100)
    expect(accountBalance(wallet, rows)).toBe(450)
    expect(accountBalance(bank, rows)).toBe(950)
    expect(cashPosition([wallet, bank], rows).liquid).toBe(1400)
  })

  it('subtracts debt from liquid cash', () => {
    const debt: Account = { id: 'debt', name: 'قسط', kind: 'debt', openingBalance: 300, archived: false }
    expect(cashPosition([wallet, debt], []).liquid).toBe(-300)
  })
})

describe('insights, wealth, recurring, budget', () => {
  it('computes savings rate only when income exists', () => {
    expect(savingsRate(100, 40)).toBeCloseTo(0.6)
    expect(savingsRate(0, 10)).toBeNull()
  })

  it('counts unrealized gain only for lots with a buy price', () => {
    const gain = unrealizedGain(
      [
        { id: 'a', kind: 'gold18', quantity: 2, unitCost: 100, date: '1405-01-01', note: '' },
        { id: 'b', kind: 'usd', quantity: 3, unitCost: 0, date: '1405-01-01', note: '' },
      ],
      [{ kind: 'gold18', price: 150, source: 'manual', fetchedAt: '2026-01-01T00:00:00.000Z' }],
    )
    expect(gain.cost).toBe(200)
    expect(gain.gain).toBe(100)
    expect(gain.rate).toBeCloseTo(0.5)
    expect(gain.unknown).toBe(true)
  })

  it('posts a due rule once', () => {
    const rule = {
      id: 'rent',
      title: 'اجاره',
      amount: 1000,
      type: 'expense' as const,
      categoryId: 'home',
      accountId: 'cash-wallet',
      frequency: 'monthly' as const,
      nextDate: '1405-07-01',
    }
    const first = rollRecurring([rule], [], '1405-07-12')
    expect(first.changed).toBe(true)
    expect(first.transactions).toHaveLength(1)
    expect(first.transactions[0].id).toBe('recur-rent-1405-07-01')
    expect(first.rules[0].nextDate > '1405-07-12').toBe(true)
    const second = rollRecurring(first.rules, first.transactions, '1405-07-12')
    expect(second.changed).toBe(false)
    expect(second.transactions).toHaveLength(1)
  })

  it('warns when the pace empties a budget before month end', () => {
    expect(daysBeforeBudgetEnds(8000, 10000, '1405-07', '1405-07-10')).toBe(18)
    expect(daysBeforeBudgetEnds(1000, 10000, '1405-07', '1405-07-10')).toBeNull()
  })

  it('mentions the month comparison when last month had spending', () => {
    const rows = [
      tx({ id: '1', type: 'expense', amount: 100, date: '1405-06-05', categoryId: 'food' }),
      tx({ id: '2', type: 'expense', amount: 50, date: '1405-07-05', categoryId: 'food' }),
    ]
    const lines = monthInsights(rows, '1405-07', '1405-07-10')
    expect(lines[0]).toContain('کمتر')
  })
})
