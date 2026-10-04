import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { IconBudget, IconCoin, IconGear, IconHome, IconList } from './icons.tsx'

const links = [
  { to: '/', label: 'داشبورد', short: 'خانه', end: true, icon: IconHome },
  { to: '/transactions', label: 'تراکنش‌ها', short: 'تراکنش', end: false, icon: IconList },
  { to: '/budgets', label: 'بودجه', short: 'بودجه', end: false, icon: IconBudget },
  { to: '/assets', label: 'دارایی', short: 'دارایی', end: false, icon: IconCoin },
  { to: '/settings', label: 'تنظیمات', short: 'تنظیم', end: false, icon: IconGear },
]

function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'))

  function toggle() {
    const next = !document.documentElement.classList.contains('dark')
    document.documentElement.classList.toggle('dark', next)
    localStorage.setItem('luna-theme', next ? 'dark' : 'light')
    setDark(next)
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? 'حالت روشن' : 'حالت تیره'}
      className={
        compact
          ? 'rounded-xl px-3 py-1.5 text-xs text-mute hover:bg-raise hover:text-cream'
          : 'w-full rounded-2xl px-3 py-2.5 text-start text-sm text-mute hover:bg-raise hover:text-cream'
      }
    >
      {dark ? 'حالت روشن' : 'حالت تیره'}
    </button>
  )
}

function itemClass(active: boolean) {
  return `flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm transition ${
    active ? 'bg-gold/15 font-medium text-gold' : 'text-mute hover:bg-raise hover:text-cream'
  }`
}

export function Shell() {
  return (
    <div className="min-h-screen md:flex">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-e border-line bg-panel md:flex">
        <div className="flex items-center gap-3 px-5 py-6">
          <span className="grid size-11 place-items-center rounded-2xl bg-gold text-lg font-bold text-on-gold">L</span>
          <div>
            <p className="text-lg font-bold leading-none" dir="ltr">
              Luna
            </p>
            <p className="mt-1 text-xs text-mute">مدیریت دخل‌وخرج</p>
          </div>
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-3" aria-label="اصلی">
          {links.map((link) => (
            <NavLink key={link.to} to={link.to} end={link.end} className={({ isActive }) => itemClass(isActive)}>
              <link.icon />
              {link.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3">
          <ThemeToggle />
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-line bg-ink/85 px-4 py-3 backdrop-blur md:hidden">
          <div className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-xl bg-gold text-sm font-bold text-on-gold">L</span>
            <span className="font-bold" dir="ltr">
              Luna
            </span>
          </div>
          <ThemeToggle compact />
        </header>
        <main className="mx-auto w-full max-w-6xl px-4 py-6 pb-28 md:px-8 md:py-8 md:pb-10">
          <Outlet />
        </main>
      </div>

      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-panel/95 backdrop-blur md:hidden"
        aria-label="اصلی"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <ul className="grid grid-cols-5">
          {links.map((link) => (
            <li key={link.to}>
              <NavLink
                to={link.to}
                end={link.end}
                className={({ isActive }) =>
                  `flex flex-col items-center gap-1 px-1 py-2 text-[11px] ${isActive ? 'text-gold' : 'text-mute'}`
                }
              >
                <link.icon />
                {link.short}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
