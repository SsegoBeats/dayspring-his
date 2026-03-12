"use client"

import { useState, useEffect, useRef } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, Shield, CheckCircle, AlertCircle } from "lucide-react"
import { toast } from "sonner"

interface EmailVerificationModalProps {
  isOpen: boolean
  userName: string
  userEmail: string
}

export function EmailVerificationModal({ isOpen, userName, userEmail }: EmailVerificationModalProps) {
  const [otp, setOtp] = useState("")
  const [verifying, setVerifying] = useState(false)
  const sentOnOpen = useRef(false)

  useEffect(() => {
    if (!isOpen || !userEmail || sentOnOpen.current) return
    sentOnOpen.current = true
    fetch("/api/settings/send-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email: userEmail }),
    })
      .then(async (r) => {
        if (r.ok) {
          toast.success("Verification code sent to your email")
          return
        }
        const d = await r.json().catch(() => ({}))
        sentOnOpen.current = false
        if (d?.reason === "provider_not_configured") {
          toast.error("Email service is not configured on the server")
          return
        }
        if (d?.reason === "smtp_failed") {
          toast.error(d?.providerMessage || "SMTP email delivery failed")
          return
        }
        if (d?.reason === "resend_rejected") {
          toast.error(d?.providerMessage || "Email provider rejected delivery")
          return
        }
        toast.error(d.error || "Failed to send verification code")
      })
      .catch(() => {
        sentOnOpen.current = false
        toast.error("Failed to send verification code")
      })
  }, [isOpen, userEmail])

  const handleVerify = async () => {
    if (otp.length !== 6) {
      toast.error("Please enter a valid 6-digit code")
      return
    }

    setVerifying(true)
    try {
      const res = await fetch("/api/settings/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ otp }),
      })

      if (res.ok) {
        toast.success("Email verified successfully!")
        // Reload the page to get updated user data
        window.location.reload()
      } else {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error || "Invalid verification code")
      }
    } catch (error) {
      console.error("[Email Verification] Exception verifying OTP:", error)
      toast.error("Failed to verify code")
    } finally {
      setVerifying(false)
    }
  }

  const handleResendCode = async () => {
    try {
      const res = await fetch("/api/settings/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: userEmail }),
      })

      if (res.ok) {
        toast.success("Verification code sent to " + userEmail)
      } else {
        const data = await res.json().catch(() => ({}))
        if (data?.reason === "provider_not_configured") {
          toast.error("Email service is not configured on the server")
          return
        }
        if (data?.reason === "smtp_failed") {
          toast.error(data?.providerMessage || "SMTP email delivery failed")
          return
        }
        if (data?.reason === "resend_rejected") {
          toast.error(data?.providerMessage || "Email provider rejected delivery")
          return
        }
        toast.error(data.error || "Failed to resend code")
      }
    } catch (error) {
      console.error("[Email Verification] Exception resending OTP:", error)
      toast.error("Failed to resend code")
    }
  }

  return (
    <Dialog open={isOpen} modal={true} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md" showCloseButton={false} onPointerDownOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-blue-600" />
            Verify Your Email
          </DialogTitle>
          <DialogDescription>
            Hello {userName}, please verify your email address to continue.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-blue-900">Verification Required</p>
                <p className="text-sm text-blue-700 mt-1">
                  A verification code has been sent to your email address. Please check your inbox and enter the 6-digit code below.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="verification-code">Verification Code</Label>
            <Input
              id="verification-code"
              name="verification-code"
              type="text"
              autoComplete="one-time-code"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="Enter 6-digit code"
              className="w-full text-center text-lg tracking-widest"
              maxLength={6}
              disabled={verifying}
            />
            <p className="text-xs text-muted-foreground">
              Check your email inbox for the code
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Button
              onClick={handleVerify}
              disabled={verifying || otp.length !== 6}
              className="w-full"
            >
              {verifying ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Verify Email
                </>
              )}
            </Button>

            <Button
              variant="outline"
              onClick={handleResendCode}
              disabled={verifying}
              className="w-full"
            >
              Resend Code
            </Button>
          </div>

          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
            <p className="text-xs text-amber-800">
              <strong>Note:</strong> The verification code expires in 10 minutes. If you didn&apos;t receive the email, 
              click &quot;Resend Code&quot; or contact your administrator.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

