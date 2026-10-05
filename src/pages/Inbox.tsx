import { useState } from 'react'
import { JalaliDateField } from '../components/JalaliDateField.tsx'
import { SubscriptionHints } from '../components/SubscriptionHints.tsx'
import { Button, Notice, PageHeader, fieldClass } from '../components/ui.tsx'
import { categoriesFor } from '../data/categories.ts'
import { normalizeMerchant, parseInbox, type InboxDraft } from '../domain/inbox.ts'
import { todayJalali } from '../lib/jalali.ts'
import { parseAmount } from '../lib/money.ts'
import { useFinance } from '../store/finance.tsx'

type Row = InboxDraft & {
  key: string
  suggestedCategoryId: string
  suggestedAccountId: string
}

const TYPE_LABEL = { expense: 'هزینه', income: 'درآمد', transfer: 'انتقال' }

export function InboxPage() {
  const { state, addTransaction, saveCategoryRule } = useFinance()
  const [text, setText] = useState('')
  const [rows, setRows] = useState<Row[]>([])
  const [notice, setNotice] = useState('')
  const accounts = state.accounts.filter((account) => !account.archived)

  function detect() {
    const drafts = parseInbox(text, {
      accounts: state.accounts,
      categories: state.categories,
      rules: state.categoryRules,
      today: todayJalali(),
    })
    setRows(
      drafts.map((draft) => ({
        ...draft,
        key: crypto.randomUUID(),
        suggestedCategoryId: draft.categoryId,
        suggestedAccountId: draft.accountId,
      })),
    )
    setNotice(drafts.length === 0 ? 'چیزی برای ساختن تراکنش پیدا نشد.' : '')
  }

  function patch(key: string, partial: Partial<Row>) {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...partial } : row)))
  }

  function commit(list: Row[]) {
    const done = list.filter((row) => row.amount > 0)
    for (const row of done) {
      addTransaction({
        type: row.type,
        amount: row.amount,
        categoryId: row.type === 'transfer' ? '' : row.categoryId,
        accountId: row.accountId,
        toAccountId: row.toAccountId,
        date: row.date,
        note: row.note.slice(0, 140),
      })
      const categoryChanged = row.type !== 'transfer' && row.categoryId !== row.suggestedCategoryId
      const accountChanged = row.accountId !== row.suggestedAccountId
      if (row.merchant && (categoryChanged || accountChanged) && row.categoryId) {
        saveCategoryRule({
          merchant: row.merchant,
          categoryId: row.categoryId,
          accountId: accountChanged ? row.accountId : undefined,
        })
      }
    }
    const keys = new Set(done.map((row) => row.key))
    setRows((current) => current.filter((row) => !keys.has(row.key)))
    if (done.length > 0) setNotice('تراکنش ثبت شد. متن خام ذخیره نمی‌شود.')
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="پیامک و فایل"
        title="صندوق ورودی"
        action={
          <Button onClick={detect} disabled={!text.trim()}>
            تشخیص
          </Button>
        }
      />
      <p className="text-sm text-mute">متن پیامک یا CSV را بچسبان. تأیید، تراکنش عادی می‌سازد و متن خام ذخیره نمی‌شود.</p>
      <textarea
        className={`${fieldClass} min-h-40 resize-y leading-7`}
        aria-label="متن پیامک یا CSV"
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder="متن پیامک بانک، یا ردیف‌های CSV"
      />
      {notice ? <Notice tone={rows.length === 0 && notice.startsWith('چیزی') ? 'err' : 'ok'}>{notice}</Notice> : null}

      {rows.length > 1 ? (
        <div className="flex justify-end">
          <Button tone="ghost" onClick={() => commit(rows)}>
            تأیید همه
          </Button>
        </div>
      ) : null}

      {rows.map((row) => {
        const choices = accounts.some((account) => account.id === row.accountId)
          ? accounts
          : state.accounts.filter((account) => !account.archived || account.id === row.accountId)
        return (
          <article key={row.key} className="flex flex-col gap-3 rounded-3xl border border-line bg-panel p-5">
            <p className="text-sm font-bold">{TYPE_LABEL[row.type]}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                dir="ltr"
                className={`${fieldClass} text-end`}
                inputMode="numeric"
                aria-label="مبلغ"
                value={String(row.amount)}
                onChange={(event) => patch(row.key, { amount: parseAmount(event.target.value) })}
              />
              <JalaliDateField value={row.date} onChange={(date) => patch(row.key, { date })} />
              {row.type === 'transfer' ? null : (
                <select
                  className={fieldClass}
                  aria-label="دسته"
                  value={row.categoryId}
                  onChange={(event) => patch(row.key, { categoryId: event.target.value })}
                >
                  {categoriesFor(row.type, state.categories).map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              )}
              <select
                className={fieldClass}
                aria-label="حساب"
                value={row.accountId}
                onChange={(event) => patch(row.key, { accountId: event.target.value })}
              >
                {choices.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </select>
              {row.type === 'transfer' ? (
                <select
                  className={fieldClass}
                  aria-label="به حساب"
                  value={row.toAccountId ?? ''}
                  onChange={(event) => patch(row.key, { toAccountId: event.target.value })}
                >
                  {choices.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </select>
              ) : null}
              <input
                className={fieldClass}
                aria-label="توضیح"
                maxLength={140}
                value={row.note}
                onChange={(event) =>
                  patch(row.key, { note: event.target.value.slice(0, 140), merchant: normalizeMerchant(event.target.value) })
                }
              />
            </div>
            <div className="flex justify-end">
              <Button onClick={() => commit([row])} disabled={row.amount <= 0}>
                تأیید
              </Button>
            </div>
          </article>
        )
      })}

      <SubscriptionHints />
    </div>
  )
}
