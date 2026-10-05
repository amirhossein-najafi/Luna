const LOCK_KEY = 'luna-lock'
const SESSION_KEY = 'luna-unlocked'

type LockRecord = { salt: string; hash: string }

function read(): LockRecord | null {
  try {
    const raw = localStorage.getItem(LOCK_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<LockRecord>
    if (typeof parsed.salt !== 'string' || typeof parsed.hash !== 'string' || !parsed.salt || !parsed.hash) return null
    return { salt: parsed.salt, hash: parsed.hash }
  } catch {
    return null
  }
}

export function lockEnabled() {
  return read() != null
}

export function sessionUnlocked() {
  try {
    return sessionStorage.getItem(SESSION_KEY) === '1'
  } catch {
    return false
  }
}

export function unlockSession() {
  try {
    sessionStorage.setItem(SESSION_KEY, '1')
  } catch {
    /* Session storage can be blocked. The gate stays closed. */
  }
}

export function lockSession() {
  try {
    sessionStorage.removeItem(SESSION_KEY)
  } catch {
    /* Ignore. */
  }
}

async function digest(pin: string, salt: string) {
  const data = new TextEncoder().encode(`${salt}:${pin}`)
  const buffer = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function pinLooksValid(pin: string) {
  return /^\d{4,8}$/.test(pin)
}

export async function savePin(pin: string) {
  const salt = crypto.randomUUID()
  const hash = await digest(pin, salt)
  localStorage.setItem(LOCK_KEY, JSON.stringify({ salt, hash }))
  unlockSession()
}

export async function checkPin(pin: string) {
  const record = read()
  if (!record) return false
  const hash = await digest(pin, record.salt)
  return hash === record.hash
}

export function clearLock() {
  localStorage.removeItem(LOCK_KEY)
  lockSession()
}
