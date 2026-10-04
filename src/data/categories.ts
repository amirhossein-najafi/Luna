import type { TransactionType } from '../types.ts'

export type Category = {
  id: string
  name: string
  type: TransactionType
  tone: string
}

export const categories: Category[] = [
  { id: 'food', name: 'خوراک', type: 'expense', tone: '#d4a017' },
  { id: 'transit', name: 'حمل‌ونقل', type: 'expense', tone: '#3d8bfd' },
  { id: 'home', name: 'خانه', type: 'expense', tone: '#d4845a' },
  { id: 'shop', name: 'خرید', type: 'expense', tone: '#b07cc6' },
  { id: 'health', name: 'درمان', type: 'expense', tone: '#e15b64' },
  { id: 'bills', name: 'قبض', type: 'expense', tone: '#3aaa8a' },
  { id: 'fun', name: 'سرگرمی', type: 'expense', tone: '#e07a3d' },
  { id: 'other-out', name: 'سایر', type: 'expense', tone: '#8d938c' },
  { id: 'salary', name: 'حقوق', type: 'income', tone: '#1f9d64' },
  { id: 'freelance', name: 'فریلنس', type: 'income', tone: '#2a9d9a' },
  { id: 'gift', name: 'هدیه', type: 'income', tone: '#c9962e' },
  { id: 'other-in', name: 'سایر', type: 'income', tone: '#7d8b84' },
]

export function categoriesFor(type: TransactionType) {
  return categories.filter((category) => category.type === type)
}

export function categoryById(id: string) {
  return categories.find((category) => category.id === id)
}
