import { Sankey, Tooltip, type SankeyNodeProps } from 'recharts'
import { cashFlow } from '../domain/flow.ts'
import { formatNumber } from '../lib/money.ts'
import type { CustomCategory, Transaction } from '../types.ts'

function FlowNode({ x, y, width, height, payload }: SankeyNodeProps) {
  const node = payload as { name?: string; tone?: string; depth?: number }
  const source = node.depth === 0
  return (
    <g>
      <rect x={x} y={y} width={width} height={Math.max(height, 2)} fill={node.tone ?? 'var(--gold)'} rx={3} />
      {node.name && node.name !== 'جریان ماه' ? (
        <text
          x={source ? x - 8 : x + width + 8}
          y={y + Math.max(height, 2) / 2}
          textAnchor={source ? 'end' : 'start'}
          dominantBaseline="central"
          fill="var(--cream)"
          fontSize={11}
        >
          {node.name}
        </text>
      ) : null}
    </g>
  )
}

export function CashFlow({ transactions, categories }: { transactions: Transaction[]; categories: CustomCategory[] }) {
  const flow = cashFlow(transactions, categories)
  if (!flow) return <p className="py-8 text-center text-sm text-mute">برای جریان پول، این ماه درآمد یا هزینه لازم است.</p>

  return (
    <div className="h-80" dir="ltr">
      <Sankey
        width={640}
        height={300}
        data={flow}
        node={FlowNode}
        nodePadding={18}
        nodeWidth={12}
        sort={false}
        margin={{ top: 8, right: 96, bottom: 8, left: 96 }}
        link={{ stroke: 'var(--gold)', strokeOpacity: 0.45 }}
      >
        <Tooltip
          content={({ payload }) => {
            const row = payload?.[0]?.payload as { name?: string; value?: number; payload?: { source?: { name?: string }; target?: { name?: string }; value?: number } } | undefined
            if (!row) return null
            const link = row.payload
            const title = row.name ?? (link?.source?.name && link.target?.name ? `${link.source.name} ← ${link.target.name}` : '')
            const value = row.value ?? link?.value
            if (!title || value == null) return null
            return (
              <div className="rounded-xl border border-line bg-panel px-3 py-2 text-xs" dir="rtl">
                <p>{title}</p>
                <p className="mt-1">{formatNumber(value)} تومان</p>
              </div>
            )
          }}
        />
      </Sankey>
    </div>
  )
}
