"use client"

import type { ReactNode } from "react"
import { useEffect, useState } from "react"
import { SettingsProvider } from "@/lib/settings-context"
import { ThemeSync } from "@/components/theme-sync"
import { AuthProvider } from "@/lib/auth-context"
import { AuthenticatedProviders } from "@/components/authenticated-providers"

export function RootProviders({ children }: { children: ReactNode }) {
  const [hasSession, setHasSession] = useState<boolean>(false)
  useEffect(() => {
    try {
      const has = /(?:^|;\s)(session=|session_dev=)/.test(document.cookie)
      setHasSession(has)
    } catch {
      setHasSession(false)
    }
  }, [])

  if (!hasSession) {
    return (
      <AuthProvider>
        {children}
      </AuthProvider>
    )
  }

  return (
    <SettingsProvider>
      <ThemeSync />
      <AuthProvider>
        <AuthenticatedProviders>{children}</AuthenticatedProviders>
      </AuthProvider>
    </SettingsProvider>
  )
}