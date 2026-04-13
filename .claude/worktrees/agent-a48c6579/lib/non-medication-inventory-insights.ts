export type NonMedicationInventoryItem = {
  id: string
  item_name: string
  item_type: string
  item_subtype: string | null
  description: string | null
  manufacturer: string | null
  model_number: string | null
  serial_number: string | null
  stock_quantity: number
  unit_of_measure: string
  unit_price: number | null
  cost_price: number | null
  reorder_level: number
  min_stock_level: number
  max_stock_level: number | null
  location: string | null
  barcode: string | null
  expiry_date: string | null
  last_restocked_at: string | null
  created_at: string
  updated_at: string
}

export type InventorySignalTone = "neutral" | "success" | "warning" | "danger"

export type InventorySignal = {
  id: string
  label: string
  tone: InventorySignalTone
}

function hasText(value: string | null | undefined): boolean {
  return Boolean(value && value.trim())
}

function hasNumber(value: number | null | undefined): boolean {
  return typeof value === "number" && Number.isFinite(value)
}

export function normalizeInventoryName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "")
}

export function getConfiguredThreshold(item: Pick<NonMedicationInventoryItem, "reorder_level" | "min_stock_level">): number | null {
  const threshold = Math.max(Number(item.reorder_level) || 0, Number(item.min_stock_level) || 0)
  return threshold > 0 ? threshold : null
}

export function getInventoryHealthSignal(item: NonMedicationInventoryItem): InventorySignal {
  const stock = Number(item.stock_quantity) || 0
  const threshold = getConfiguredThreshold(item)

  if (stock <= 0) {
    return { id: "stock", label: "Out of stock", tone: "danger" }
  }

  if (threshold !== null && stock <= threshold) {
    return { id: "stock", label: "Below par level", tone: "warning" }
  }

  if (threshold === null) {
    return { id: "stock", label: "Par level missing", tone: "neutral" }
  }

  return { id: "stock", label: "Stock stable", tone: "success" }
}

export function getInventoryCompleteness(item: NonMedicationInventoryItem) {
  const checks = [
    { id: "descriptor", label: "Description or subtype", ready: hasText(item.description) || hasText(item.item_subtype) },
    { id: "location", label: "Location", ready: hasText(item.location) },
    { id: "barcode", label: "Barcode", ready: hasText(item.barcode) },
    { id: "threshold", label: "Par level", ready: getConfiguredThreshold(item) !== null },
    { id: "valuation", label: "Pricing", ready: hasNumber(item.unit_price) || hasNumber(item.cost_price) },
  ]

  const ready = checks.filter((check) => check.ready).length
  const total = checks.length

  return {
    ready,
    total,
    percent: Math.round((ready / total) * 100),
    missing: checks.filter((check) => !check.ready).map((check) => check.label),
  }
}

export function getInventorySignals(item: NonMedicationInventoryItem, duplicateCount = 1): InventorySignal[] {
  const signals: InventorySignal[] = [getInventoryHealthSignal(item)]

  if (duplicateCount > 1) {
    signals.push({
      id: "duplicate",
      label: `${duplicateCount} similar records`,
      tone: "danger",
    })
  }

  if (!hasText(item.location)) {
    signals.push({ id: "location", label: "Location missing", tone: "warning" })
  }

  if (!hasText(item.barcode)) {
    signals.push({ id: "barcode", label: "Barcode missing", tone: "warning" })
  }

  if (!hasNumber(item.unit_price) && !hasNumber(item.cost_price)) {
    signals.push({ id: "pricing", label: "Pricing missing", tone: "neutral" })
  }

  return signals
}

export function getInventorySortScore(item: NonMedicationInventoryItem, duplicateCount = 1): number {
  const completeness = getInventoryCompleteness(item)
  const stock = Number(item.stock_quantity) || 0
  const threshold = getConfiguredThreshold(item)
  let score = 0

  if (stock <= 0) score += 40
  else if (threshold !== null && stock <= threshold) score += 24
  else if (threshold === null) score += 12

  if (duplicateCount > 1) score += 20
  score += completeness.missing.length * 4

  return score
}
