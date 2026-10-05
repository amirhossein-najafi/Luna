import { categoriesFor } from '../data/categories.ts'
import { totalOf } from '../lib/stats.ts'
import type { CustomCategory, Transaction } from '../types.ts'

export type FlowNode = { name: string; tone: string }
export type FlowLink = { source: number; target: number; value: number }

export function cashFlow(transactions: Transaction[], extra: CustomCategory[] = []) {
  const incomes = categoriesFor('income', extra)
    .map((category) => ({
      ...category,
      value: totalOf(
        transactions.filter((tx) => tx.type === 'income' && tx.categoryId === category.id),
        'income',
      ),
    }))
    .filter((category) => category.value > 0)
  const expenses = categoriesFor('expense', extra)
    .map((category) => ({
      ...category,
      value: totalOf(
        transactions.filter((tx) => tx.type === 'expense' && tx.categoryId === category.id),
        'expense',
      ),
    }))
    .filter((category) => category.value > 0)
  const income = incomes.reduce((sum, category) => sum + category.value, 0)
  const expense = expenses.reduce((sum, category) => sum + category.value, 0)
  if (income <= 0 && expense <= 0) return null

  const used = new Set<string>()
  const unique = (name: string) => {
    if (!used.has(name)) {
      used.add(name)
      return name
    }
    const next = `${name} ${used.size}`
    used.add(next)
    return next
  }

  const nodes: FlowNode[] = []
  const links: FlowLink[] = []
  for (const category of incomes) {
    links.push({ source: nodes.length, target: -1, value: category.value })
    nodes.push({ name: unique(category.name), tone: category.tone })
  }
  let deficit = -1
  if (expense > income) {
    deficit = nodes.length
    nodes.push({ name: unique('از موجودی'), tone: '#e15b64' })
  }
  const middle = nodes.length
  nodes.push({ name: 'جریان ماه', tone: '#d4a017' })
  for (const link of links) link.target = middle
  if (deficit >= 0) links.push({ source: deficit, target: middle, value: expense - income })
  for (const category of expenses) {
    links.push({ source: middle, target: nodes.length, value: category.value })
    nodes.push({ name: unique(category.name), tone: category.tone })
  }
  if (income > expense) {
    links.push({ source: middle, target: nodes.length, value: income - expense })
    nodes.push({ name: unique('پس‌انداز'), tone: '#1f9d64' })
  }
  return { nodes, links }
}
