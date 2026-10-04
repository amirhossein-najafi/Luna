import type { ButtonHTMLAttributes, ReactNode } from 'react'

export const fieldClass =
  'w-full rounded-2xl border border-line bg-ink px-3 py-2.5 text-sm text-cream outline-none transition placeholder:text-mute focus:border-gold'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: 'gold' | 'ghost' | 'danger'
}

export function Button({ tone = 'gold', className = '', type = 'button', ...props }: ButtonProps) {
  const tones = {
    gold: 'bg-gold text-on-gold hover:brightness-105',
    ghost: 'border border-line bg-panel text-cream hover:bg-raise',
    danger: 'bg-out text-white hover:brightness-105',
  }
  return (
    <button
      type={type}
      {...props}
      className={`inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${tones[tone]} ${className}`}
    />
  )
}

export function PageHeader({
  eyebrow,
  title,
  action,
}: {
  eyebrow?: string
  title: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow ? <p className="text-sm text-mute">{eyebrow}</p> : null}
        <h1 className="text-2xl font-bold">{title}</h1>
      </div>
      {action}
    </div>
  )
}

export function Notice({ tone, children }: { tone: 'ok' | 'err'; children: ReactNode }) {
  return (
    <p className={tone === 'ok' ? 'text-sm text-in' : 'text-sm text-out'} role="status">
      {children}
    </p>
  )
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string
  body: string
  action?: ReactNode
}) {
  return (
    <div className="rounded-3xl border border-dashed border-line bg-panel/70 px-6 py-12 text-center">
      <div className="mx-auto mb-4 grid size-14 place-items-center rounded-full border border-gold/40 text-gold">
        <span className="text-xl font-bold">L</span>
      </div>
      <p className="font-medium">{title}</p>
      <p className="mx-auto mt-2 max-w-sm text-sm text-mute">{body}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  )
}
