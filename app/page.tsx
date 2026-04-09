"use client"

/**
 * Login page: User settings (theme, locale, currency, etc.) must NOT affect this page.
 * The login page always uses system defaults for appearance and layout.
 */
import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { LoginForm } from "@/components/login-form"
import Image from "next/image"
import { ORG_NAME, ORG_LOGO_PATH, ORG_SUBTITLE, ORG_ADDRESS } from "@/lib/org-constants"
import { Shield, Users, Activity, ClipboardList } from "lucide-react"

const features = [
  { icon: Shield,        title: "Secure Access",   desc: "Role-based authentication" },
  { icon: Users,         title: "Multi-Role",      desc: "10+ clinical roles supported" },
  { icon: Activity,      title: "Real-time Data",  desc: "Live patient records & updates" },
  { icon: ClipboardList, title: "Full Records",    desc: "Complete medical histories" },
]

function SystemLoader() {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-background">
      <div className="ds-loader mb-8">
        <div className="ds-loader__ring" />
        <div className="ds-loader__ring" />
        <div className="ds-loader__ring" />
        <div className="ds-loader__dot" />
      </div>
      <p className="text-sm font-semibold text-foreground tracking-wide">{ORG_NAME}</p>
      <p className="text-xs text-muted-foreground mt-1">Loading, please wait…</p>
    </div>
  )
}

export default function HomePage() {
  const { user, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (isLoading) return
    if (user) router.replace("/dashboard")
  }, [user, isLoading, router])

  if (isLoading) return <SystemLoader />

  return (
    <div className="min-h-screen flex">

      {/* ── Left panel — desktop only ─────────────────────────────────────── */}
      <div
        className="hidden lg:flex lg:w-[54%] relative overflow-hidden flex-col items-center justify-center p-14"
        style={{
          background:
            "linear-gradient(145deg, oklch(0.25 0.17 245) 0%, oklch(0.38 0.19 242) 45%, oklch(0.50 0.17 232) 100%)",
        }}
      >
        {/* Subtle grid overlay */}
        <div className="absolute inset-0 login-panel-grid" />
        {/* Aurora depth layer */}
        <div className="login-aurora" />

        {/* Decorative blobs */}
        <div
          className="absolute -top-40 -left-40 w-[560px] h-[560px] rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(255,255,255,0.07) 0%, transparent 65%)" }}
        />
        <div
          className="absolute -bottom-28 -right-28 w-[420px] h-[420px] rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(255,255,255,0.05) 0%, transparent 65%)" }}
        />
        <div
          className="absolute top-1/2 -right-10 w-[200px] h-[200px] rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(255,255,255,0.04) 0%, transparent 65%)" }}
        />

        {/* Content */}
        <div className="relative z-10 flex flex-col items-center text-center text-white max-w-sm w-full">

          {/* Logo — frameless, floating with halo rings */}
          <div className="relative mb-10 flex items-center justify-center w-[280px] h-[280px]">
            <div className="ds-logo-halo-ring ds-logo-halo-ring--1" />
            <div className="ds-logo-halo-ring ds-logo-halo-ring--2" />
            <div className="ds-logo-halo-ring ds-logo-halo-ring--3" />
            <Image
              src={ORG_LOGO_PATH}
              alt={ORG_NAME}
              width={260}
              height={260}
              className="ds-logo-float relative z-10 h-56 w-auto object-contain"
              priority
            />
          </div>

          <h1 className="text-[1.85rem] font-bold tracking-tight leading-snug login-panel-title">
            {ORG_NAME}
          </h1>
          <p className="text-blue-200/80 text-xs mt-1.5 mb-10 font-semibold tracking-[0.2em] uppercase">
            {ORG_SUBTITLE}
          </p>

          {/* Feature tiles */}
          <div className="grid grid-cols-2 gap-3 w-full">
            {features.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="login-feature-card flex items-start gap-3 p-4 rounded-2xl text-left">
                <div className="mt-0.5 p-1.5 rounded-lg bg-white/10 shrink-0">
                  <Icon className="h-3.5 w-3.5 text-blue-100" />
                </div>
                <div>
                  <p className="font-semibold text-sm text-white leading-tight">{title}</p>
                  <p className="text-blue-300 text-xs mt-0.5">{desc}</p>
                </div>
              </div>
            ))}
          </div>

          <p className="mt-10 text-blue-400 text-xs tracking-widest uppercase">{ORG_ADDRESS}</p>
        </div>
      </div>

      {/* ── Right panel — form ───────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-10 bg-background login-right-panel">

        {/* Mobile logo (hidden on desktop) */}
        <div className="lg:hidden mb-8 text-center">
          <Image
            src={ORG_LOGO_PATH}
            alt={ORG_NAME}
            width={120}
            height={120}
            className="h-24 w-auto object-contain mx-auto mb-3 ds-logo-float-mobile"
            priority
          />
          <h1 className="text-lg font-bold text-foreground">{ORG_NAME}</h1>
          <p className="text-muted-foreground text-sm">{ORG_SUBTITLE}</p>
        </div>

        <div className="w-full max-w-sm">
          {/* Desktop heading */}
          <div className="mb-7 hidden lg:block">
            <h2 className="text-2xl font-bold text-foreground">Welcome back</h2>
            <p className="text-muted-foreground text-sm mt-1">
              Sign in to access your workspace
            </p>
          </div>

          <LoginForm />

          <p className="mt-6 text-center text-xs text-muted-foreground">
            Protected by end-to-end encryption · Dayspring HIS
          </p>
        </div>
      </div>

    </div>
  )
}
