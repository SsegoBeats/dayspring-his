"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth, type UserRole } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Eye, EyeOff, AlertCircle, Mail } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
 

const roles: { value: UserRole; label: string }[] = [
  { value: "Receptionist", label: "Receptionist" },
  { value: "Doctor", label: "Clinician" },
  { value: "Midwife", label: "Midwifery" },
  { value: "Dentist", label: "Dentist" },
  { value: "Radiologist", label: "Radiologist" },
  { value: "Nurse", label: "Nurse" },
  { value: "Lab Tech", label: "Lab Technician" },
  { value: "Hospital Admin", label: "Hospital Admin" },
  { value: "Cashier", label: "Cashier" },
  { value: "Pharmacist", label: "Pharmacist" },
]

export function LoginForm() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [role, setRole] = useState<UserRole>("Receptionist")
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [isAccountInactive, setIsAccountInactive] = useState(false)
  const { login } = useAuth()
  const router = useRouter()
 

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsAccountInactive(false)
    setIsLoading(true)

    try {
      const result = await login(email, password, role)
      if (!result.success) {
        // Check if this is an account deactivation error
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
    } catch (err) {
      setError("An error occurred. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sign In</CardTitle>
        <CardDescription>Enter your credentials to access the system</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="your.email@dayspring.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="pr-10"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <Select name="role" value={role} onValueChange={(value) => setRole(value as UserRole)}>
              <SelectTrigger id="role" aria-label="Role" autoComplete="off">
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
          {error && (
            <>
              {isAccountInactive ? (
                <Alert className="border-amber-200 bg-amber-50">
                  <AlertCircle className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="text-amber-800">
                    <div className="space-y-3">
                      <div>
                        <strong>Account Deactivated</strong>
                        <p className="text-sm mt-1">
                          Your account has been temporarily deactivated. This may be due to administrative action or security measures.
                        </p>
                      </div>
                      <div className="text-sm">
                        <p className="font-medium mb-2">To restore access, please contact the Hospital Admin:</p>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Mail className="h-3 w-3" />
                            <span>carolynemirey@gmail.com</span>
                          </div>
                        </div>
                        <p className="text-xs mt-2 text-amber-700">
                          Include your email address and role when contacting support.
                        </p>
                      </div>
                    </div>
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
              )}
            </>
          )}
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? "Signing in..." : "Sign In"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

