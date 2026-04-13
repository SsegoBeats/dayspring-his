"use client"

/**
 * User settings must NOT affect the login page. When there is no session, we use defaults
 * and do not run preference logic. Currency is system-wide (org-level), set by Admin only.
 */
import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import { convertFromUGX } from "@/lib/utils"

interface Settings {
  theme: string
  locale: string
  timezone: string
  currency: string
  dateFormat: string
  defaultDashboard: string
  notifyEmailReminders: boolean
}

interface SettingsContextType {
  settings: Settings | null
  loading: boolean
  refreshSettings: () => Promise<void>
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined)

const DEFAULT_SETTINGS: Settings = {
  theme: "system",
  locale: "en-GB",
  timezone: "Africa/Kampala",
  currency: "UGX",
  dateFormat: "DD/MM/YYYY",
  defaultDashboard: "overview",
  notifyEmailReminders: true,
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [loading, setLoading] = useState(true)

  const refreshSettings = async () => {
    // IMPORTANT: Never run preference logic when there is no session.
    // User settings must not affect the login page or unauthenticated views.
    const hasCookie = typeof document !== 'undefined' &&
      /(?:^|;\s)(session=|session_dev=)/.test(document.cookie)

    if (!hasCookie) {
      setSettings(DEFAULT_SETTINGS)
      setLoading(false)
      return
    }

    try {
      const [prefRes, orgRes] = await Promise.all([
        fetch("/api/settings/preferences", { credentials: "include" }),
        fetch("/api/settings/org", { credentials: "include" }),
      ])
      let currency = DEFAULT_SETTINGS.currency
      if (orgRes.ok) {
        const orgData = await orgRes.json()
        currency = orgData?.settings?.currency || DEFAULT_SETTINGS.currency
      }
      if (prefRes.ok) {
        const data = await prefRes.json()
        if (data.preferences) {
          setSettings({
            theme: data.preferences.theme || DEFAULT_SETTINGS.theme,
            locale: data.preferences.locale || DEFAULT_SETTINGS.locale,
            timezone: data.preferences.timezone || DEFAULT_SETTINGS.timezone,
            currency,
            dateFormat: data.preferences.dateFormat || DEFAULT_SETTINGS.dateFormat,
            defaultDashboard: data.preferences.defaultDashboard || DEFAULT_SETTINGS.defaultDashboard,
            notifyEmailReminders: true,
          })
        } else {
          setSettings({ ...DEFAULT_SETTINGS, currency })
        }
      } else if (prefRes.status === 401 || prefRes.status === 403) {
        setSettings({ ...DEFAULT_SETTINGS, currency })
      } else if (process.env.NODE_ENV === "development") {
        console.warn("[SettingsContext] Failed to fetch preferences:", prefRes.status, prefRes.statusText)
        setSettings({ ...DEFAULT_SETTINGS, currency })
      } else {
        setSettings({ ...DEFAULT_SETTINGS, currency })
      }
    } catch (error) {
      // Only log in development to avoid console noise
      if (process.env.NODE_ENV === "development") {
        console.warn("[SettingsContext] Error fetching preferences:", error)
      }
      setSettings(DEFAULT_SETTINGS)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // Small delay to allow auth cookies to be set after login redirect
    const timer = setTimeout(() => {
      refreshSettings()
    }, 100)
    return () => clearTimeout(timer)
  }, [])

  return <SettingsContext.Provider value={{ settings, loading, refreshSettings }}>{children}</SettingsContext.Provider>
}

export function useSettings() {
  const context = useContext(SettingsContext)
  if (context === undefined) {
    // Return default settings if context is not available (for SSR compatibility)
    return { settings: DEFAULT_SETTINGS, loading: false, refreshSettings: async () => {} }
  }
  return context
}

// Currency formatting hook that uses settings context.
// Assumes all monetary values are stored in UGX in the database and converts
// from UGX into the active user currency before formatting.
export function useFormatCurrency() {
  const { settings } = useSettings()

  return (amountUGX: number, currencyOverride?: string, localeOverride?: string): string => {
    const currencyCode = currencyOverride || settings?.currency || "UGX"
    const baseLocale = settings?.locale || "en-GB"
    const localeCode = localeOverride || baseLocale

    const deriveLocale = (code: string, base: string) => {
      if (code === "UGX") return "en-UG"
      if (code === "KES") return "en-KE"
      if (code === "USD") return "en-US"
      return base
    }

    const formatLocale = deriveLocale(currencyCode, localeCode)
    const converted = convertFromUGX(amountUGX, currencyCode)

    try {
      return new Intl.NumberFormat(formatLocale, {
        style: "currency",
        currency: currencyCode,
        maximumFractionDigits: currencyCode === "UGX" || currencyCode === "KES" ? 0 : 2,
      }).format(converted)
    } catch {
      // Fallback formatting if Intl fails
      const symbol =
        currencyCode === "UGX" ? "UGX" : currencyCode === "KES" ? "KES" : currencyCode === "USD" ? "$" : currencyCode
      return `${symbol} ${Math.round(converted).toLocaleString(formatLocale)}`
    }
  }
}

