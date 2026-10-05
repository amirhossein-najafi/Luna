import { detectSubscriptions } from '../domain/subscriptions.ts'
import { formatNumber } from '../lib/money.ts'
import { useFinance } from '../store/finance.tsx'
import { Button } from './ui.tsx'

export function SubscriptionHints() {
  const { state, saveRecurring } = useFinance()
  const hints = detectSubscriptions(state.transactions, state.recurring)
  if (hints.length === 0) return null

  return (
    <section className="flex flex-col gap-3">
      {hints.map((hint) => (
        <article key={`${hint.accountId}-${hint.title}`} className="rounded-3xl border border-line bg-panel px-5 py-4">
          <p className="text-sm leading-7">
            به نظر می‌رسد «{hint.title}» یک پرداخت {hint.frequency === 'monthly' ? 'ماهانه' : 'هفتگی'} حدود {formatNumber(hint.amount)} تومان است.
          </p>
          <Button
            className="mt-3"
            onClick={() =>
              saveRecurring({
                id: '',
                title: hint.title,
                amount: hint.amount,
                type: 'expense',
                categoryId: hint.categoryId,
                accountId: hint.accountId,
                frequency: hint.frequency,
                nextDate: hint.nextDate,
              })
            }
          >
            افزودن به پرداخت‌های آینده
          </Button>
        </article>
      ))}
    </section>
  )
}
