/**
 * Service categories for billing (non-medication items).
 * Used when adding "Service" type items to bills.
 */

export const SERVICE_CATEGORIES: Record<string, string> = {
  "Lab Tests": "Laboratory Tests",
  "Radiology (scan)": "Radiology Scan",
  "Consultation": "Consultation",
  "Medical Treatment": "Medical Treatment",
  "Ear Syringing": "Ear Syringing",
  "Foreign Body Removal": "Foreign Body Removal",
  "Antenatal": "Antenatal Care",
  "Delivery": "Delivery",
  "Admission Fee": "Admission Fee",
}

export const DELIVERY_TYPES: Record<string, string> = {
  "Natural Delivery": "Natural Delivery",
  "C-Section": "Cesarean Section (C-Section)",
}

export const SERVICE_CATEGORY_OPTIONS = Object.keys(SERVICE_CATEGORIES)
export const DELIVERY_TYPE_OPTIONS = Object.keys(DELIVERY_TYPES)
