/**
 * Receipt utility functions for categorizing and grouping invoice items
 */

export interface ReceiptItem {
  description: string
  quantity: number
  unitPrice: number
  total: number
}

export interface GroupedReceiptItem {
  description: string
  total: number
}

/**
 * Categorizes an item description into a standardized category name
 * @param description - The item description to categorize
 * @returns The category name (e.g., "Laboratory Tests", "Medication", etc.)
 */
export function categorizeItem(description: string): string {
  const desc = description.toLowerCase().trim()
  
  if (desc.includes("consultation")) {
    return "Consultation"
  } else if (desc.includes("lab") || desc.includes("laboratory") || desc.includes("blood")) {
    return "Laboratory Tests"
  } else if (
    desc.includes("x-ray") ||
    desc.includes("scan") ||
    desc.includes("ct") ||
    desc.includes("mri") ||
    desc.includes("radiology")
  ) {
    return "Radiology"
  } else if (
    desc.includes("medication") ||
    desc.includes("drug") ||
    /\d+\s*days?/.test(desc)
  ) {
    return "Medication"
  } else if (
    desc.includes("procedure") ||
    desc.includes("surgery") ||
    desc.includes("operation")
  ) {
    return "Procedures"
  } else {
    return "Other"
  }
}

/**
 * Groups receipt items by category and sums their totals
 * @param items - Array of receipt items to group
 * @returns Array of grouped items with category descriptions and total amounts
 */
export function groupItemsByCategory(items: ReceiptItem[]): GroupedReceiptItem[] {
  const grouped = new Map<string, number>()
  
  for (const item of items) {
    const category = categorizeItem(item.description)
    const currentTotal = grouped.get(category) || 0
    grouped.set(category, currentTotal + item.total)
  }
  
  // Convert to array and sort by category name
  return Array.from(grouped.entries())
    .map(([description, total]) => ({ description, total }))
    .sort((a, b) => a.description.localeCompare(b.description))
}
