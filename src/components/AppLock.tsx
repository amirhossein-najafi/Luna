import { useState, type FormEvent } from 'react'
import { checkPin, unlockSession } from '../lib/lock.ts'
import { Button, fieldClass } from './ui.tsx'

export function AppLock({ onUnlock }: { onUnlock: () => void }) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    const ok = await checkPin(pin)
    if (!ok) {
      setError('رمز درست نیست.')
      return
    }
    unlockSession()
    onUnlock()
  }

  return (
    <div className="grid min-h-screen place-items-center px-4">
      <form className="w-full max-w-sm rounded-3xl border border-line bg-panel p-6" onSubmit={onSubmit}>
        <p className="text-lg font-bold" dir="ltr">
          Luna
        </p>
        <p className="mt-2 text-sm text-mute">برای دیدن دخل‌وخرج، رمز را وارد کن.</p>
        <input
          className={`${fieldClass} mt-4 text-center tracking-[0.4em]`}
          dir="ltr"
          inputMode="numeric"
          autoComplete="off"
          aria-label="رمز"
          value={pin}
          maxLength={8}
          onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 8))}
        />
        {error ? <p className="mt-2 text-sm text-out">{error}</p> : null}
        <Button className="mt-4 w-full" type="submit">
          باز کردن
        </Button>
      </form>
    </div>
  )
}
