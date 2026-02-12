"use client"

import { useEffect, useState, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CheckCircle, Loader2, XCircle, ArrowRight } from "lucide-react"
import Link from "next/link"

function PaymentCompleteContent() {
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
        const res = await fetch(
          `/api/pesapal/status?orderTrackingId=${encodeURIComponent(orderTrackingId)}`,
          { credentials: "include" }
        )
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
    return () => {
      cancelled = true
    }
  }, [orderTrackingId])

  if (!orderTrackingId || !merchantRef) {
    return (
      <Card className="w-full max-w-md border-amber-200/60 bg-amber-50/30 dark:border-amber-800/40 dark:bg-amber-950/20">
        <CardHeader>
          <CardTitle>Invalid callback</CardTitle>
          <CardDescription>
            Missing payment parameters. Return to the cashier dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild className="gap-2">
            <Link href="/cashier">
              Back to Cashier
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  const isCompleted = status?.payment_status_description === "COMPLETED" && status?.status_code === 1
  const isFailed = status?.payment_status_description === "FAILED" || status?.status_code === 2

  return (
    <Card className="w-full max-w-md overflow-hidden border-0 shadow-lg">
      <div
        className={`h-2 ${isCompleted ? "bg-emerald-500" : isFailed ? "bg-red-500" : "bg-muted"}`}
      />
      <CardHeader className="pb-2">
        <CardTitle>
          {loading ? "Checking payment..." : "Payment status"}
        </CardTitle>
        <CardDescription>
          {loading
            ? "Verifying your payment with the provider..."
            : isCompleted
              ? "Your payment was received successfully."
              : isFailed
                ? "The payment could not be completed."
                : `Status: ${status?.payment_status_description || "Pending"}`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {loading && (
          <div className="flex items-center justify-center gap-2 py-6 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span>Verifying payment...</span>
          </div>
        )}

        {!loading && status && (
          <div
            className={`flex items-center justify-center gap-3 rounded-lg py-6 ${
              isCompleted
                ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200"
                : isFailed
                  ? "bg-red-50 text-red-800 dark:bg-red-950/30 dark:text-red-200"
                  : "bg-muted/50 text-muted-foreground"
            }`}
          >
            {isCompleted && (
              <>
                <CheckCircle className="h-10 w-10 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span className="text-lg font-semibold">Payment successful</span>
              </>
            )}
            {isFailed && (
              <>
                <XCircle className="h-10 w-10 shrink-0 text-red-600 dark:text-red-400" />
                <span className="text-lg font-semibold">Payment failed</span>
              </>
            )}
            {!isCompleted && !isFailed && (
              <span className="font-medium">
                {status.payment_status_description || "Pending"}
              </span>
            )}
          </div>
        )}

        <Button asChild className="w-full gap-2">
          <Link href="/cashier">
            Back to Cashier Dashboard
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  )
}

export default function PaymentCompletePage() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Suspense
          fallback={
            <Card className="border-border/60">
              <CardContent className="flex items-center justify-center py-16">
                <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
              </CardContent>
            </Card>
          }
        >
          <PaymentCompleteContent />
        </Suspense>
      </div>
    </div>
  )
}
