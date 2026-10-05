import { categoryById } from '../data/categories.ts'
import { formatIsoDate, parseJalaliDate, todayJalali } from '../lib/jalali.ts'
import { latinDigits } from '../lib/money.ts'
import { DEFAULT_ACCOUNT_ID, type Account, type CategoryRule, type CustomCategory, type FlowType } from '../types.ts'
import { parseTransactionCsv, type CsvDraft } from './csv.ts'

export type InboxDraft = CsvDraft & { merchant: string }

const HINTS: { needles: string[]; categoryId: string }[] = [
  { needles: ['snapp', 'tapsi', 'اسنپ', 'تپسی'], categoryId: 'transit' },
  { needles: ['digikala', 'دیجی‌کالا', 'دیجیکالا'], categoryId: 'shop' },
  { needles: ['irancell', 'ایرانسل', 'همراه اول'], categoryId: 'bills' },
]

const DATE_PATTERN = /(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})/
const CARD_PATTERN = /(?:کارت|card)\s*[:\-]?\s*(\d{4,6})/i
const AMOUNT_PATTERN = /(\d{1,3}(?:[,،٬]\d{3})+|\d+)\s*(ریال|تومان)/
const KEYWORD = /^(برداشت|واریز|واریزی|خرید|پرداخت|کارت|card|مبلغ)$/i

export function normalizeMerchant(value: string) {
  return latinDigits(value)
    .toLowerCase()
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80)
}

export function rememberCorrection(
  rules: CategoryRule[],
  input: { merchant: string; categoryId: string; accountId?: string },
): CategoryRule[] {
  const pattern = normalizeMerchant(input.merchant)
  if (!pattern || !input.categoryId) return rules
  const current = rules.find((rule) => normalizeMerchant(rule.pattern) === pattern)
  const next: CategoryRule = {
    id: current?.id ?? crypto.randomUUID(),
    pattern,
    categoryId: input.categoryId,
  }
  if (input.accountId) next.accountId = input.accountId
  const updated = current ? rules.map((rule) => (rule.id === current.id ? next : rule)) : [...rules, next]
  return updated.length <= 200 ? updated : updated.slice(updated.length - 200)
}

export function parseInbox(
  text: string,
  input: { accounts: Account[]; categories: CustomCategory[]; rules: CategoryRule[]; today?: string },
): InboxDraft[] {
  const trimmed = text.trim()
  if (!trimmed) return []
  const csv = parseTransactionCsv(trimmed, input)
  if (csv.accepted.length > 0) {
    return csv.accepted.map((row) => ({ ...row, merchant: normalizeMerchant(row.note) }))
  }
  const today = input.today && parseJalaliDate(input.today) ? input.today : todayJalali()
  return trimmed
    .split(/\n\s*\n/)
    .slice(0, 40)
    .flatMap((block) => {
      const draft = parseSms(block, input, today)
      return draft ? [draft] : []
    })
}

function prepare(block: string) {
  return latinDigits(block).replace(/ي/g, 'ی').replace(/ك/g, 'ک').replace(/\u200c/g, ' ')
}

function readAmount(text: string) {
  const withUnit = text.match(AMOUNT_PATTERN)
  if (withUnit) {
    const raw = Number(withUnit[1].replace(/[,،٬]/g, ''))
    if (raw > 0) {
      const amount = withUnit[2] === 'ریال' ? Math.round(raw / 10) : Math.round(raw)
      if (amount > 0) return { amount, raw: withUnit[0] }
    }
  }
  const stripped = text.replace(DATE_PATTERN, ' ').replace(CARD_PATTERN, ' ')
  let best: { amount: number; raw: string } | null = null
  for (const match of stripped.matchAll(/(\d{1,3}(?:[,،٬]\d{3})+|\d{4,})/g)) {
    const amount = Math.round(Number(match[1].replace(/[,،٬]/g, '')))
    if (amount > 0 && (!best || amount > best.amount)) best = { amount, raw: match[0] }
  }
  return best
}

function flowOf(text: string): FlowType {
  if (/برداشت|خرید|پرداخت/.test(text)) return 'expense'
  if (/واریز/.test(text)) return 'income'
  return 'expense'
}

function merchantFrom(text: string, removals: string[]) {
  let rest = text
  for (const piece of removals) {
    if (piece) rest = rest.replace(piece, ' ')
  }
  const lines = rest
    .split(/\n/)
    .map((line) => line.replace(/[.\-–—:|/\\]+/g, ' ').replace(/\s+/g, ' ').trim())
    .filter((line) => line && !KEYWORD.test(line) && !/^[\d\s,،٬]+$/.test(line))
  return lines.join(' ').replace(/\s+/g, ' ').trim().slice(0, 140)
}

function matchRule(merchant: string, rules: CategoryRule[]) {
  const hay = normalizeMerchant(merchant)
  if (!hay) return null
  const matches = rules.filter((rule) => {
    const needle = normalizeMerchant(rule.pattern)
    return needle.length >= 2 && hay.includes(needle)
  })
  matches.sort((a, b) => normalizeMerchant(b.pattern).length - normalizeMerchant(a.pattern).length)
  return matches[0] ?? null
}

function builtinCategory(merchant: string) {
  const hay = normalizeMerchant(merchant)
  if (!hay) return null
  return HINTS.find((hint) => hint.needles.some((needle) => hay.includes(normalizeMerchant(needle))))?.categoryId ?? null
}

function categoryFor(merchant: string, type: FlowType, rules: CategoryRule[], extra: CustomCategory[]) {
  const rule = matchRule(merchant, rules)
  if (rule) {
    const category = categoryById(rule.categoryId, extra)
    if (category?.type === type) return { categoryId: category.id, accountId: rule.accountId }
  }
  const builtin = builtinCategory(merchant)
  if (builtin) {
    const category = categoryById(builtin, extra)
    if (category?.type === type) return { categoryId: category.id }
  }
  return { categoryId: type === 'income' ? 'other-in' : 'other-out' }
}

function parseSms(
  block: string,
  input: { accounts: Account[]; categories: CustomCategory[]; rules: CategoryRule[] },
  today: string,
): InboxDraft | null {
  const text = prepare(block)
  const amount = readAmount(text)
  if (!amount) return null

  const dateMatch = text.match(DATE_PATTERN)
  let date = today
  let dateRaw = ''
  if (dateMatch) {
    const iso = formatIsoDate(Number(dateMatch[1]), Number(dateMatch[2]), Number(dateMatch[3]))
    if (parseJalaliDate(iso)) {
      date = iso
      dateRaw = dateMatch[0]
    }
  }

  const cardMatch = text.match(CARD_PATTERN)
  const type = flowOf(text)
  const note = merchantFrom(text, [amount.raw, dateRaw, cardMatch?.[0] ?? ''])
  const suggestion = categoryFor(note, type, input.rules, input.categories)
  const ruleAccount = suggestion.accountId
    ? input.accounts.find((account) => account.id === suggestion.accountId && !account.archived)
    : undefined
  const cardAccount = cardMatch
    ? input.accounts.find((account) => !account.archived && account.name.includes(cardMatch[1]))
    : undefined
  const fallback =
    input.accounts.find((account) => account.id === DEFAULT_ACCOUNT_ID && !account.archived) ??
    input.accounts.find((account) => !account.archived)
  const account = ruleAccount ?? cardAccount ?? fallback
  if (!account) return null

  return {
    type,
    amount: amount.amount,
    categoryId: suggestion.categoryId,
    accountId: account.id,
    date,
    note,
    merchant: normalizeMerchant(note),
  }
}
