"use client"

import { ReactNode } from "react"
import { Badge } from "@/components/ui/badge"
import { useAuth } from "@/lib/auth-context"
import { Sparkles, ShieldCheck, SlidersHorizontal } from "lucide-react"

interface SettingsLayoutProps {
  children: ReactNode
  title: string
  description: string
  icon: ReactNode
}

interface SettingsColumnsProps {
  primary: ReactNode
  secondary: ReactNode
}

export function SettingsColumns({ primary, secondary }: SettingsColumnsProps) {
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.18fr)_minmax(320px,0.82fr)]">
      <div className="space-y-6">{primary}</div>
      <div className="space-y-6">{secondary}</div>
    </div>
  )
}

export function SettingsLayout({ children, title, description, icon }: SettingsLayoutProps) {
  const { user } = useAuth()
  const normalizedRole = user?.role || "Portal User"

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-8 px-4 pb-10 pt-4 sm:px-6 xl:px-10">
      <section className="relative overflow-hidden rounded-[32px] border border-sky-100/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.94),rgba(240,249,255,0.92)_45%,rgba(255,247,237,0.94))] p-6 shadow-[0_28px_90px_-48px_rgba(14,116,144,0.55)] backdrop-blur xl:p-8">
        <div className="pointer-events-none absolute inset-y-0 right-0 w-[42%] bg-[radial-gradient(circle_at_top,rgba(14,165,233,0.18),transparent_58%),radial-gradient(circle_at_bottom,rgba(249,115,22,0.14),transparent_52%)]" />
        <div className="relative grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_320px] xl:items-start">
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-3">
              <Badge className="rounded-full border-0 bg-slate-950 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.28em] text-white shadow-sm">
                Settings Workspace
              </Badge>
              <Badge variant="outline" className="rounded-full border-sky-200 bg-white/80 px-3 py-1 text-sky-700">
                {normalizedRole}
              </Badge>
            </div>
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[20px] bg-[linear-gradient(135deg,#0f172a,#2563eb)] text-white shadow-[0_16px_40px_-20px_rgba(37,99,235,0.85)]">
                {icon}
              </div>
              <div className="space-y-2">
                <h1 className="text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">{title}</h1>
                <p className="max-w-3xl text-sm leading-6 text-slate-600 sm:text-base">{description}</p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-[22px] border border-white/70 bg-white/75 p-4 shadow-[0_18px_45px_-30px_rgba(15,23,42,0.45)] backdrop-blur">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
                  <ShieldCheck className="h-4 w-4 text-emerald-600" />
                  Secure by default
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Profile, password, email verification, and notification controls stay scoped to the signed-in user.
                </p>
              </div>
              <div className="rounded-[22px] border border-white/70 bg-white/75 p-4 shadow-[0_18px_45px_-30px_rgba(15,23,42,0.45)] backdrop-blur">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
                  <SlidersHorizontal className="h-4 w-4 text-sky-600" />
                  Wide two-column flow
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Related controls are grouped together so the page feels intentional instead of like a stacked form dump.
                </p>
              </div>
              <div className="rounded-[22px] border border-white/70 bg-white/75 p-4 shadow-[0_18px_45px_-30px_rgba(15,23,42,0.45)] backdrop-blur">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
                  <Sparkles className="h-4 w-4 text-amber-500" />
                  Live portal behavior
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Save actions still hit the same APIs and role-based routing remains unchanged across every portal.
                </p>
              </div>
            </div>
          </div>
          <div className="rounded-[28px] border border-white/75 bg-white/85 p-5 shadow-[0_22px_55px_-36px_rgba(15,23,42,0.55)] backdrop-blur">
            <div className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">Workspace notes</div>
            <div className="mt-4 space-y-4">
              <div className="rounded-2xl bg-slate-950 px-4 py-4 text-white">
                <div className="text-sm font-medium">Account &amp; preferences</div>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  Update profile, email, password, notifications, and portal defaults from one place.
                </p>
              </div>
              <div className="space-y-3 text-sm leading-6 text-slate-600">
                <p>Use the left column for identity and portal behavior, then the right column for security and delivery settings.</p>
                <p>Admins also get organization-wide currency controls without changing the rest of the account flow.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section>{children}</section>
    </div>
  )
}
