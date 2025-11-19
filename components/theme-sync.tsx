"use client"

import { useEffect, useState, useRef } from "react"
import { useTheme } from "next-themes"
import { useSettings } from "@/lib/settings-context"

export function ThemeSync() {
  const { setTheme, theme } = useTheme()
  const [initialized, setInitialized] = useState(false)
  const lastThemeRef = useRef<string>("")
  const startThemeRef = useRef<string | null>(null)
  const { settings, loading } = useSettings()

  useEffect(() => {
    // capture theme at mount to detect user changes before fetch resolves
    if (startThemeRef.current === null) startThemeRef.current = theme || ""
    // Fetch signed-in user and their preferred theme
    const fetchUserTheme = async () => {
      try {
        if (loading) return
        const hasCookie = typeof document !== 'undefined' && /(?:^|;\s)(session=|session_dev=)/.test(document.cookie)
        if (!hasCookie) return
        let userId: string | null = null
        try {
          const me = await fetch('/api/auth/me', { credentials: 'include' })
          if (me.ok) {
            const d = await me.json()
            userId = d?.user?.id || null
          }
        } catch {}

        // If lastThemeUser belongs to a different account, reset to neutral 'system'
        try {
          if (userId) {
            const lastUser = localStorage.getItem('lastThemeUser')
            if (lastUser && lastUser !== userId) {
              localStorage.setItem('theme', 'system')
              if ((theme || '') === (startThemeRef.current || '')) setTheme('system')
            }
          }
        } catch {}

        // Prefer theme from settings context if already loaded to avoid extra fetches
        let userTheme: string | null = settings?.theme || null
        if (!userTheme) {
          const response = await fetch("/api/settings/preferences", { credentials: "include" })
          if (response.ok) {
            const data = await response.json()
            userTheme = data.preferences?.theme || "system"
          }
        }
        if (!initialized && userTheme) {
          if ((theme || "") === (startThemeRef.current || "")) {
            setTimeout(() => setTheme(userTheme), 50)
          }
          setInitialized(true)
          lastThemeRef.current = userTheme
          try { if (userId) localStorage.setItem('lastThemeUser', userId) } catch {}
        }
      } catch (error) {
        console.error("Failed to fetch user theme:", error)
      }
    }

    fetchUserTheme()
  }, [setTheme, initialized, theme, loading, settings])

  // DON'T auto-save theme changes to database
  // Theme is only saved when user clicks "Save Preferences" button
  useEffect(() => {
    if (initialized && theme) {
      lastThemeRef.current = theme
    }
  }, [theme, initialized])

  return null
}







