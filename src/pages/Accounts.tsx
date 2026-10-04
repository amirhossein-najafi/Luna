import { useState, type FormEvent } from 'react'
import { accountBalance, accountInUse } from '../domain/ledger.ts'
import { Button, PageHeader, fieldClass } from '../components/ui.tsx'
import { formatNumber, parseAmount } from '../lib/money.ts'
import { ACCOUNT_KINDS, ACCOUNT_META, type Account, type AccountKind } from '../types.ts'
import { useFinance } from '../store/finance.tsx'

export function AccountsPage() {
  const { state, saveAccount, deleteAccount } = useFinance()
  const [editing, setEditing] = useState<Account | null>(null)
  const [creating, setCreating] = useState(false)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="پول کجاست"
        title="حساب‌ها"
        action={<Button onClick={() => { setEditing(null); setCreating(true) }}>حساب جدید</Button>}
      />
      <div className="grid gap-3">
        {state.accounts.map((account) => {
          const balance = accountBalance(account, state.transactions)
          const used = accountInUse(account.id, state.transactions)
          return (
            <article key={account.id} className="rounded-3xl border border-line bg-panel p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-bold">{account.name}</h2>
                  <p className="mt-1 text-xs text-mute">
                    {ACCOUNT_META[account.kind]}
                    {account.archived ? ' · آرشیو' : ''}
                  </p>
                </div>
                <p className={`text-lg font-bold ${account.kind === 'debt' ? 'text-out' : 'text-cream'}`} dir="ltr">
                  {formatNumber(balance)}
                </p>
              </div>
              <div className="mt-3 flex gap-3 text-xs">
                <button type="button" className="text-mute hover:text-cream" onClick={() => { setCreating(false); setEditing(account) }}>
                  ویرایش
                </button>
                {!used && state.accounts.length > 1 ? (
                  <button type="button" className="text-mute hover:text-out" onClick={() => deleteAccount(account.id)}>
                    حذف
                  </button>
                ) : null}
              </div>
            </article>
          )
        })}
      </div>
      {creating || editing ? (
        <AccountForm
          initial={editing ?? undefined}
          onClose={() => { setCreating(false); setEditing(null) }}
          onSave={(account) => {
            saveAccount(account)
            setCreating(false)
            setEditing(null)
          }}
        />
      ) : null}
    </div>
  )
}

function AccountForm({
  initial,
  onSave,
  onClose,
}: {
  initial?: Account
  onSave: (account: Account) => void
  onClose: () => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [kind, setKind] = useState<AccountKind>(initial?.kind ?? 'bank')
  const [opening, setOpening] = useState(initial ? String(initial.openingBalance) : '')
  const [archived, setArchived] = useState(initial?.archived ?? false)
  const [error, setError] = useState('')

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!name.trim()) {
      setError('نام حساب را بنویس.')
      return
    }
    onSave({
      id: initial?.id ?? '',
      name: name.trim(),
      kind,
      openingBalance: parseAmount(opening),
      archived,
    })
  }

  return (
    <form className="rounded-3xl border border-line bg-panel p-5" onSubmit={onSubmit}>
      <h2 className="font-bold">{initial ? 'ویرایش حساب' : 'حساب جدید'}</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-sm">
          نام
          <input className={fieldClass} value={name} maxLength={40} onChange={(event) => setName(event.target.value)} />
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          نوع
          <select className={fieldClass} value={kind} onChange={(event) => setKind(event.target.value as AccountKind)}>
            {ACCOUNT_KINDS.map((item) => (
              <option key={item} value={item}>
                {ACCOUNT_META[item]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          مانده اولیه (تومان)
          <input dir="ltr" className={`${fieldClass} text-end`} inputMode="numeric" value={opening} onChange={(event) => setOpening(event.target.value)} />
        </label>
        <label className="flex items-center gap-2 self-end pb-3 text-sm">
          <input type="checkbox" checked={archived} onChange={(event) => setArchived(event.target.checked)} />
          آرشیو شود
        </label>
      </div>
      {error ? <p className="mt-2 text-sm text-out">{error}</p> : null}
      <div className="mt-4 flex gap-2">
        <Button type="submit">ذخیره</Button>
        <Button tone="ghost" onClick={onClose}>انصراف</Button>
      </div>
    </form>
  )
}
