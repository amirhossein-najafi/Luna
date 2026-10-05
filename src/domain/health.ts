import { formatNumber } from '../lib/money.ts'

export type HealthPart = {
  id: 'savings' | 'budget' | 'debt'
  label: string
  score: number
  weight: number
  measured: boolean
  note: string
}

export function healthScore(input: {
  income: number
  expense: number
  monthLimit: number
  categoryBudgets: { spent: number; limit: number }[]
  liquid: number
  debt: number
}) {
  let savingsScore = 50
  let savingsMeasured = false
  let savingsNote = 'درآمد این ماه صفر است. تا وقتی درآمد نیاید، این بخش روی ۵۰ می‌ماند و نمره را جابه‌جا نمی‌کند.'
  if (input.income > 0) {
    savingsMeasured = true
    const rate = (input.income - input.expense) / input.income
    savingsScore = Math.round(Math.min(100, Math.max(0, (rate / 0.2) * 100)))
    const kept = input.income - input.expense
    savingsNote =
      kept >= input.income * 0.2
        ? `از ${formatNumber(input.income)} تومان درآمد، ${formatNumber(kept)} تومان مانده. هدف این بخش ۲۰٪ درآمد است و به آن رسیده‌ای.`
        : kept > 0
          ? `از ${formatNumber(input.income)} تومان درآمد، ${formatNumber(kept)} تومان مانده. هدف این بخش ۲۰٪ درآمد است.`
          : `خرج ${formatNumber(input.expense)} تومان است و از درآمد ${formatNumber(input.income)} تومان بیشتر شده.`
  }

  const limits = [
    ...(input.monthLimit > 0 ? [{ spent: input.expense, limit: input.monthLimit }] : []),
    ...input.categoryBudgets.filter((item) => item.limit > 0),
  ]
  let budgetScore = 70
  let budgetMeasured = false
  let budgetNote = 'برای این ماه سقفی نگذاشتی. تا وقتی بودجه نباشد، این بخش روی ۷۰ می‌ماند.'
  if (limits.length > 0) {
    budgetMeasured = true
    const scores = limits.map(({ spent, limit }) => {
      const ratio = spent / limit
      if (ratio <= 1) return 100
      return Math.max(0, Math.round(100 - (ratio - 1) * 100))
    })
    budgetScore = Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length)
    const monthText =
      input.monthLimit > 0 ? `خرج کل ${formatNumber(input.expense)} تومان از سقف ${formatNumber(input.monthLimit)} است. ` : ''
    budgetNote = budgetScore === 100 ? `${monthText}سقف‌هایی که گذاشتی رد نشده‌اند.` : `${monthText}دست‌کم یک سقف رد شده و همان، این بخش را پایین آورده.`
  }

  let debtScore = 100
  let debtNote = 'حساب بدهی نداری. این بخش به‌خاطر نبودِ بدهی ۱۰۰ است.'
  if (input.debt > 0) {
    const cash = Math.max(input.liquid, 0)
    const base = input.debt + cash
    const ratio = base <= 0 ? 1 : input.debt / base
    debtScore = Math.round(Math.max(0, 100 - ratio * 100))
    debtNote =
      input.liquid >= input.debt
        ? `بدهی ${formatNumber(input.debt)} تومان است و از موجودی نقد ${formatNumber(cash)} تومان کمتر است.`
        : `بدهی ${formatNumber(input.debt)} تومان از موجودی نقد بیشتر است.`
  }

  const score = Math.round(savingsScore * 0.4 + budgetScore * 0.3 + debtScore * 0.3)
  const title = score >= 80 ? 'آرام' : score >= 60 ? 'پایدار' : score >= 40 ? 'شکننده' : 'تحت فشار'
  const band = title === 'آرام' ? '۸۰ تا ۱۰۰' : title === 'پایدار' ? '۶۰ تا ۸۰' : title === 'شکننده' ? '۴۰ تا ۶۰' : 'زیر ۴۰'
  const summary = `${title} یعنی نمره در بازهٔ ${band} است. از میانگین وزنی سه بخش پایین به دست می‌آید: پس‌انداز ۴۰٪، بودجه ۳۰٪ و بدهی ۳۰٪.`
  const parts: HealthPart[] = [
    { id: 'savings', label: 'پس‌انداز', score: savingsScore, weight: 40, measured: savingsMeasured, note: savingsNote },
    { id: 'budget', label: 'بودجه', score: budgetScore, weight: 30, measured: budgetMeasured, note: budgetNote },
    { id: 'debt', label: 'بدهی', score: debtScore, weight: 30, measured: true, note: debtNote },
  ]
  return { score, title, summary, parts }
}
