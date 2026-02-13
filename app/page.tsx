"use client"

/**
 * Login page: User settings (theme, locale, currency, etc.) must NOT affect this page.
 * The login page always uses system defaults for appearance and layout.
 */
import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { LoginForm } from "@/components/login-form"

export default function HomePage() {
  const { user, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (isLoading) return
    if (user) {
      router.replace("/dashboard")
    }
  }, [user, isLoading, router])

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-secondary/30 p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mb-6 flex justify-center">
            <img 
              src="/logo0.png" 
              alt="Dayspring Medical Center Logo" 
              className="h-48 w-auto object-contain sm:h-56"
            />
          </div>
          <h1 className="text-balance text-3xl font-bold tracking-tight text-foreground">Dayspring Medical Center</h1>
          <p className="mt-2 text-muted-foreground">Hospital Information System</p>
        </div>
        <LoginForm />
      </div>
    </div>
  )
}
