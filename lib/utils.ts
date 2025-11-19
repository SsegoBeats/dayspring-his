import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// We treat amounts stored in the database as UGX by default.
// This helper converts from UGX to the user's display currency.
const FX_FROM_UGX: Record<string, number> = {
  UGX: 1,
  // Approximate rates; adjust from .env or settings as needed.
  USD: 1 / 3800, // 1 USD ≈ 3,800 UGX
  KES: 1 / 30, // 1 KES ≈ 30 UGX
}

export function convertFromUGX(amountUGX: number, currency: string): number {
  const rate = FX_FROM_UGX[currency] ?? 1
  return amountUGX * rate
}

export function formatUGX(amount: number): string {
  try {
    return new Intl.NumberFormat("en-UG", { style: "currency", currency: "UGX", maximumFractionDigits: 0 }).format(
      amount,
    )
  } catch {
    return `UGX ${Math.round(amount).toLocaleString("en-UG")}`
  }
}

// Helper function for currency formatting usable on server or client.
// It assumes amounts are stored in UGX and converts to the requested currency.
export function formatCurrencyStatic(amountUGX: number, currency: string = "UGX", locale: string = "en-GB"): string {
  const converted = convertFromUGX(amountUGX, currency)
  try {
    let formatLocale = locale
    if (currency === "UGX") {
      formatLocale = "en-UG"
    } else if (currency === "KES") {
      formatLocale = "en-KE"
    } else if (currency === "USD") {
      formatLocale = "en-US"
    }

    return new Intl.NumberFormat(formatLocale, {
      style: "currency",
      currency,
      maximumFractionDigits: currency === "UGX" || currency === "KES" ? 0 : 2,
    }).format(converted)
  } catch {
    const symbol = currency === "UGX" ? "UGX" : currency === "KES" ? "KES" : currency === "USD" ? "$" : currency
    return `${symbol} ${Math.round(converted).toLocaleString(locale)}`
  }
}
