"use client"

import type { ReactNode } from "react"
import { useEffect } from "react"
import { SettingsProvider } from "@/lib/settings-context"
import { ThemeSync } from "@/components/theme-sync"
import { AuthProvider } from "@/lib/auth-context"
import { AuthenticatedProviders } from "@/components/authenticated-providers"

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"])

function CsrfFetchInterceptor() {
  useEffect(() => {
    const originalFetch = window.fetch
    window.fetch = function (input, init) {
      const method = (init?.method ?? "GET").toUpperCase()
      if (!SAFE_METHODS.has(method)) {
        const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : (input as Request).url
        if (url.startsWith("/api/") || url.includes("/api/")) {
          const csrf = (document.cookie.split(";").find((c) => c.trim().startsWith("csrfToken=")) ?? "").split("=")[1] ?? ""
          if (csrf) {
            const headers = new Headers(init?.headers)
            if (!headers.has("x-csrf-token")) headers.set("x-csrf-token", csrf)
            init = { ...init, headers }
          }
        }
      }
      return originalFetch.call(this, input, init)
    }
    return () => { window.fetch = originalFetch }
  }, [])
  return null
}

export function RootProviders({ children }: { children: ReactNode }) {
  return (
    <SettingsProvider>
      <CsrfFetchInterceptor />
      <ThemeSync />
      <AuthProvider>
        <AuthenticatedProviders>{children}</AuthenticatedProviders>
      </AuthProvider>
    </SettingsProvider>
  )
}
