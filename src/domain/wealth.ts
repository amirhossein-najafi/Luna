import { cashPosition } from './ledger.ts'
import { HOLDING_KINDS, type Account, type AssetLot, type HoldingKind, type Quote, type Transaction } from '../types.ts'

export function quantityOf(lots: AssetLot[], kind: HoldingKind) {
  return lots.filter((lot) => lot.kind === kind).reduce((sum, lot) => sum + lot.quantity, 0)
}

export function marketValue(lots: AssetLot[], quotes: Quote[]) {
  return HOLDING_KINDS.reduce((sum, kind) => {
    const price = quotes.find((quote) => quote.kind === kind)?.price ?? 0
    return sum + quantityOf(lots, kind) * price
  }, 0)
}

export function unrealizedGain(lots: AssetLot[], quotes: Quote[]) {
  let cost = 0
  let value = 0
  let unknown = false
  for (const lot of lots) {
    if (lot.quantity <= 0) continue
    if (lot.unitCost <= 0) {
      unknown = true
      continue
    }
    const price = quotes.find((quote) => quote.kind === lot.kind)?.price
    if (!price) continue
    cost += lot.quantity * lot.unitCost
    value += lot.quantity * price
  }
  const gain = value - cost
  return {
    cost,
    value,
    gain,
    rate: cost > 0 ? gain / cost : null,
    unknown,
  }
}

export function netWorth(accounts: Account[], transactions: Transaction[], lots: AssetLot[], quotes: Quote[], until?: string) {
  return cashPosition(accounts, transactions, until).liquid + marketValue(lots, quotes)
}
