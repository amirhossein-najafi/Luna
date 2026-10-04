import { createContext, useContext, useEffect, useMemo, useReducer, useState, type ReactNode } from 'react'
import { rollRecurring } from '../domain/recurring.ts'
import { mergeQuotes } from '../domain/quotes.ts'
import { emptyState, loadState, saveState } from '../lib/backup.ts'
import { currentMonth, shiftMonth, todayJalali } from '../lib/jalali.ts'
import type { Account, AssetLot, Budget, FinanceState, Goal, MonthBudget, Quote, RecurringRule, Transaction } from '../types.ts'

type Action =
  | { type: 'add'; tx: Transaction }
  | { type: 'update'; tx: Transaction }
  | { type: 'delete'; id: string }
  | { type: 'budget'; budget: Budget }
  | { type: 'monthBudget'; budget: MonthBudget }
  | { type: 'quotes'; quotes: Quote[] }
  | { type: 'clearQuote'; kind: Quote['kind'] }
  | { type: 'apiKey'; apiKey: string }
  | { type: 'account'; account: Account }
  | { type: 'deleteAccount'; id: string }
  | { type: 'lot'; lot: AssetLot }
  | { type: 'deleteLot'; id: string }
  | { type: 'goal'; goal: Goal }
  | { type: 'deleteGoal'; id: string }
  | { type: 'recurring'; rule: RecurringRule }
  | { type: 'deleteRecurring'; id: string }
  | { type: 'rolled'; transactions: Transaction[]; recurring: RecurringRule[] }
  | { type: 'replace'; state: FinanceState }
  | { type: 'reset' }

