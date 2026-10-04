import type { Account, Transaction } from '../types.ts'

export function accountBalance(account: Account, transactions: Transaction[], until?: string) {
  let balance = account.openingBalance
  for (const tx of transactions) {
    if (until && tx.date > until) continue
    if (tx.type === 'income' && tx.accountId === account.id) balance += tx.amount
    if (tx.type === 'expense' && tx.accountId === account.id) balance -= tx.amount
    if (tx.type === 'transfer' && tx.accountId === account.id) balance -= tx.amount
    if (tx.type === 'transfer' && tx.toAccountId === account.id) balance += tx.amount
  }
  return balance
}

export function cashPosition(accounts: Account[], transactions: Transaction[], until?: string) {
  let cash = 0
  let debt = 0
  for (const account of accounts) {
    const balance = accountBalance(account, transactions, until)
    if (account.kind === 'debt') debt += balance
    else cash += balance
  }
  return { cash, debt, liquid: cash - debt }
}

export function accountInUse(id: string, transactions: Transaction[]) {
  return transactions.some((tx) => tx.accountId === id || tx.toAccountId === id)
}
