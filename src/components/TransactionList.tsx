import { useState } from 'react'
import { categoryById } from '../data/categories.ts'
import { formatDayLabel, weekdayLabel } from '../lib/jalali.ts'
import { formatNumber } from '../lib/money.ts'
import type { Account, Transaction } from '../types.ts'

export function TransactionList({
  items,
  accounts = [],
  onEdit,
  onDelete,
}: {
  items: Transaction[]
  accounts?: Account[]
  onEdit?: (tx: Transaction) => void
  onDelete?: (id: string) => void
}) {
  const [pendingId, setPendingId] = useState<string | null>(null)
  const sorted = [...items].sort(
    (a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id),
  )
  const nameOf = (id?: string) => accounts.find((account) => account.id === id)?.name
  const groups: { date: string; items: Transaction[] }[] = []

  for (const tx of sorted) {
    const last = groups[groups.length - 1]
    if (!last || last.date !== tx.date) groups.push({ date: tx.date, items: [tx] })
    else last.items.push(tx)
  }

  return (
    <div className="flex flex-col gap-5">
      {groups.map((group) => (
        <section key={group.date}>
          <h3 className="mb-1 text-xs text-mute">
            {weekdayLabel(group.date)}، {formatDayLabel(group.date)}
          </h3>
          <ul className="divide-y divide-line rounded-3xl border border-line bg-panel px-4">
            {group.items.map((tx) => {
              const category = categoryById(tx.categoryId)
              const income = tx.type === 'income'
              const transfer = tx.type === 'transfer'
              const title = transfer ? 'انتقال' : (category?.name ?? 'نامشخص')
              const from = nameOf(tx.accountId)
              const to = nameOf(tx.toAccountId)
              const badge = transfer ? `از ${from ?? 'حساب'} به ${to ?? 'حساب'}` : from
              return (
                <li key={tx.id} className="flex items-start gap-3 py-3">
                  <span
                    className="mt-0.5 grid size-10 shrink-0 place-items-center rounded-2xl text-sm font-bold"
                    style={{ background: `${category?.tone ?? '#8d938c'}22`, color: category?.tone ?? '#8d938c' }}
                  >
                    {(title).slice(0, 1)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{title}</p>
                    {badge ? <p className="truncate text-xs text-gold">{badge}</p> : null}
                    {tx.note ? <p className="truncate text-xs text-mute">{tx.note}</p> : null}
                    {onEdit && onDelete ? (
                      <div className="mt-1 flex gap-3 text-xs">
                        {pendingId === tx.id ? (
                          <>
                            <button type="button" className="text-out" onClick={() => onDelete(tx.id)}>
                              حذف شود
                            </button>
                            <button type="button" className="text-mute" onClick={() => setPendingId(null)}>
                              نه
                            </button>
                          </>
                        ) : (
                          <>
                            <button type="button" className="text-mute hover:text-cream" onClick={() => onEdit(tx)}>
                              ویرایش
                            </button>
                            <button type="button" className="text-mute hover:text-out" onClick={() => setPendingId(tx.id)}>
                              حذف
                            </button>
                          </>
                        )}
                      </div>
                    ) : null}
                  </div>
                  <p className={`shrink-0 text-sm font-medium ${income ? 'text-in' : transfer ? 'text-cream' : 'text-out'}`} dir="ltr">
                    {income ? '+' : transfer ? '' : '−'}
                    {formatNumber(tx.amount)}
                  </p>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}
