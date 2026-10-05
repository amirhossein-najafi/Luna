import { expandRules } from '../domain/recurring.ts'
import { shiftDays, todayJalali } from './jalali.ts'
import { formatNumber } from './money.ts'
import type { RecurringRule, Transaction } from '../types.ts'

const PREF_KEY = 'luna-notify'

export function notificationsEnabled() {
  try {
    return localStorage.getItem(PREF_KEY) === 'on'
  } catch {
    return false
  }
}

export function setNotificationsEnabled(on: boolean) {
  try {
    localStorage.setItem(PREF_KEY, on ? 'on' : 'off')
  } catch {
    /* Preference stays off when storage is blocked. */
  }
}

export async function requestNotificationPermission() {
  if (typeof Notification === 'undefined') return 'denied' as NotificationPermission
  const result = await Notification.requestPermission()
  setNotificationsEnabled(result === 'granted')
  return result
}

export function remindUpcoming(rules: RecurringRule[], transactions: Transaction[]) {
  if (!notificationsEnabled()) return
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
  const today = todayJalali()
  const tomorrow = shiftDays(today, 1)
  const due = expandRules(rules, tomorrow, tomorrow, transactions).filter((item) => item.type === 'expense')
  if (due.length === 0) return
  const marker = `luna-notified-${tomorrow}`
  try {
    if (sessionStorage.getItem(marker)) return
  } catch {
    return
  }
  const first = due[0]
  const extra = due.length > 1 ? ` و ${formatNumber(due.length - 1)} پرداخت دیگر` : ''
  try {
    new Notification('Luna', {
      body: `فردا ${first.title}، ${formatNumber(first.amount)} تومان${extra}.`,
      lang: 'fa',
    })
    sessionStorage.setItem(marker, '1')
  } catch {
    /* The browser can reject a notification outside a user gesture. */
  }
}
