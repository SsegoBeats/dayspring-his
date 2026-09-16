"use client"

import { useMemo, useState } from "react"
import { useBilling } from "@/lib/billing-context"
import { useFormatCurrency } from "@/lib/settings-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Clock, RotateCcw } from "lucide-react"

const SHIFT_KEY = "cashier_shift_start"

function getOrInitShiftStart(): string {
  if (typeof window === "undefined") return new Date().toISOString()
  const stored = sessionStorage.getItem(SHIFT_KEY)
  if (stored) return stored
  const now = new Date().toISOString()
  sessionStorage.setItem(SHIFT_KEY, now)
  return now
}

export function ShiftSummary() {
  const { bills } = useBilling()
  const formatCurrency = useFormatCurrency()
  const [shiftStart, setShiftStart] = useState<string>(() => getOrInitShiftStart())

  const todayLocal =
    typeof Intl !== "undefined"
      ? new Date().toLocaleDateString("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" })
      : new Date().toISOString().slice(0, 10)

  const shiftStartTime = useMemo(() => {
    try {
      return new Date(shiftStart).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    } catch {
      return "--:--"
    }
  }, [shiftStart])

  // Use today's paid bills as a proxy for the shift — shifts are intra-day
  const shiftBills = useMemo(
    () => bills.filter((b) => b.status === "paid" && b.paymentDate === todayLocal),
    [bills, todayLocal],
  )

  const shiftTotal = useMemo(
    () => shiftBills.reduce((sum, b) => sum + (b.paidAmount || b.total), 0),
    [shiftBills],
  )

  const byMethod = useMemo(() => {
    const acc: Record<string, number> = {}
    for (const b of shiftBills) {
      const method = b.paymentMethod || "Unspecified"
      acc[method] = (acc[method] || 0) + (b.paidAmount || b.total)
    }
    return Object.entries(acc).sort(([, a], [, b]) => b - a)
  }, [shiftBills])

  const handleNewShift = () => {
    const now = new Date().toISOString()
    sessionStorage.setItem(SHIFT_KEY, now)
    setShiftStart(now)
  }

  return (
    <Card className="border-emerald-100 bg-white/95 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="h-4 w-4 text-emerald-600" />
            Shift Summary
          </CardTitle>
          <CardDescription>Shift started at {shiftStartTime} · today&apos;s collections</CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={handleNewShift} className="shrink-0 gap-1.5">
          <RotateCcw className="h-3.5 w-3.5" />
          New Shift
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-4">
            <div className="text-xs font-semibold uppercase tracking-widest text-emerald-700">Total Collected</div>
            <div className="mt-2 text-2xl font-semibold text-foreground">{formatCurrency(shiftTotal)}</div>
            <div className="mt-1 text-xs text-muted-foreground">
              {shiftBills.length} invoice{shiftBills.length !== 1 ? "s" : ""} settled today
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
            <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">By Method</div>
            {byMethod.length === 0 ? (
              <div className="mt-2 text-sm text-muted-foreground">No payments recorded yet</div>
            ) : (
              <div className="mt-2 space-y-1.5">
                {byMethod.map(([method, amount]) => (
                  <div key={method} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{method}</span>
                    <span className="font-medium text-foreground">{formatCurrency(amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
