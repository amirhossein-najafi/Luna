import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Modal } from '../components/Modal.tsx'
import { MonthSwitcher } from '../components/MonthSwitcher.tsx'
import { TransactionForm } from '../components/TransactionForm.tsx'
import { TransactionList } from '../components/TransactionList.tsx'
import { Button, EmptyState, PageHeader, fieldClass } from '../components/ui.tsx'
import { categories, categoriesFor } from '../data/categories.ts'
import { currentMonth, formatIsoDate, todayJalali } from '../lib/jalali.ts'
import { inMonth, matchesQuery } from '../lib/stats.ts'
import { useFinance } from '../store/finance.tsx'
import type { Transaction, TransactionType } from '../types.ts'

export function TransactionsPage() {
  const { state, month, addTransaction, updateTransaction, deleteTransaction } = useFinance()
  const [params, setParams] = useSearchParams()
  const [editing, setEditing] = useState<Transaction | null>(null)
  const [query, setQuery] = useState('')
  const [type, setType] = useState<'all' | TransactionType>('all')
  const [categoryId, setCategoryId] = useState('all')
  const creating = params.get('new') === '1' && !editing

  const categoryOptions = type === 'all' ? categories : categoriesFor(type)
  const defaultDate = month === currentMonth() ? todayJalali() : formatIsoDate(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 1)

  const visible = useMemo(() => {
    return inMonth(state.transactions, month).filter((tx) => {
      if (type !== 'all' && tx.type !== type) return false
      if (categoryId !== 'all' && tx.categoryId !== categoryId) return false
      return matchesQuery(tx, query)
    })
  }, [state.transactions, month, type, categoryId, query])

  function closeForm() {
    setEditing(null)
    setParams(
      (current) => {
        const next = new URLSearchParams(current)
        next.delete('new')
        return next
      },
      { replace: true },
    )
  }

  function changeType(next: 'all' | TransactionType) {
    setType(next)
    if (categoryId !== 'all' && next !== 'all' && !categoriesFor(next).some((category) => category.id === categoryId)) {
      setCategoryId('all')
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="ثبت و جستجو"
        title="تراکنش‌ها"
        action={
            <Button
            onClick={() => {
              setEditing(null)
              setParams((current) => {
                const next = new URLSearchParams(current)
                next.set('new', '1')
                return next
              })
            }}
          >
            تراکنش جدید
          </Button>
        }
      />
      <MonthSwitcher />
      <div className="grid gap-2 sm:grid-cols-[1fr_9rem_11rem]">
        <input
          className={fieldClass}
          value={query}
          placeholder="جستجو در یادداشت، دسته یا مبلغ"
          aria-label="جستجو"
          onChange={(event) => setQuery(event.target.value)}
        />
        <select className={fieldClass} aria-label="نوع" value={type} onChange={(event) => changeType(event.target.value as 'all' | TransactionType)}>
          <option value="all">همه</option>
          <option value="expense">هزینه</option>
          <option value="income">درآمد</option>
        </select>
        <select className={fieldClass} aria-label="دسته" value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
          <option value="all">همه دسته‌ها</option>
          {categoryOptions.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
              {type === 'all' ? ` (${category.type === 'income' ? 'درآمد' : 'هزینه'})` : ''}
            </option>
          ))}
        </select>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          title={inMonth(state.transactions, month).length === 0 ? 'این ماه خالی است' : 'چیزی با این فیلتر پیدا نشد'}
          body={
            inMonth(state.transactions, month).length === 0
              ? 'اولین درآمد یا هزینه‌ات را ثبت کن. همه‌چیز روی همین دستگاه می‌ماند.'
              : 'عبارت جستجو یا دسته را عوض کن.'
          }
          action={
            inMonth(state.transactions, month).length === 0 ? (
              <Button
                onClick={() => {
                  setParams((current) => {
                    const next = new URLSearchParams(current)
                    next.set('new', '1')
                    return next
                  })
                }}
              >
                ثبت تراکنش
              </Button>
            ) : null
          }
        />
      ) : (
        <TransactionList
          items={visible}
          onEdit={setEditing}
          onDelete={(id) => {
            deleteTransaction(id)
          }}
        />
      )}

      {creating || editing ? (
        <Modal title={editing ? 'ویرایش تراکنش' : 'تراکنش جدید'} onClose={closeForm}>
          <TransactionForm
            key={editing?.id ?? 'new'}
            initial={editing ?? undefined}
            defaultDate={defaultDate}
            onClose={closeForm}
            onSave={(tx) => {
              if (editing) updateTransaction({ ...tx, id: editing.id, note: tx.note })
              else addTransaction(tx)
            }}
          />
        </Modal>
      ) : null}
    </div>
  )
}
