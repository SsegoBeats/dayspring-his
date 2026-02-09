"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import { convertFromUGX } from "@/lib/utils"

interface Settings {
  theme: string
  locale: string
  timezone: string
  currency: string
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
  notifyEmailReminders: true,
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [loading, setLoading] = useState(true)

  const refreshSettings = async () => {
    // Check if user has a session cookie before making request
    const hasCookie = typeof document !== 'undefined' && 
      /(?:^|;\s)(session=|session_dev=)/.test(document.cookie)
    
    if (!hasCookie) {
      // No session cookie - user not authenticated, use defaults
      setSettings(DEFAULT_SETTINGS)
      setLoading(false)
      return
    }

    try {
      const res = await fetch("/api/settings/preferences", { credentials: "include" })
      if (res.ok) {
        const data = await res.json()
        if (data.preferences) {
          setSettings({
            theme: data.preferences.theme || DEFAULT_SETTINGS.theme,
            locale: data.preferences.locale || DEFAULT_SETTINGS.locale,
            timezone: data.preferences.timezone || DEFAULT_SETTINGS.timezone,
            currency: data.preferences.currency || DEFAULT_SETTINGS.currency,
            notifyEmailReminders: true,
          })
        } else {
          setSettings(DEFAULT_SETTINGS)
        }
      } else if (res.status === 401 || res.status === 403) {
        // User not authenticated or no permission - use defaults silently
        // This is expected for unauthenticated users, don't log as error
        setSettings(DEFAULT_SETTINGS)
      } else if (process.env.NODE_ENV === "development") {
        console.warn("[SettingsContext] Failed to fetch preferences:", res.status, res.statusText)
        setSettings(DEFAULT_SETTINGS)
      } else {
        setSettings(DEFAULT_SETTINGS)
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


