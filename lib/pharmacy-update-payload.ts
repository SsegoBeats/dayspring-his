export type MedicationUpdatePayload = {
  name?: string
  category?: string
  manufacturer?: string
  stockQuantity?: number
  unitPrice?: number
  costPrice?: number
  expiryDate?: string
  reorderLevel?: number
  minStockLevel?: number
  maxStockLevel?: number
  barcode?: string
  is_controlled?: boolean
  schedule_class?: string | null
}

export function buildMedicationUpdatePayload(updates: Partial<MedicationUpdatePayload>): MedicationUpdatePayload {
  const payload: MedicationUpdatePayload = {}

  if (typeof updates.name === "string") {
    payload.name = updates.name.trim()
  }
  if (typeof updates.category === "string") {
    payload.category = updates.category.trim()
  }
  if (typeof updates.manufacturer === "string") {
    payload.manufacturer = updates.manufacturer.trim()
  }
  if (typeof updates.stockQuantity === "number" && Number.isFinite(updates.stockQuantity)) {
    payload.stockQuantity = Math.max(0, Math.trunc(updates.stockQuantity))
  }
  if (typeof updates.unitPrice === "number" && Number.isFinite(updates.unitPrice)) {
    payload.unitPrice = updates.unitPrice
  }
  if (typeof updates.costPrice === "number" && Number.isFinite(updates.costPrice)) {
    payload.costPrice = updates.costPrice >= 0 ? updates.costPrice : undefined
  }
  if (typeof updates.expiryDate === "string") {
    payload.expiryDate = updates.expiryDate || undefined
  }
  if (typeof updates.reorderLevel === "number" && Number.isFinite(updates.reorderLevel)) {
    payload.reorderLevel = Math.max(0, Math.trunc(updates.reorderLevel))
  }
  if (typeof updates.minStockLevel === "number" && Number.isFinite(updates.minStockLevel)) {
    payload.minStockLevel = Math.max(0, Math.trunc(updates.minStockLevel))
  }
  if (typeof updates.maxStockLevel === "number" && Number.isFinite(updates.maxStockLevel)) {
    payload.maxStockLevel = Math.max(0, Math.trunc(updates.maxStockLevel))
  }
  if (typeof updates.barcode === "string") {
    payload.barcode = updates.barcode.trim() || undefined
  }
  if (typeof updates.is_controlled === "boolean") {
    payload.is_controlled = updates.is_controlled
  }
  if (typeof updates.schedule_class === "string") {
    payload.schedule_class = updates.schedule_class.trim() || null
  } else if (updates.schedule_class === null) {
    payload.schedule_class = null
  }

  return payload
}
