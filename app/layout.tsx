import type React from "react"
import type { Metadata } from "next"
import localFont from "next/font/local"
import { Analytics } from "@vercel/analytics/next"
import { Toaster } from "sonner"
import { AuthProvider } from "@/lib/auth-context"
import { PatientProvider } from "@/lib/patient-context"
import { MedicalProvider } from "@/lib/medical-context"
import { PharmacyProvider } from "@/lib/pharmacy-context"
import { BillingProvider } from "@/lib/billing-context"
import { NursingProvider } from "@/lib/nursing-context"
import { AdminProvider } from "@/lib/admin-context"
import { AnalyticsProvider } from "@/lib/analytics-context"
import { AuditProvider } from "@/lib/audit-context"
import { ThemeProvider } from "@/components/theme-provider"
import { ThemeSync } from "@/components/theme-sync"
import { SettingsProvider } from "@/lib/settings-context"
import { RootProviders } from "@/components/root-providers"
import { AuthenticatedProviders } from "@/components/authenticated-providers"
import "./globals.css"

const geist = localFont({
  src: "./fonts/Geist-400.ttf",
  variable: "--font-geist",
  display: "swap",
})

const geistMono = localFont({
  src: "./fonts/GeistMono-400.ttf",
  variable: "--font-geist-mono",
  display: "swap",
})

export const metadata: Metadata = {
  title: "Dayspring Medical Center - HIS",
  description: "Hospital Information System for Dayspring Medical Center",
  generator: "v0.app",
  manifest: "/manifest.webmanifest",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${geist.variable} ${geistMono.variable}`}>
      <body className={`font-sans antialiased ${geist.className}`} suppressHydrationWarning>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <RootProviders>
            {children}
          </RootProviders>
        </ThemeProvider>
        <script dangerouslySetInnerHTML={{ __html: `
          if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
              navigator.serviceWorker.register('/sw.js');
            });
          }
          // Suppress Vercel Analytics debug logs in console
          if (typeof console !== 'undefined') {
            const originalLog = console.log;
            console.log = function(...args) {
              if (args[0] && typeof args[0] === 'string' && args[0].includes('[Vercel Web Analytics]')) {
                return;
              }
              originalLog.apply(console, args);
            };
          }
        `}} />
        <Analytics />
        <Toaster position="top-right" richColors />
      </body>
    </html>
  )
}
















