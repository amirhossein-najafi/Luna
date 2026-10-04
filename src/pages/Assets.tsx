import { useEffect, useState } from 'react'
import { Button, Notice, PageHeader, fieldClass } from '../components/ui.tsx'
import { formatNumber, parseAmount, parseDecimal } from '../lib/money.ts'
import { formatStamp } from '../lib/jalali.ts'
import { fetchMarketQuotes, QuoteError } from '../lib/quotes.ts'
import { useFinance } from '../store/finance.tsx'
import { HOLDING_KINDS, HOLDING_META, type HoldingKind, type Quote } from '../types.ts'

export function AssetsPage() {
  const { state, setHolding, setQuotes } = useFinance()
  const [message, setMessage] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null)
  const [loading, setLoading] = useState(false)

  const total = state.holdings.reduce((sum, holding) => {
    const quote = state.quotes.find((item) => item.kind === holding.kind)
    if (!quote) return sum
    return sum + holding.amount * quote.price
  }, 0)
  const missing = state.holdings.filter(
    (holding) => holding.amount > 0 && !state.quotes.some((quote) => quote.kind === holding.kind),
  )

  async function refresh() {
    if (!state.apiKey.trim()) {
      setMessage({ tone: 'err', text: 'برای دریافت خودکار، کلید BrsApi را در تنظیمات ذخیره کن. قیمت دستی همین‌جا هم کار می‌کند.' })
      return
    }
    setLoading(true)
    setMessage(null)
    try {
      const incoming = await fetchMarketQuotes(state.apiKey.trim())
      const merged = new Map(state.quotes.map((quote) => [quote.kind, quote]))
      for (const quote of incoming) merged.set(quote.kind, quote)
      setQuotes([...merged.values()])
      const missed = HOLDING_KINDS.filter((kind) => !incoming.some((quote) => quote.kind === kind))
      setMessage({
        tone: 'ok',
        text:
          missed.length === 0
            ? 'قیمت دلار، طلا و سکه به‌روز شد.'
            : `قیمت ${missed.map((kind) => HOLDING_META[kind].name).join(' و ')} در پاسخ نبود. اگر قبلاً دستی وارد شده باشد، همان می‌ماند.`,
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
          {missing.length > 0
            ? `قیمت ${missing.map((holding) => HOLDING_META[holding.kind].name).join(' و ')} وارد نشده و در این جمع نیست.`
            : 'مقدار ضربدر آخرین قیمت. اگر قیمت نگیری، همان عدد دستی می‌ماند.'}
        </p>
      </section>
      {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}
      <div className="grid gap-3">
        {HOLDING_KINDS.map((kind) => (
          <HoldingCard
            key={kind}
            kind={kind}
            amount={state.holdings.find((holding) => holding.kind === kind)?.amount ?? 0}
            quote={state.quotes.find((quote) => quote.kind === kind)}
            onAmount={(amount) => setHolding({ kind, amount })}
            onPrice={(price) => {
              const rest = state.quotes.filter((quote) => quote.kind !== kind)
              setQuotes(price > 0 ? [...rest, { kind, price, updatedAt: new Date().toISOString() }] : rest)
            }}
          />
        ))}
      </div>
    </div>
  )
}

function HoldingCard({
  kind,
  amount,
  quote,
  onAmount,
  onPrice,
}: {
  kind: HoldingKind
  amount: number
  quote?: Quote
  onAmount: (amount: number) => void
  onPrice: (price: number) => void
}) {
  const meta = HOLDING_META[kind]
  const [amountDraft, setAmountDraft] = useState(amount ? String(amount) : '')
  const [priceDraft, setPriceDraft] = useState(quote ? String(quote.price) : '')

  useEffect(() => {
    setAmountDraft(amount ? String(amount) : '')
  }, [amount])

  useEffect(() => {
    setPriceDraft(quote ? String(quote.price) : '')
  }, [quote])

  const value = quote ? amount * quote.price : 0

  return (
    <article className="rounded-3xl border border-line bg-panel p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-bold">{meta.name}</h2>
          <p className="mt-1 text-xs text-mute">{quote ? `به‌روز ${formatStamp(quote.updatedAt)}` : 'هنوز قیمتی ندارد'}</p>
        </div>
        <p className="text-sm font-bold">{quote ? `${formatNumber(Math.round(value))} تومان` : amount > 0 ? 'قیمت را وارد کن' : '—'}</p>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-xs text-mute">
          مقدار ({meta.unit})
          <input
            dir="ltr"
            className={`${fieldClass} text-end`}
            inputMode="decimal"
            value={amountDraft}
            placeholder="۰"
            onChange={(event) => setAmountDraft(event.target.value)}
            onBlur={() => onAmount(parseDecimal(amountDraft))}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-xs text-mute">
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
      </div>
    </article>
  )
}
