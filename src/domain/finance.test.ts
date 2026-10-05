import { describe, expect, it } from 'vitest'
import { daysBeforeBudgetEnds } from './budget.ts'
import { parseTransactionCsv } from './csv.ts'
import { cashFlow } from './flow.ts'
import { healthScore } from './health.ts'
import { realValue } from './inflation.ts'
import { monthInsights, savingsRate } from './insights.ts'
import { accountBalance, cashPosition } from './ledger.ts'
import { mergeQuotes } from './quotes.ts'
import { projectCashflow } from './forecast.ts'
import { editOccurrence, expandRecurring, payOccurrence, postponeOccurrence, skipOccurrence } from './recurring.ts'
import { safeToSpend } from './spend.ts'
import { netWorth, quantityOf, unrealizedGain } from './wealth.ts'
import { parseBackup, serializeBackup } from '../lib/backup.ts'
import { totalOf } from '../lib/stats.ts'
import { defaultAccount, type Account, type Goal, type Quote, type RecurringRule, type Transaction } from '../types.ts'

function rentRule(nextDate: string): RecurringRule {
  return {
    id: 'rent',
    title: 'اجاره',
    amount: 1000,
    type: 'expense',
    categoryId: 'home',
    accountId: 'cash-wallet',
    frequency: 'monthly',
    nextDate,
  }
}

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
    expect(state.safetyBuffer).toBe(0)

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

  it('posts one occurrence and ignores a second pay', () => {
    const rule = rentRule('1405-07-01')
    const first = payOccurrence([rule], [], 'rent', '1405-07-01', '2026-01-01T00:00:00.000Z')
    expect(first.changed).toBe(true)
    expect(first.transactions).toHaveLength(1)
    expect(first.transactions[0].id).toBe('recur-rent-1405-07-01')
    const second = payOccurrence(first.rules, first.transactions, 'rent', '1405-07-01')
    expect(second.changed).toBe(false)
    expect(second.transactions).toHaveLength(1)
  })

  it('does not create a transaction when an occurrence is skipped', () => {
    const skipped = skipOccurrence([rentRule('1405-07-01')], 'rent', '1405-07-01')
    expect(expandRecurring(skipped.rules[0], '1405-07-01', '1405-07-01', [])).toEqual([])
    expect(payOccurrence(skipped.rules, [], 'rent', '1405-07-01').changed).toBe(false)
  })

  it('keeps the next cadence date when one occurrence is postponed', () => {
    const moved = postponeOccurrence([rentRule('1405-07-15')], 'rent', '1405-07-15', '1405-07-20')
    const dates = expandRecurring(moved.rules[0], '1405-07-01', '1405-08-20', []).map((item) => item.date)
    expect(dates).toEqual(['1405-07-20', '1405-08-15'])
  })

  it('treats an older auto-posted transaction as already paid', () => {
    const posted = tx({
      id: 'recur-rent-1405-07-01',
      type: 'expense',
      amount: 1000,
      date: '1405-07-01',
      categoryId: 'home',
      note: 'اجاره',
      recurringId: 'rent',
    })
    const dates = expandRecurring(rentRule('1405-07-01'), '1405-07-01', '1405-08-01', [posted]).map((item) => item.occurrenceDate)
    expect(dates).toEqual(['1405-08-01'])
  })

  it('pays the edited amount for a single occurrence', () => {
    const edited = editOccurrence([rentRule('1405-07-01')], 'rent', '1405-07-01', { amount: 1500 })
    const paid = payOccurrence(edited.rules, [], 'rent', '1405-07-01', '2026-01-01T00:00:00.000Z')
    expect(paid.transactions[0].amount).toBe(1500)
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

describe('import, inflation and health', () => {
  it('reads a csv row and skips an unknown category', () => {
    const text = 'تاریخ,مبلغ,نوع,دسته,حساب,توضیح\n1405-07-02,80000,هزینه,خوراک,کیف پول,چای\n1405-07-03,1000,هزینه,ناشناخته,کیف پول,\n'
    const parsed = parseTransactionCsv(text, { accounts: [defaultAccount()], categories: [] })
    expect(parsed.accepted).toEqual([
      expect.objectContaining({ type: 'expense', amount: 80000, categoryId: 'food', accountId: 'cash-wallet', date: '1405-07-02' }),
    ])
    expect(parsed.skipped[0]).toContain('ناشناخته')
  })

  it('keeps a custom category through backup and drops an unknown one', () => {
    const state = parseBackup(JSON.stringify({
      app: 'luna',
      categories: [{ id: 'custom-coffee', name: 'قهوه', type: 'expense', tone: '#112233' }],
      transactions: [
        { id: 'c', type: 'expense', amount: 10, categoryId: 'custom-coffee', date: '1405-07-01', note: '' },
        { id: 'bad', type: 'expense', amount: 10, categoryId: 'missing', date: '1405-07-01', note: '' },
      ],
    }))
    expect(state.categories).toEqual([expect.objectContaining({ id: 'custom-coffee', name: 'قهوه' })])
    expect(state.transactions.map((item) => item.id)).toEqual(['c'])
    expect(state.inflationRate).toBe(35)
  })

  it('brings a year-old amount to today at the annual rate', () => {
    expect(realValue(100, 12, 20)).toBe(120)
    expect(realValue(100, 0, 20)).toBe(100)
  })

  it('scores a calm month higher than an overspent indebted one', () => {
    const calm = healthScore({ income: 100, expense: 70, monthLimit: 80, categoryBudgets: [], liquid: 500, debt: 0 })
    const strained = healthScore({ income: 100, expense: 180, monthLimit: 80, categoryBudgets: [], liquid: 0, debt: 400 })
    expect(calm.score).toBeGreaterThan(strained.score)
    expect(calm.title).toBe('آرام')
    expect(strained.parts.find((part) => part.id === 'debt')?.score).toBeLessThan(50)
  })

  it('reserves manual goals and leaves a linked savings balance out of safe-to-spend', () => {
    const wallet: Account = { ...defaultAccount(), openingBalance: 10_000_000 }
    const savings: Account = { id: 'save', name: 'پس‌انداز', kind: 'savings', openingBalance: 5_000_000, archived: false }
    const goals: Goal[] = [
      { id: 'linked', title: 'سفر', target: 5_000_000, saved: 0, accountId: 'save' },
      { id: 'manual', title: 'دفتر', target: 2_000_000, saved: 1_000_000 },
    ]
    const rules = [
      rentRule('1405-07-20'),
      { ...rentRule('1405-07-28'), id: 'salary', title: 'حقوق', amount: 8_000_000, type: 'income' as const, categoryId: 'salary' },
    ]
    rules[0] = { ...rules[0], amount: 2_000_000 }
    const spend = safeToSpend({
      accounts: [wallet, savings],
      transactions: [],
      rules,
      goals,
      safetyBuffer: 0,
      today: '1405-07-12',
    })
    expect(spend.spendable).toBe(10_000_000)
    expect(spend.commitments).toBe(2_000_000)
    expect(spend.goalReserve).toBe(1_000_000)
    expect(spend.safeTotal).toBe(7_000_000)
    expect(spend.paydayKnown).toBe(true)
    expect(spend.horizon).toBe('1405-07-28')
    expect(spend.days).toBe(16)
    expect(spend.daily).toBeCloseTo(7_000_000 / 16)
  })

  it('uses the end of the month when no income rule exists', () => {
    const spend = safeToSpend({
      accounts: [defaultAccount()],
      transactions: [],
      rules: [],
      goals: [],
      safetyBuffer: 0,
      today: '1405-07-12',
    })
    expect(spend.paydayKnown).toBe(false)
    expect(spend.horizon).toBe('1405-07-30')
    expect(spend.days).toBe(19)
  })

  it('counts a future posted payment in the forecast without planning it twice', () => {
    const wallet: Account = { ...defaultAccount(), openingBalance: 10_000_000 }
    const paid = tx({
      id: 'recur-rent-1405-07-20',
      type: 'expense',
      amount: 2_000_000,
      date: '1405-07-20',
      categoryId: 'home',
      recurringId: 'rent',
    })
    const projection = projectCashflow({
      accounts: [wallet],
      transactions: [paid],
      rules: [{ ...rentRule('1405-07-20'), amount: 2_000_000 }],
      today: '1405-07-13',
      days: 30,
    })
    expect(projection.timeline.some((item) => item.occurrenceDate === '1405-07-20')).toBe(false)
    expect(projection.points.find((item) => item.date === '1405-07-20')?.spendable).toBe(8_000_000)
    const spend = safeToSpend({
      accounts: [wallet],
      transactions: [paid],
      rules: [{ ...rentRule('1405-07-20'), amount: 2_000_000 }],
      goals: [],
      safetyBuffer: 0,
      today: '1405-07-13',
    })
    expect(spend.commitments).toBe(2_000_000)
    expect(spend.safeTotal).toBe(8_000_000)
  })

  it('finds the day a spendable account would go negative', () => {
    const wallet: Account = { ...defaultAccount(), openingBalance: 1_000_000 }
    const projection = projectCashflow({
      accounts: [wallet],
      transactions: [],
      rules: [
        { ...rentRule('1405-07-12'), id: 'salary', title: 'حقوق', amount: 10_000_000, type: 'income', categoryId: 'salary' },
        { ...rentRule('1405-07-15'), amount: 12_000_000 },
      ],
      today: '1405-07-10',
      days: 90,
    })
    expect(projection.firstNegative).toMatchObject({ accountId: 'cash-wallet', date: '1405-07-15', balance: -1_000_000 })
    expect(projection.horizons.map((item) => item.days)).toEqual([30, 60, 90])
  })

  it('ignores lots bought after the historical date', () => {
    const lots = [
      { id: 'old', kind: 'gold18' as const, quantity: 2, unitCost: 10, date: '1405-06-01', note: '' },
      { id: 'new', kind: 'gold18' as const, quantity: 3, unitCost: 10, date: '1405-07-20', note: '' },
    ]
    const quotes: Quote[] = [{ kind: 'gold18', price: 100, source: 'manual', fetchedAt: '2026-01-01T00:00:00.000Z' }]
    expect(quantityOf(lots, 'gold18', '1405-07-01')).toBe(2)
    expect(quantityOf(lots, 'gold18', '1405-07-20')).toBe(5)
    expect(quantityOf(lots, 'gold18')).toBe(5)
    expect(netWorth([defaultAccount()], [], lots, quotes, '1405-07-01')).toBe(200)
    expect(netWorth([defaultAccount()], [], lots, quotes, '1405-07-20')).toBe(500)
  })

  it('sends income through the month and out to spending and savings', () => {
    const rows = [
      tx({ id: 'in', type: 'income', amount: 100, date: '1405-07-01', categoryId: 'salary' }),
      tx({ id: 'out', type: 'expense', amount: 40, date: '1405-07-02', categoryId: 'food' }),
    ]
    const flow = cashFlow(rows)
    expect(flow?.nodes.map((node) => node.name)).toEqual(['حقوق', 'جریان ماه', 'خوراک', 'پس‌انداز'])
    expect(flow?.links.reduce((sum, link) => sum + link.value, 0)).toBe(200)
  })
})
