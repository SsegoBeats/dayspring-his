"use client"

import type React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth, type UserRole } from "@/lib/auth-context"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Eye, EyeOff, AlertCircle, Mail, ChevronDown } from "lucide-react"
import { Spinner } from "@/components/ui/spinner"

const roles: { value: UserRole; label: string }[] = [
  { value: "Receptionist",  label: "Receptionist" },
  { value: "Clinician",     label: "Clinician" },
  { value: "Midwife",       label: "Midwifery" },
  { value: "Dentist",       label: "Dentist" },
  { value: "Radiologist",   label: "Radiologist" },
  { value: "Nurse",         label: "Nurse" },
  { value: "Lab Tech",      label: "Lab Technician" },
  { value: "Hospital Admin",label: "Hospital Admin" },
  { value: "Cashier",       label: "Cashier" },
  { value: "Pharmacist",    label: "Pharmacist" },
]

export function LoginForm() {
  const [email,           setEmail]           = useState("")
  const [password,        setPassword]        = useState("")
  const [role,            setRole]            = useState<UserRole>("Receptionist")
  const [error,           setError]           = useState("")
  const [isLoading,       setIsLoading]       = useState(false)
  const [showPassword,    setShowPassword]    = useState(false)
  const [isAccountInactive, setIsAccountInactive] = useState(false)
  const { login } = useAuth()
  const router    = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsAccountInactive(false)
    setIsLoading(true)

    try {
      const result = await login(email, password, role)
      if (!result.success) {
        if (result.error?.includes("deactivated") || result.error?.includes("Account Deactivated")) {
          setIsAccountInactive(true)
        }
        setError(result.error || "Invalid credentials. Please check your email, password, and role selection.")
      } else {
        if (typeof window !== "undefined") {
          window.location.assign("/dashboard")
        } else {
          router.push("/dashboard")
        }
      }
    } catch {
      setError("An error occurred. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="login-form-card p-7">
      <div className="mb-6">
        <h3 className="text-lg font-bold text-foreground">Sign In</h3>
        <p className="text-muted-foreground text-sm mt-0.5">Enter your credentials to continue</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">

        {/* Email */}
        <div className="space-y-1.5">
          <label htmlFor="email" className="block text-sm font-medium text-foreground">
            Email address
          </label>
          <input
            id="email"
            name="email"
            type="email"
            placeholder="your.email@dayspring.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            className="login-input-field w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/15 focus:outline-none transition-all"
          />
        </div>

        {/* Password */}
        <div className="space-y-1.5">
          <label htmlFor="password" className="block text-sm font-medium text-foreground">
            Password
          </label>
          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="login-input-field w-full rounded-lg border border-input bg-background px-3.5 py-2.5 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/15 focus:outline-none transition-all"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword
                ? <EyeOff className="h-4 w-4" />
                : <Eye    className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Role */}
        <div className="space-y-1.5">
          <label htmlFor="role" className="block text-sm font-medium text-foreground">
            Role
          </label>
          <Select name="role" value={role} onValueChange={(v) => setRole(v as UserRole)}>
            <SelectTrigger
              id="role"
              aria-label="Role"
              className="login-input-field w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm text-foreground focus:border-primary focus:ring-2 focus:ring-primary/15 focus:outline-none transition-all h-auto"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {roles.map((r) => (
                <SelectItem key={r.value} value={r.value}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Error states */}
        {error && (
          isAccountInactive ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/40">
              <div className="flex gap-2.5">
                <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                <div className="space-y-2">
                  <p className="font-semibold text-sm text-amber-800 dark:text-amber-200">Account Deactivated</p>
                  <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
                    Your account has been temporarily deactivated. Contact the Hospital Admin to restore access.
                  </p>
                  <div className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-300">
                    <Mail className="h-3 w-3" />
                    <span>carolynemirey@gmail.com</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-destructive/20 bg-destructive/8 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={isLoading}
          className="w-full flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-all focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-60 disabled:cursor-not-allowed"
          style={{
            background: isLoading
              ? "oklch(0.55 0.15 240 / 0.7)"
              : "linear-gradient(135deg, oklch(0.50 0.17 245), oklch(0.58 0.15 232))",
            boxShadow: isLoading ? "none" : "0 2px 12px oklch(0.55 0.15 240 / 0.35)",
          }}
        >
          {isLoading && <Spinner className="size-4 text-white" />}
          {isLoading ? "Signing in…" : "Sign In"}
        </button>

      </form>
    </div>
  )
}
