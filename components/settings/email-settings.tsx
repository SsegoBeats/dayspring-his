"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { CheckCircle, Mail, AlertCircle, Clock } from "lucide-react"
import { toast } from "sonner"
import { useAuth } from "@/lib/auth-context"

export function EmailSettings() {
  const { refreshUser } = useAuth()
  const [email, setEmail] = useState("")
  const [originalEmail, setOriginalEmail] = useState("") // Track original email from DB
  const [verified, setVerified] = useState<boolean | null>(null)
  const [sending, setSending] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [otp, setOtp] = useState("")
  const [showOtpInput, setShowOtpInput] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)
  const [serverMessage, setServerMessage] = useState<string | null>(null)

  useEffect(() => {
    ;(async () => {
      try {
        await fetch("/api/csrf", { credentials: "include" })
        const r = await fetch("/api/auth/me", { credentials: "include" })
        if (r.ok) {
          const d = await r.json()
          setEmail(d.user?.email || "")
          setOriginalEmail(d.user?.email || "") // Store the original email
          setVerified(!!d.user?.email_verified_at)
        }
      } catch {}
    })()
  }, [])

  // Countdown timer for resend
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000)
      return () => clearTimeout(timer)
    } else if (resendCooldown === 0 && showOtpInput && process.env.NODE_ENV === "development") {
      console.log("[OTP Frontend] Resend cooldown completed")
    }
  }, [resendCooldown, showOtpInput])

  const normalizedOriginalEmail = originalEmail.trim().toLowerCase()
  const normalizedCurrentEmail = email.trim().toLowerCase()
  const isPendingEmailChange = verified === true && normalizedCurrentEmail !== normalizedOriginalEmail

  const resetOtpFlow = () => {
    setShowOtpInput(false)
    setOtp("")
    setServerMessage(null)
    setResendCooldown(0)
  }

  const sendOtp = async () => {
    if (process.env.NODE_ENV === "development") console.log("[OTP Frontend] Requesting OTP")
    setSending(true)
    try {
      const r = await fetch("/api/settings/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email }),
      })
      
      const d = await r.json().catch(() => ({}))
      if (r.ok) {
        setServerMessage(d?.message || `Verification code sent to ${email}`)
        toast.success(d?.message || `Verification code sent to ${email}`)
        setShowOtpInput(true)
        setResendCooldown(60) // 60 second cooldown
        console.log("[OTP Frontend] OTP sent successfully, cooldown started (60 seconds)")
      } else {
        setServerMessage(null)
        toast.error(d.error || "Failed to send verification code")
        if (process.env.NODE_ENV === "development") console.error("[OTP Frontend] Failed:", d.error)
      }
    } catch (error) {
      toast.error("Failed to send verification code")
      if (process.env.NODE_ENV === "development") console.error("[OTP Frontend] Exception:", error)
    } finally {
      setSending(false)
    }
  }

  const verifyOtp = async () => {
    if (process.env.NODE_ENV === "development") console.log("[OTP Frontend] Verifying code (value never logged)")
    setVerifying(true)
    try {
      const r = await fetch("/api/settings/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ otp }),
      })
      
      if (r.ok) {
        toast.success("Email verified successfully!")
        setServerMessage(null)
        resetOtpFlow()
        setVerified(true)
        // Refresh user data to get updated email and verification status
        const me = await fetch("/api/auth/me", { credentials: "include" })
        if (me.ok) {
          const data = await me.json()
          setEmail(data.user?.email || "")
          setOriginalEmail(data.user?.email || "") // Update original email after verification
          setVerified(!!data.user?.email_verified_at)
        }
        await refreshUser()
      } else {
        const d = await r.json().catch(() => ({}))
        setServerMessage(d?.error || null)
        if (process.env.NODE_ENV === "development") console.error("[OTP Frontend] Verification failed:", d.error)
        toast.error(d.error || "Invalid verification code")
      }
    } catch (error) {
      if (process.env.NODE_ENV === "development") console.error("[OTP Frontend] Exception:", error)
      toast.error("Failed to verify code")
    } finally {
      setVerifying(false)
    }
  }

  return (
    <Card className="overflow-hidden rounded-[28px] border-sky-100/80 bg-white/90 shadow-[0_28px_80px_-54px_rgba(14,116,144,0.48)] backdrop-blur">
      <CardHeader className="border-b border-sky-100/70 bg-[linear-gradient(180deg,rgba(239,246,255,0.95),rgba(255,255,255,0.92))]">
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5 text-blue-600" />
          Account Email
        </CardTitle>
        <CardDescription>
          {verified === true && !isPendingEmailChange
            ? `Current verified email: ${originalEmail}`
            : isPendingEmailChange
              ? `Verify ${email} to replace your current login email ${originalEmail}.`
              : verified === false 
              ? `Change your login email. A 6-digit verification code will be sent.`
              : "Loading email status..."
          }
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5 p-6">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input 
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            value={email} 
            onChange={(e) => setEmail(e.target.value)} 
            required 
            className="h-12 w-full rounded-2xl border-slate-200 bg-white/95"
            disabled={showOtpInput}
          />
          <div className="flex items-center gap-2">
            {verified === false && (
              <Badge variant="outline" className="text-amber-600 border-amber-200">
                <AlertCircle className="h-3 w-3 mr-1" />
                Unverified
              </Badge>
            )}
            {verified === true && !isPendingEmailChange && (
              <Badge variant="outline" className="text-green-600 border-green-200">
                <CheckCircle className="h-3 w-3 mr-1" />
                Verified
              </Badge>
            )}
            {isPendingEmailChange && (
              <Badge variant="outline" className="border-amber-200 text-amber-600">
                <AlertCircle className="h-3 w-3 mr-1" />
                Verification Required
              </Badge>
            )}
          </div>
          
          {/* Show info message when button is disabled for verified email */}
          {verified === true && email === originalEmail && (
            <p className="text-sm text-muted-foreground italic">
              Email is verified. Enter a new email address to change it.
            </p>
          )}
        </div>

        {showOtpInput && (
          <div className="space-y-2">
            <Label htmlFor="otp">Verification Code</Label>
            <Input 
              id="otp"
              name="otp"
              type="text"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="Enter 6-digit code"
              className="h-12 w-full rounded-2xl border-slate-200 bg-white/95 text-center text-lg tracking-widest"
              maxLength={6}
            />
            <p className="text-sm text-muted-foreground">
              Enter the 6-digit code sent to {email}
            </p>
            {serverMessage && (
              <p className="text-sm text-blue-700">{serverMessage}</p>
            )}
          </div>
        )}

        <div className="flex flex-col gap-2 sm:flex-row">
          {!showOtpInput ? (
            <Button 
              onClick={sendOtp}
              disabled={sending || !email || (verified && email === originalEmail)}
              className="w-full rounded-2xl sm:flex-1"
            >
              {sending ? "Sending..." : "Send Verification Code"}
            </Button>
          ) : (
            <>
              <Button 
                onClick={verifyOtp}
                disabled={verifying || otp.length !== 6}
                className="w-full rounded-2xl sm:flex-1"
              >
                {verifying ? "Verifying..." : "Verify Code"}
              </Button>
              <Button 
                variant="outline"
                onClick={sendOtp}
                disabled={resendCooldown > 0 || sending}
                className="rounded-2xl px-4"
              >
                {resendCooldown > 0 ? (
                  <>
                    <Clock className="h-4 w-4 mr-1" />
                    {resendCooldown}s
                  </>
                ) : (
                  "Resend"
                )}
              </Button>
              <Button
                variant="ghost"
                onClick={resetOtpFlow}
                className="rounded-2xl px-4"
              >
                Change Email
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
