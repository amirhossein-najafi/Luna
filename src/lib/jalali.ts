import dayjs from 'dayjs'
import jalaliday from 'jalaliday'
import { toFaDigits } from './money.ts'

dayjs.extend(jalaliday)

export const JALALI_MONTHS = [
  'فروردین',
  'اردیبهشت',
  'خرداد',
  'تیر',
  'مرداد',
  'شهریور',
  'مهر',
  'آبان',
  'آذر',
  'دی',
  'بهمن',
  'اسفند',
]

const WEEKDAYS = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه']

function jalaliDay(value?: string) {
  if (!value) return dayjs().calendar('jalali')
  return dayjs(value, { jalali: true }).calendar('jalali')
}

export function todayJalali() {
  return jalaliDay().format('YYYY-MM-DD')
}

export function currentMonth() {
  return jalaliDay().format('YYYY-MM')
}

export function shiftMonth(month: string, delta: number) {
  return jalaliDay(`${month}-01`).add(delta, 'month').format('YYYY-MM')
}

export function daysInMonth(year: number, month: number) {
  return jalaliDay(`${year}-${String(month).padStart(2, '0')}-01`).daysInMonth()
}

export function formatIsoDate(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function parseJalaliDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (month < 1 || month > 12) return null
  const max = daysInMonth(year, month)
  if (day < 1 || day > max) return null
  return { year, month, day }
}

export function todayParts() {
  const parsed = parseJalaliDate(todayJalali())
  return parsed ?? { year: 1405, month: 1, day: 1 }
}

export function formatMonthLabel(month: string) {
  const [year, monthText] = month.split('-')
  const name = JALALI_MONTHS[Number(monthText) - 1] ?? ''
  return `${name} ${toFaDigits(year)}`
}

export function formatDayLabel(date: string) {
  const parsed = parseJalaliDate(date)
  if (!parsed) return toFaDigits(date)
  return `${toFaDigits(parsed.day)} ${JALALI_MONTHS[parsed.month - 1]} ${toFaDigits(parsed.year)}`
}

export function weekdayLabel(date: string) {
  const parsed = jalaliDay(date)
  return WEEKDAYS[parsed.day()] ?? ''
}

export function formatStamp(iso: string) {
  const parsed = dayjs(iso)
  if (!parsed.isValid()) return ''
  const jalali = parsed.calendar('jalali')
  return `${formatDayLabel(jalali.format('YYYY-MM-DD'))}، ${toFaDigits(jalali.format('HH:mm'))}`
}
