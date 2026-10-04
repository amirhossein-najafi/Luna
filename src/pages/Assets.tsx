import { useEffect, useState, type FormEvent } from 'react'
import { Button, Notice, PageHeader, fieldClass } from '../components/ui.tsx'
import { JalaliDateField } from '../components/JalaliDateField.tsx'
import { quantityOf, unrealizedGain } from '../domain/wealth.ts'
import { formatNumber, parseAmount, parseDecimal } from '../lib/money.ts'
import { formatStamp, todayJalali } from '../lib/jalali.ts'
import { fetchMarketQuotes, QuoteError } from '../lib/quotes.ts'
import { useFinance } from '../store/finance.tsx'
import { HOLDING_KINDS, HOLDING_META, type AssetLot, type HoldingKind, type Quote } from '../types.ts'

export function AssetsPage() {
  const { state, setQuotes, clearQuote, saveLot, deleteLot } = useFinance()
  const [message, setMessage] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const gain = unrealizedGain(state.lots, state.quotes)
  const total = HOLDING_KINDS.reduce((sum, kind) => {
    const price = state.quotes.find((quote) => quote.kind === kind)?.price ?? 0
    return sum + quantityOf(state.lots, kind) * price
  }, 0)

  async function refresh() {
    if (!state.apiKey.trim()) {
      setMessage({ tone: 'err', text: 'برای دریافت از BrsApi، کلید را در تنظیمات ذخیره کن. قیمت دستی همین‌جا هم کار می‌کند.' })
      return
    }
    setLoading(true)
    setMessage(null)
    try {
      const incoming = await fetchMarketQuotes(state.apiKey.trim())
      setQuotes(incoming)
      const missed = HOLDING_KINDS.filter((kind) => !incoming.some((quote) => quote.kind === kind))
      setMessage({
        tone: 'ok',
        text:
          missed.length === 0
            ? 'قیمت دلار، طلا و سکه به‌روز شد.'
            : `قیمت ${missed.map((kind) => HOLDING_META[kind].name).join(' و ')} در پاسخ نبود و قیمت قبلی‌اش ماند.`,
      })
    } catch (error) {
      setMessage({
        tone: 'err',
        text: error instanceof QuoteError ? error.message : 'دریافت قیمت ممکن نشد. قیمت را دستی وارد کن.',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="طلا، دلار، سکه"
        title="دارایی"
        action={
          <Button onClick={refresh} disabled={loading}>
            {loading ? 'در حال دریافت…' : 'دریافت قیمت بازار'}
          </Button>
        }
      />
      <section className="rounded-3xl border border-gold/40 bg-panel p-5">
        <p className="text-sm text-mute">ارزش روز دارایی</p>
        <p className="mt-2 text-3xl font-bold text-gold">
          {formatNumber(Math.round(total))} <span className="text-base font-medium text-mute">تومان</span>
        </p>
        <p className="mt-2 text-sm text-mute">
          {gain.cost > 0
            ? `سود تحقق‌نیافته ${gain.gain >= 0 ? '+' : '−'}${formatNumber(Math.abs(Math.round(gain.gain)))} تومان${gain.rate != null ? ` (${formatNumber(Math.round(gain.rate * 100))}٪)` : ''}`
            : 'برای دیدن سود، قیمت خرید هر بخش را ثبت کن.'}
          {gain.unknown ? ' بخش‌های بدون قیمت خرید در سود نیست.' : ''}
        </p>
      </section>
      {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}
      <div className="grid gap-3">
        {HOLDING_KINDS.map((kind) => (
          <HoldingCard
            key={kind}
            kind={kind}
            lots={state.lots.filter((lot) => lot.kind === kind)}
            quote={state.quotes.find((quote) => quote.kind === kind)}
            onPrice={(price) => {
              if (price > 0) {
                setQuotes([{ kind, price, source: 'manual', fetchedAt: new Date().toISOString() }])
              } else {
                clearQuote(kind)
              }
            }}
            onAdd={(lot) => saveLot(lot)}
            onDelete={deleteLot}
          />
        ))}
      </div>
    </div>
  )
}

function HoldingCard({
  kind,
  lots,
  quote,
  onPrice,
  onAdd,
  onDelete,
}: {
  kind: HoldingKind
  lots: AssetLot[]
  quote?: Quote
  onPrice: (price: number) => void
  onAdd: (lot: AssetLot) => void
  onDelete: (id: string) => void
}) {
  const meta = HOLDING_META[kind]
  const quantity = quantityOf(lots, kind)
  const [priceDraft, setPriceDraft] = useState(quote ? String(quote.price) : '')
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState('')
  const [cost, setCost] = useState('')
  const [date, setDate] = useState(todayJalali())
  const [note, setNote] = useState('')

  useEffect(() => {
    setPriceDraft(quote ? String(quote.price) : '')
  }, [quote])

  const value = quote ? quantity * quote.price : 0

  function addLot(event: FormEvent) {
    event.preventDefault()
    const quantityNext = parseDecimal(amount)
    if (quantityNext <= 0) return
    onAdd({
      id: '',
      kind,
      quantity: quantityNext,
      unitCost: parseAmount(cost),
      date,
      note: note.trim(),
    })
    setAmount('')
    setCost('')
    setNote('')
    setOpen(false)
  }

  return (
    <article className="rounded-3xl border border-line bg-panel p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-bold">{meta.name}</h2>
          <p className="mt-1 text-xs text-mute">
            {formatNumber(quantity)} {meta.unit}
            {quote ? ` · به‌روز ${formatStamp(quote.fetchedAt)} · ${quote.source === 'tgju' ? 'بازار' : quote.source === 'brsapi' ? 'BrsApi' : 'دستی'}` : ' · هنوز قیمتی ندارد'}
          </p>
        </div>
        <p className="text-sm font-bold">{quote && quantity > 0 ? `${formatNumber(Math.round(value))} تومان` : '—'}</p>
      </div>
      <label className="mt-4 flex flex-col gap-1.5 text-xs text-mute">
        {meta.priceLabel} (تومان)
        <input
          dir="ltr"
          className={`${fieldClass} text-end`}
          inputMode="numeric"
          value={priceDraft}
          placeholder="دستی یا از بازار"
          onChange={(event) => setPriceDraft(event.target.value)}
          onBlur={() => onPrice(parseAmount(priceDraft))}
        />
      </label>
      <ul className="mt-4 flex flex-col gap-2">
        {lots.map((lot) => (
          <li key={lot.id} className="flex items-center justify-between gap-3 text-sm">
            <span>
              {formatNumber(lot.quantity)} {meta.unit}
              {lot.unitCost > 0 ? ` · خرید ${formatNumber(lot.unitCost)}` : ' · بدون قیمت خرید'}
              {lot.note ? ` · ${lot.note}` : ''}
            </span>
            <button type="button" className="text-xs text-mute hover:text-out" onClick={() => onDelete(lot.id)}>
              حذف
            </button>
          </li>
        ))}
      </ul>
      {open ? (
        <form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={addLot}>
          <label className="flex flex-col gap-1.5 text-xs text-mute">
            مقدار ({meta.unit})
            <input dir="ltr" className={`${fieldClass} text-end`} inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} />
          </label>
          <label className="flex flex-col gap-1.5 text-xs text-mute">
            قیمت خرید هر واحد (خالی یعنی نامشخص)
            <input dir="ltr" className={`${fieldClass} text-end`} inputMode="numeric" value={cost} onChange={(event) => setCost(event.target.value)} />
          </label>
          <div className="sm:col-span-2">
            <JalaliDateField value={date} onChange={setDate} />
          </div>
          <label className="flex flex-col gap-1.5 text-xs text-mute sm:col-span-2">
            یادداشت
            <input className={fieldClass} value={note} maxLength={80} onChange={(event) => setNote(event.target.value)} />
          </label>
          <div className="flex gap-2 sm:col-span-2">
            <Button type="submit">ثبت خرید</Button>
            <Button tone="ghost" onClick={() => setOpen(false)}>انصراف</Button>
          </div>
        </form>
      ) : (
        <Button className="mt-4" tone="ghost" onClick={() => setOpen(true)}>
          ثبت خرید
        </Button>
      )}
    </article>
  )
}
