import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatCompact, formatNumber } from '../lib/money.ts'

type Slice = { id: string; name: string; value: number; tone: string }
type DayPoint = { label: string; income: number; expense: number }

function ChartTip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: ReadonlyArray<{ name?: unknown; value?: unknown; color?: string }>
  label?: string | number
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-line bg-panel px-3 py-2 text-xs shadow-lg" dir="rtl">
      {label ? <p className="mb-1 text-mute">{label}</p> : null}
      {payload.map((item) => (
        <p key={String(item.name)} style={{ color: item.color }}>
          {String(item.name)}: {formatNumber(Number(item.value ?? 0))} تومان
        </p>
      ))}
    </div>
  )
}

export function ExpenseDonut({ slices }: { slices: Slice[] }) {
  const total = slices.reduce((sum, slice) => sum + slice.value, 0)
  return (
    <div className="grid items-center gap-4 sm:grid-cols-[220px_1fr]">
      <div className="relative h-52" dir="ltr">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={slices} dataKey="value" nameKey="name" innerRadius={58} outerRadius={80} paddingAngle={3} stroke="none" isAnimationActive={false}>
              {slices.map((slice) => (
                <Cell key={slice.id} fill={slice.tone} />
              ))}
            </Pie>
            <Tooltip content={ChartTip} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="text-center">
            <p className="text-xs text-mute">خرج</p>
            <p className="text-sm font-bold">{formatNumber(total)}</p>
          </div>
        </div>
      </div>
      <ul className="flex flex-col gap-2">
        {slices.map((slice) => (
          <li key={slice.id} className="flex items-center justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-center gap-2">
              <span className="size-2.5 shrink-0 rounded-full" style={{ background: slice.tone }} />
              <span className="truncate">{slice.name}</span>
            </span>
            <span className="shrink-0 text-mute">{formatNumber(slice.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function DailyBars({ days }: { days: DayPoint[] }) {
  return (
    <div className="h-56" dir="ltr">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={days} margin={{ top: 8, right: 4, left: 0, bottom: 0 }} barGap={2}>
          <CartesianGrid vertical={false} stroke="var(--line)" />
          <XAxis dataKey="label" tick={{ fill: 'var(--mute)', fontSize: 12 }} axisLine={false} tickLine={false} />
          <YAxis
            tickFormatter={(value) => formatCompact(Number(value))}
            tick={{ fill: 'var(--mute)', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={36}
          />
          <Tooltip content={ChartTip} cursor={{ fill: 'var(--raise)' }} />
          <Bar dataKey="income" name="درآمد" fill="var(--in)" radius={[6, 6, 0, 0]} maxBarSize={18} isAnimationActive={false} />
          <Bar dataKey="expense" name="هزینه" fill="var(--out)" radius={[6, 6, 0, 0]} maxBarSize={18} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
