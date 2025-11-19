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
  const { user } = useAuth()
  const [email, setEmail] = useState("")
  const [originalEmail, setOriginalEmail] = useState("") // Track original email from DB
  const [verified, setVerified] = useState<boolean | null>(null)
  const [sending, setSending] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [otp, setOtp] = useState("")
  const [showOtpInput, setShowOtpInput] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)

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
    } else if (resendCooldown === 0 && showOtpInput) {
      console.log("[OTP Frontend] Resend cooldown completed - resend button is now active")
    }
  }, [resendCooldown, showOtpInput])

  const sendOtp = async () => {
    console.log("[OTP Frontend] Requesting new OTP for:", email)
    setSending(true)
    try {
      const r = await fetch("/api/settings/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email }),
      })
      
      if (r.ok) {
        toast.success("Verification code sent to " + email)
        setShowOtpInput(true)
        setResendCooldown(60) // 60 second cooldown
        console.log("[OTP Frontend] OTP sent successfully, cooldown started (60 seconds)")
      } else {
        const d = await r.json().catch(() => ({}))
        toast.error(d.error || "Failed to send verification code")
        console.error("[OTP Frontend] Failed to send OTP:", d.error)
      }
    } catch (error) {
      toast.error("Failed to send verification code")
      console.error("[OTP Frontend] Exception sending OTP:", error)
    } finally {
      setSending(false)
    }
  }

  const verifyOtp = async () => {
    console.log("[OTP Frontend] Attempting to verify code:", otp)
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
        setShowOtpInput(false)
        setOtp("")
        setVerified(true)
        console.log("[OTP Frontend] Email verified successfully")
        // Refresh user data to get updated email and verification status
        const me = await fetch("/api/auth/me", { credentials: "include" })
        if (me.ok) {
          const data = await me.json()
          setEmail(data.user?.email || "")
          setOriginalEmail(data.user?.email || "") // Update original email after verification
          setVerified(!!data.user?.email_verified_at)
          console.log("[OTP Frontend] Updated email:", data.user?.email, "Verified:", !!data.user?.email_verified_at)
        }
      } else {
        const d = await r.json().catch(() => ({}))
        console.error("[OTP Frontend] Verification failed:", d.error)
        toast.error(d.error || "Invalid verification code")
      }
    } catch (error) {
      console.error("[OTP Frontend] Exception verifying OTP:", error)
      toast.error("Failed to verify code")
    } finally {
      setVerifying(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5 text-blue-600" />
          Account Email
        </CardTitle>
        <CardDescription>
          {verified === true 
            ? `Email verified: ${email}` 
            : verified === false 
              ? `Change your login email. A 6-digit verification code will be sent.`
              : "Loading email status..."
          }
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
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
            className="w-full"
            disabled={showOtpInput}
          />
          <div className="flex items-center gap-2">
            {verified === false && (
              <Badge variant="outline" className="text-amber-600 border-amber-200">
                <AlertCircle className="h-3 w-3 mr-1" />
                Unverified
              </Badge>
            )}
            {verified === true && (
              <Badge variant="outline" className="text-green-600 border-green-200">
                <CheckCircle className="h-3 w-3 mr-1" />
                Verified
              </Badge>
            )}
          </div>
          
          {/* Show info message when button is disabled for verified email */}
          {verified === true && email === originalEmail && (
            <p className="text-sm text-gray-500 italic">
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
              className="w-full text-center text-lg tracking-widest"
              maxLength={6}
            />
            <p className="text-sm text-gray-600">
              Enter the 6-digit code sent to {email}
            </p>
          </div>
        )}

        <div className="flex gap-2">
          {!showOtpInput ? (
            <Button 
              onClick={sendOtp}
              disabled={sending || !email || (verified && email === originalEmail)}
              className="flex-1"
            >
              {sending ? "Sending..." : "Send Verification Code"}
            </Button>
          ) : (
            <>
              <Button 
                onClick={verifyOtp}
                disabled={verifying || otp.length !== 6}
                className="flex-1"
              >
                {verifying ? "Verifying..." : "Verify Code"}
              </Button>
              <Button 
                variant="outline"
                onClick={sendOtp}
                disabled={resendCooldown > 0 || sending}
                className="px-4"
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
            </>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
