import { createContext, useContext, useEffect, useMemo, useReducer, useState, type ReactNode } from 'react'
import { emptyState, loadState, saveState } from '../lib/backup.ts'
import { currentMonth, shiftMonth } from '../lib/jalali.ts'
import type { Budget, FinanceState, Holding, Quote, Transaction } from '../types.ts'

type Action =
  | { type: 'add'; tx: Transaction }
  | { type: 'update'; tx: Transaction }
  | { type: 'delete'; id: string }
  | { type: 'budget'; budget: Budget }
  | { type: 'holding'; holding: Holding }
  | { type: 'quotes'; quotes: Quote[] }
  | { type: 'apiKey'; apiKey: string }
  | { type: 'replace'; state: FinanceState }
  | { type: 'reset' }

type FinanceContextValue = {
  state: FinanceState
  month: string
  setMonth: (month: string) => void
  shiftMonthBy: (delta: number) => void
  addTransaction: (tx: Omit<Transaction, 'id'> & { id?: string }) => void
  updateTransaction: (tx: Transaction) => void
  deleteTransaction: (id: string) => void
  setBudget: (budget: Budget) => void
  setHolding: (holding: Holding) => void
  setQuotes: (quotes: Quote[]) => void
  setApiKey: (apiKey: string) => void
  replaceAll: (state: FinanceState) => void
  reset: () => void
}

const FinanceContext = createContext<FinanceContextValue | null>(null)

function reducer(state: FinanceState, action: Action): FinanceState {
  switch (action.type) {
    case 'add':
      return {
        ...state,
        transactions: [{ ...action.tx, id: action.tx.id || crypto.randomUUID() }, ...state.transactions],
      }
    case 'update':
      return {
        ...state,
        transactions: state.transactions.map((tx) => (tx.id === action.tx.id ? action.tx : tx)),
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
    case 'holding':
      return {
        ...state,
        holdings: state.holdings.map((holding) =>
          holding.kind === action.holding.kind ? action.holding : holding,
        ),
      }
    case 'quotes':
      return { ...state, quotes: action.quotes }
    case 'apiKey':
      return { ...state, apiKey: action.apiKey }
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

  const value = useMemo<FinanceContextValue>(
    () => ({
      state,
      month,
      setMonth,
      shiftMonthBy: (delta) => setMonth((current) => shiftMonth(current, delta)),
      addTransaction: (tx) => dispatch({ type: 'add', tx: { ...tx, id: tx.id ?? '' } }),
      updateTransaction: (tx) => dispatch({ type: 'update', tx }),
      deleteTransaction: (id) => dispatch({ type: 'delete', id }),
      setBudget: (budget) => dispatch({ type: 'budget', budget }),
      setHolding: (holding) => dispatch({ type: 'holding', holding }),
      setQuotes: (quotes) => dispatch({ type: 'quotes', quotes }),
      setApiKey: (apiKey) => dispatch({ type: 'apiKey', apiKey }),
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
