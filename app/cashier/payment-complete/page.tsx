"use client"

import { useEffect, useState, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CheckCircle, Loader2, XCircle } from "lucide-react"
import Link from "next/link"

function PaymentCompleteContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const orderTrackingId = searchParams.get("OrderTrackingId")
  const merchantRef = searchParams.get("OrderMerchantReference")
  const [status, setStatus] = useState<{
    payment_status_description?: string
    status_code?: number
  } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!orderTrackingId) {
      setLoading(false)
      return
    }
    let cancelled = false
    const check = async () => {
      try {
        const res = await fetch(`/api/pesapal/status?orderTrackingId=${encodeURIComponent(orderTrackingId)}`, {
          credentials: "include",
        })
        if (cancelled) return
        if (res.ok) {
          const data = await res.json()
          setStatus(data)
        } else if (res.status === 401) {
          setStatus({ payment_status_description: "PENDING", status_code: -1 })
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    check()
    return () => { cancelled = true }
  }, [orderTrackingId])

  if (!orderTrackingId || !merchantRef) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Invalid callback</CardTitle>
          <CardDescription>Missing payment parameters. Return to the cashier dashboard.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link href="/cashier">Back to Cashier</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  const isCompleted = status?.payment_status_description === "COMPLETED" && status?.status_code === 1
  const isFailed = status?.payment_status_description === "FAILED" || status?.status_code === 2

  return (
    <Card>
      <CardHeader>
        <CardTitle>Payment processing</CardTitle>
        <CardDescription>
          {loading ? "Checking payment status..." : "Your payment has been received."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Verifying payment...
          </div>
        )}
        {!loading && status && (
          <div className="flex items-center gap-2">
            {isCompleted && (
              <>
                <CheckCircle className="h-8 w-8 text-green-600" />
                <span className="font-medium text-green-700">Payment successful</span>
              </>
            )}
            {isFailed && (
              <>
                <XCircle className="h-8 w-8 text-red-600" />
                <span className="font-medium text-red-700">Payment failed</span>
              </>
            )}
            {!isCompleted && !isFailed && (
              <span className="text-muted-foreground">
                Status: {status.payment_status_description || "Pending"}
              </span>
            )}
          </div>
        )}
        <Button asChild>
          <Link href="/cashier">Back to Cashier Dashboard</Link>
        </Button>
      </CardContent>
    </Card>
  )
}

export default function PaymentCompletePage() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Suspense fallback={
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </CardContent>
          </Card>
        }>
          <PaymentCompleteContent />
        </Suspense>
      </div>
    </div>
  )
}