type FinanceContextValue = {
  state: FinanceState
  month: string
  setMonth: (month: string) => void
  shiftMonthBy: (delta: number) => void
  addTransaction: (tx: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => void
  updateTransaction: (tx: Transaction) => void
  deleteTransaction: (id: string) => void
  setBudget: (budget: Budget) => void
  setMonthBudget: (budget: MonthBudget) => void
  setQuotes: (quotes: Quote[]) => void
  clearQuote: (kind: Quote['kind']) => void
  setApiKey: (apiKey: string) => void
  saveAccount: (account: Account) => void
  deleteAccount: (id: string) => void
  saveLot: (lot: AssetLot) => void
  deleteLot: (id: string) => void
  saveGoal: (goal: Goal) => void
  deleteGoal: (id: string) => void
  saveRecurring: (rule: RecurringRule) => void
  deleteRecurring: (id: string) => void
  replaceAll: (state: FinanceState) => void
  reset: () => void
}

const FinanceContext = createContext<FinanceContextValue | null>(null)

function withId<T extends { id: string }>(item: T) {
  return item.id ? item : { ...item, id: crypto.randomUUID() }
}

function reducer(state: FinanceState, action: Action): FinanceState {
  switch (action.type) {
    case 'add': {
      const now = new Date().toISOString()
      const tx: Transaction = {
        ...action.tx,
        id: action.tx.id || crypto.randomUUID(),
        createdAt: action.tx.createdAt || now,
        updatedAt: now,
      }
      return { ...state, transactions: [tx, ...state.transactions] }
    }
    case 'update':
      return {
        ...state,
        transactions: state.transactions.map((tx) =>
          tx.id === action.tx.id ? { ...action.tx, createdAt: tx.createdAt, updatedAt: new Date().toISOString() } : tx,
        ),
      }
    case 'delete':
      return { ...state, transactions: state.transactions.filter((tx) => tx.id !== action.id) }
    case 'budget': {
      const rest = state.budgets.filter(
        (budget) => !(budget.categoryId === action.budget.categoryId && budget.month === action.budget.month),
      )
      if (action.budget.limit <= 0) return { ...state, budgets: rest }
      return { ...state, budgets: [...rest, action.budget] }
    }
    case 'monthBudget': {
      const rest = state.monthBudgets.filter((budget) => budget.month !== action.budget.month)
      if (action.budget.limit <= 0) return { ...state, monthBudgets: rest }
      return { ...state, monthBudgets: [...rest, action.budget] }
    }
    case 'quotes':
      return { ...state, quotes: mergeQuotes(state.quotes, action.quotes) }
    case 'clearQuote':
      return { ...state, quotes: state.quotes.filter((quote) => quote.kind !== action.kind) }
    case 'apiKey':
      return { ...state, apiKey: action.apiKey }
    case 'account': {
      const account = withId(action.account)
      const exists = state.accounts.some((item) => item.id === account.id)
      return {
        ...state,
        accounts: exists ? state.accounts.map((item) => (item.id === account.id ? account : item)) : [...state.accounts, account],
      }
    }
    case 'deleteAccount':
      if (state.accounts.length <= 1) return state
      return { ...state, accounts: state.accounts.filter((account) => account.id !== action.id) }
    case 'lot': {
      const lot = withId(action.lot)
      const exists = state.lots.some((item) => item.id === lot.id)
      return {
        ...state,
        lots: exists ? state.lots.map((item) => (item.id === lot.id ? lot : item)) : [lot, ...state.lots],
      }
    }
    case 'deleteLot':
      return { ...state, lots: state.lots.filter((lot) => lot.id !== action.id) }
    case 'goal': {
      const goal = withId(action.goal)
      const exists = state.goals.some((item) => item.id === goal.id)
      return {
        ...state,
        goals: exists ? state.goals.map((item) => (item.id === goal.id ? goal : item)) : [goal, ...state.goals],
      }
    }
    case 'deleteGoal':
      return { ...state, goals: state.goals.filter((goal) => goal.id !== action.id) }
    case 'recurring': {
      const rule = withId(action.rule)
      const exists = state.recurring.some((item) => item.id === rule.id)
      return {
        ...state,
        recurring: exists ? state.recurring.map((item) => (item.id === rule.id ? rule : item)) : [rule, ...state.recurring],
      }
    }
    case 'deleteRecurring':
      return { ...state, recurring: state.recurring.filter((rule) => rule.id !== action.id) }
    case 'rolled':
      return { ...state, transactions: action.transactions, recurring: action.recurring }
    case 'replace':
      return action.state
    case 'reset':
      return emptyState()
  }
}

export function FinanceProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadState)
  const [month, setMonth] = useState(currentMonth)

  useEffect(() => {
    saveState(state)
  }, [state])

  useEffect(() => {
    const rolled = rollRecurring(state.recurring, state.transactions, todayJalali())
    if (!rolled.changed) return
    dispatch({ type: 'rolled', transactions: rolled.transactions, recurring: rolled.rules })
  }, [state.recurring, state.transactions])

  const value = useMemo<FinanceContextValue>(
    () => ({
      state,
      month,
      setMonth,
      shiftMonthBy: (delta) => setMonth((current) => shiftMonth(current, delta)),
      addTransaction: (tx) => dispatch({ type: 'add', tx: { ...tx, id: tx.id ?? '', createdAt: '', updatedAt: '' } }),
      updateTransaction: (tx) => dispatch({ type: 'update', tx }),
      deleteTransaction: (id) => dispatch({ type: 'delete', id }),
      setBudget: (budget) => dispatch({ type: 'budget', budget }),
      setMonthBudget: (budget) => dispatch({ type: 'monthBudget', budget }),
      setQuotes: (quotes) => dispatch({ type: 'quotes', quotes }),
      clearQuote: (kind) => dispatch({ type: 'clearQuote', kind }),
      setApiKey: (apiKey) => dispatch({ type: 'apiKey', apiKey }),
      saveAccount: (account) => dispatch({ type: 'account', account }),
      deleteAccount: (id) => dispatch({ type: 'deleteAccount', id }),
      saveLot: (lot) => dispatch({ type: 'lot', lot }),
      deleteLot: (id) => dispatch({ type: 'deleteLot', id }),
      saveGoal: (goal) => dispatch({ type: 'goal', goal }),
      deleteGoal: (id) => dispatch({ type: 'deleteGoal', id }),
      saveRecurring: (rule) => dispatch({ type: 'recurring', rule }),
      deleteRecurring: (id) => dispatch({ type: 'deleteRecurring', id }),
      replaceAll: (next) => dispatch({ type: 'replace', state: next }),
      reset: () => dispatch({ type: 'reset' }),
    }),
    [state, month],
  )

  return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>
}

export function useFinance() {
  const value = useContext(FinanceContext)
  if (!value) throw new Error('useFinance must be used inside FinanceProvider')
  return value
}
