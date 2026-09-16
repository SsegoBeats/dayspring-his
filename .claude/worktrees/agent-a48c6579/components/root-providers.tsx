"use client"

import type { ReactNode } from "react"
import { SettingsProvider } from "@/lib/settings-context"
import { ThemeSync } from "@/components/theme-sync"
import { AuthProvider } from "@/lib/auth-context"
import { AuthenticatedProviders } from "@/components/authenticated-providers"

export function RootProviders({ children }: { children: ReactNode }) {
  return (
    <SettingsProvider>
      <ThemeSync />
      <AuthProvider>
        <AuthenticatedProviders>{children}</AuthenticatedProviders>
      </AuthProvider>
    </SettingsProvider>
  )
}
