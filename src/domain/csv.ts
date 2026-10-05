import { categoryById, categoriesFor } from '../data/categories.ts'
import { formatIsoDate, parseJalaliDate } from '../lib/jalali.ts'
import { latinDigits, parseAmount, toFaDigits } from '../lib/money.ts'
import { DEFAULT_ACCOUNT_ID, type Account, type CustomCategory, type Transaction, type TransactionType } from '../types.ts'

export type CsvDraft = Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>

const HEADER: Record<string, 'date' | 'amount' | 'type' | 'category' | 'account' | 'to' | 'note'> = {
  تاریخ: 'date',
  date: 'date',
  مبلغ: 'amount',
  amount: 'amount',
  نوع: 'type',
  type: 'type',
  دسته: 'category',
  category: 'category',
  حساب: 'account',
  account: 'account',
  'به حساب': 'to',
  to: 'to',
  مقصد: 'to',
  توضیح: 'note',
  یادداشت: 'note',
  note: 'note',
}

const TYPES: Record<string, TransactionType> = {
  expense: 'expense',
  هزینه: 'expense',
  خرج: 'expense',
  income: 'income',
  درآمد: 'income',
  transfer: 'transfer',
  انتقال: 'transfer',
}

const LIMIT = 400

function splitLine(line: string, delimiter: string) {
  const cells: string[] = []
  let current = ''
  let quoted = false
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"'
        index += 1
      } else quoted = !quoted
    } else if (char === delimiter && !quoted) {
      cells.push(current.trim())
      current = ''
    } else current += char
  }
  cells.push(current.trim())
  return cells
}

function delimiterOf(line: string) {
  const counts = [
    { char: ',', count: line.split(',').length },
    { char: ';', count: line.split(';').length },
    { char: '\t', count: line.split('\t').length },
  ]
  return counts.sort((a, b) => b.count - a.count)[0].char
}

function normalizeDate(value: string) {
  const digits = latinDigits(value).trim().replace(/[/.]/g, '-')
  const match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(digits)
  if (!match) return null
  const iso = formatIsoDate(Number(match[1]), Number(match[2]), Number(match[3]))
  return parseJalaliDate(iso) ? iso : null
}

function findAccount(value: string, accounts: Account[]) {
  const needle = value.trim()
  if (!needle) return null
  return accounts.find((account) => account.id === needle || account.name === needle) ?? null
}

function findCategory(value: string, type: 'income' | 'expense', extra: CustomCategory[]) {
  const needle = value.trim()
  if (!needle) return null
  const byId = categoryById(needle, extra)
  if (byId && byId.type === type) return byId
  return categoriesFor(type, extra).find((category) => category.name === needle) ?? null
}

export function parseTransactionCsv(text: string, input: { accounts: Account[]; categories: CustomCategory[] }) {
  const accepted: CsvDraft[] = []
  const skipped: string[] = []
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim())
  if (lines.length === 0) return { accepted, skipped: ['فایل خالی است.'] }

  const delimiter = delimiterOf(lines[0])
  const first = splitLine(lines[0], delimiter)
  const header = first.map((cell) => HEADER[latinDigits(cell).trim().toLowerCase()] ?? null)
  const headed = header.includes('date') && header.includes('amount')
  const rows = headed ? lines.slice(1) : lines
  const fallback = input.accounts.find((account) => account.id === DEFAULT_ACCOUNT_ID) ?? input.accounts[0]

  rows.slice(0, LIMIT).forEach((line, index) => {
    const row = index + (headed ? 2 : 1)
    const cells = splitLine(line, delimiter)
    const pick = (key: (typeof header)[number]) => {
      if (!headed) {
        const order = ['date', 'amount', 'type', 'category', 'account', 'note', 'to']
        return cells[order.indexOf(key ?? '')] ?? ''
      }
      const at = header.indexOf(key)
      return at >= 0 ? (cells[at] ?? '') : ''
    }
    const date = normalizeDate(pick('date'))
    const amount = parseAmount(pick('amount'))
    const type = TYPES[latinDigits(pick('type')).trim().toLowerCase()]
    if (!date || amount <= 0 || !type) {
      skipped.push(`ردیف ${toFaDigits(row)}: تاریخ، مبلغ یا نوع معتبر نیست.`)
      return
    }
    const account = findAccount(pick('account'), input.accounts) ?? (pick('account').trim() ? null : fallback)
    if (!account) {
      skipped.push(`ردیف ${toFaDigits(row)}: حساب پیدا نشد.`)
      return
    }
    if (type === 'transfer') {
      const target = findAccount(pick('to'), input.accounts)
      if (!target || target.id === account.id) {
        skipped.push(`ردیف ${toFaDigits(row)}: مقصد انتقال پیدا نشد.`)
        return
      }
      accepted.push({ type, amount, categoryId: '', accountId: account.id, toAccountId: target.id, date, note: pick('note').slice(0, 140) })
      return
    }
    const category = findCategory(pick('category'), type, input.categories)
    if (!category) {
      skipped.push(`ردیف ${toFaDigits(row)}: دسته «${pick('category').trim() || '—'}» پیدا نشد.`)
      return
    }
    accepted.push({ type, amount, categoryId: category.id, accountId: account.id, date, note: pick('note').slice(0, 140) })
  })

  if (rows.length > LIMIT) skipped.push(`فقط ${toFaDigits(LIMIT)} ردیف اول خوانده شد.`)
  return { accepted, skipped }
}
