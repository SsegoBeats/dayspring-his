import {
  NON_MEDICATION_CATEGORIES,
  isValidNonMedicationCategory,
  isValidSubtypeForCategory,
  type NonMedicationCategory,
} from "@/lib/constants/non-medication-inventory"

export type NonMedicationValidationDraft = {
  itemName: string
  itemType: string
  itemSubtype: string | null
  description: string | null
  manufacturer: string | null
  modelNumber: string | null
  serialNumber: string | null
  stockQuantity: number
  unitOfMeasure: string
  unitPrice: number | null
  costPrice: number | null
  reorderLevel: number
  minStockLevel: number
  maxStockLevel: number | null
  location: string | null
  barcode: string | null
  expiryDate: string | null
}

type ValidationRuleGroup = {
  locationRequired: boolean
  assetIdentifierRequired: boolean
  stockThresholdRequired: boolean
}

const DEFAULT_RULES: ValidationRuleGroup = {
  locationRequired: true,
  assetIdentifierRequired: false,
  stockThresholdRequired: false,
}

const CATEGORY_RULES: Record<NonMedicationCategory, ValidationRuleGroup> = {
  "Medical Equipment": {
    locationRequired: true,
    assetIdentifierRequired: true,
    stockThresholdRequired: false,
  },
  "Diagnostic Equipment": {
    locationRequired: true,
    assetIdentifierRequired: true,
    stockThresholdRequired: false,
  },
  "Surgical & Procedure Equipment": {
    locationRequired: true,
    assetIdentifierRequired: true,
    stockThresholdRequired: false,
  },
  "Personal Protective Gear": {
    locationRequired: true,
    assetIdentifierRequired: false,
    stockThresholdRequired: true,
  },
  "Patient Care Items": {
    locationRequired: true,
    assetIdentifierRequired: false,
    stockThresholdRequired: false,
  },
  "Consumables and Supplies": {
    locationRequired: true,
    assetIdentifierRequired: false,
    stockThresholdRequired: true,
  },
  "Office Supplies": {
    locationRequired: true,
    assetIdentifierRequired: false,
    stockThresholdRequired: true,
  },
}

export function getNonMedicationCategoryRules(category: string): ValidationRuleGroup {
  if (!isValidNonMedicationCategory(category)) {
    return DEFAULT_RULES
  }

  return CATEGORY_RULES[category]
}

export function getNonMedicationRequirementLabels(category: string): string[] {
  const rules = getNonMedicationCategoryRules(category)
  const labels: string[] = []

  if (rules.locationRequired) {
    labels.push("Location required")
  }
  if (rules.assetIdentifierRequired) {
    labels.push("Barcode, model, or serial required")
  }
  if (rules.stockThresholdRequired) {
    labels.push("Par level required")
  }

  return labels
}

export function getNonMedicationValidationErrors(draft: NonMedicationValidationDraft): string[] {
  const errors: string[] = []
  const itemName = draft.itemName.trim()
  const itemType = draft.itemType.trim()
  const itemSubtype = draft.itemSubtype?.trim() || null
  const location = draft.location?.trim() || null
  const barcode = draft.barcode?.trim() || null
  const modelNumber = draft.modelNumber?.trim() || null
  const serialNumber = draft.serialNumber?.trim() || null
  const threshold = Math.max(Number(draft.reorderLevel) || 0, Number(draft.minStockLevel) || 0)

  if (!itemName) {
    errors.push("Item name is required.")
  }

  if (!itemType) {
    errors.push("Category is required.")
    return errors
  }

  if (!isValidNonMedicationCategory(itemType)) {
    errors.push("Invalid category.")
    return errors
  }

  if (itemSubtype && !isValidSubtypeForCategory(itemType as NonMedicationCategory, itemSubtype)) {
    errors.push("Invalid subtype for this category.")
  }

  const rules = getNonMedicationCategoryRules(itemType)

  if (rules.locationRequired && !location) {
    errors.push("Location is required for this category.")
  }

  if (rules.assetIdentifierRequired && !barcode && !modelNumber && !serialNumber) {
    errors.push("Barcode, model number, or serial number is required for equipment records.")
  }

  if (rules.stockThresholdRequired && threshold <= 0) {
    errors.push("Reorder level or minimum stock level must be greater than 0 for stocked supplies.")
  }

  if (draft.maxStockLevel !== null && draft.maxStockLevel !== undefined && draft.maxStockLevel > 0 && threshold > 0 && draft.maxStockLevel < threshold) {
    errors.push("Maximum stock level cannot be below the configured minimum or reorder level.")
  }

  if ((draft.unitPrice !== null && draft.unitPrice < 0) || (draft.costPrice !== null && draft.costPrice < 0)) {
    errors.push("Pricing values cannot be negative.")
  }

  return errors
}

export function makeNonMedicationValidationDraft(input: Partial<NonMedicationValidationDraft> & Pick<NonMedicationValidationDraft, "itemName" | "itemType">): NonMedicationValidationDraft {
  return {
    itemName: input.itemName,
    itemType: input.itemType,
    itemSubtype: input.itemSubtype ?? null,
    description: input.description ?? null,
    manufacturer: input.manufacturer ?? null,
    modelNumber: input.modelNumber ?? null,
    serialNumber: input.serialNumber ?? null,
    stockQuantity: Number.isFinite(input.stockQuantity) ? Number(input.stockQuantity) : 0,
    unitOfMeasure: input.unitOfMeasure ?? "units",
    unitPrice: input.unitPrice ?? null,
    costPrice: input.costPrice ?? null,
    reorderLevel: Number.isFinite(input.reorderLevel) ? Number(input.reorderLevel) : 0,
    minStockLevel: Number.isFinite(input.minStockLevel) ? Number(input.minStockLevel) : 0,
    maxStockLevel: input.maxStockLevel ?? null,
    location: input.location ?? null,
    barcode: input.barcode ?? null,
    expiryDate: input.expiryDate ?? null,
  }
}

export const NON_MEDICATION_CATEGORY_OPTIONS = [...NON_MEDICATION_CATEGORIES]
