import type { Quote } from '../types.ts'

export function mergeQuotes(current: Quote[], incoming: Quote[]) {
  const map = new Map(current.map((quote) => [quote.kind, quote]))
  for (const quote of incoming) {
    if (quote.price > 0) map.set(quote.kind, quote)
  }
  return [...map.values()]
}
