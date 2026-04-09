"use client"

import { useCallback, useState } from "react"
import { useBilling } from "@/lib/billing-context"
import { usePatients } from "@/lib/patient-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Coins, CreditCard, Loader2, XCircle, AlertTriangle, Printer, Trash } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useFormatCurrency } from "@/lib/settings-context"
import { formatPatientNumber } from "@/lib/patients"
import { ReceiptPrinter } from "@/components/receipt-printer"
import { PaymentSuccessScreen } from "./payment-success-screen"
import { toast } from "sonner"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

type ReceiptState = {
  receiptNumber: string
  amount: number
  method: string
  items: { description: string; quantity: number; unitPrice: number; total: number }[]
  originalTotal?: number
  remainingBalance?: number
  paymentId?: string | null
}

interface ProcessPaymentProps {
  billId: string
  onBack: () => void
}

export function ProcessPayment({ billId, onBack }: ProcessPaymentProps) {
  const formatCurrency = useFormatCurrency()
  const { getBill, updateBill, refreshBills } = useBilling()
  const { getPatient } = usePatients()
  const bill = getBill(billId)
  const patient = bill ? getPatient(bill.patientId) : null
  const invoicePdfUrl = bill ? `/api/billing/${bill.id}/invoice` : undefined

  const [paymentMethod, setPaymentMethod] = useState("")
  const [notes, setNotes] = useState("")
  const [receiptState, setReceiptState] = useState<ReceiptState | null>(null)
  const [processing, setProcessing] = useState(false)
  const [checkingPayment, setCheckingPayment] = useState(false)
  const [paymentType, setPaymentType] = useState<"full" | "partial" | "cancel">("full")
  const [partialAmount, setPartialAmount] = useState<number>(0)
  const [mobileMoneyPhone, setMobileMoneyPhone] = useState("")
  const [awaitingMobileMoney, setAwaitingMobileMoney] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [cashReceived, setCashReceived] = useState<number>(0)
  const [isSplit, setIsSplit] = useState(false)
  const [splitMethod1, setSplitMethod1] = useState("")
  const [splitMethod2, setSplitMethod2] = useState("")
  const [splitAmount1, setSplitAmount1] = useState<number>(0)
  const [splitAmount2, setSplitAmount2] = useState<number>(0)
  const [showSuccessScreen, setShowSuccessScreen] = useState(false)
  const [pendingReceiptState, setPendingReceiptState] = useState<ReceiptState | null>(null)

  const handleSuccessComplete = useCallback(() => {
    if (pendingReceiptState) {
      setReceiptState(pendingReceiptState)
    }
    setShowSuccessScreen(false)
  }, [pendingReceiptState])

  if (!bill) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <p className="text-muted-foreground">Bill not found</p>
          <Button onClick={onBack} className="mt-4">
            Go Back
          </Button>
        </CardContent>
      </Card>
    )
  }

  const isOnlinePayment = paymentMethod === "Mobile Money" || paymentMethod === "Card"
  const currentPaidAmount = bill?.paidAmount || 0
  const currentBalance = Math.max(0, (bill?.total || 0) - currentPaidAmount)
  const amountDue = paymentType === "partial" ? partialAmount : currentBalance

  const formatPaymentMethodLabel = (value?: string | null) => {
    const normalized = String(value || "").toLowerCase()
    if (normalized === "mobile_money") return "Mobile Money"
    if (normalized === "card") return "Card"
    if (normalized === "cash") return "Cash"
    if (normalized === "bank") return "Bank"
    return value || "N/A"
  }

  const buildReceiptItems = (transactionAmount: number) => {
    const shouldUseBillBreakdown =
      paymentType === "full" &&
      currentPaidAmount <= 0 &&
      Math.abs(transactionAmount - bill.total) < 0.01

    if (shouldUseBillBreakdown) {
      return bill.items
    }

    const description =
      paymentType === "partial"
        ? `Partial payment for invoice ${bill.billNumber || bill.id.slice(0, 8)}`
        : currentPaidAmount > 0
          ? `Balance payment for invoice ${bill.billNumber || bill.id.slice(0, 8)}`
          : `Payment for invoice ${bill.billNumber || bill.id.slice(0, 8)}`

    return [{ description, quantity: 1, unitPrice: transactionAmount, total: transactionAmount }]
  }

  const fetchLatestBillPayment = async () => {
    const response = await fetch(`/api/payments?billId=${encodeURIComponent(bill.id)}&limit=1`, {
      credentials: "include",
    })
    const payload = await response.json().catch(() => ({})) as {
      payments?: { id: string; receipt_no: string; method: string }[]
    }

    if (!response.ok || !Array.isArray(payload.payments) || payload.payments.length === 0) {
      return null
    }

    const latest = payload.payments[0]
    return {
      id: latest.id,
      receiptNo: latest.receipt_no,
      method: latest.method,
    }
  }

  const handleInitiatePesapal = async () => {
    setProcessing(true)
    try {
      const res = await fetch("/api/pesapal/initiate", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          billId: bill.id,
          amount: paymentType === "partial" ? partialAmount : bill.total - (bill.paidAmount || 0),
          email: bill.patientEmail || patient?.email || undefined,
          phoneNumber: paymentMethod === "Mobile Money"
            ? ((mobileMoneyPhone || bill.patientPhone || patient?.phone || "").trim() || undefined)
            : (bill.patientPhone || patient?.phone || undefined),
          paymentMethod,
        }),
      })
      const data = (await res.json()) as { redirectUrl?: string; error?: string }
      if (!res.ok) {
        toast.error(data?.error || "Failed to initiate payment")
        return
      }
      if (data.redirectUrl) {
        window.open(data.redirectUrl, "_blank", "noopener,noreferrer")
        setAwaitingMobileMoney(true)
        toast.success("Payment page opened. Patient should complete payment. This page will update when payment is received.")
      }
    } catch (err) {
      toast.error("Failed to initiate payment")
    } finally {
      setProcessing(false)
    }
  }

  const handleProcessPayment = async () => {
    if (paymentType === "cancel") {
      if (!confirm("Are you sure you want to cancel this bill? This action cannot be undone.")) {
        return
      }
    } else if (paymentType === "partial") {
      if (!paymentMethod) {
        toast.error("Please select a payment method")
        return
      }
      if (partialAmount <= 0 || partialAmount > bill.total - (bill.paidAmount || 0)) {
        toast.error("Invalid payment amount")
        return
      }
    } else {
      if (!paymentMethod) {
        toast.error("Please select a payment method")
        return
      }
      if (isOnlinePayment) {
        toast.error("Use the 'Initiate Payment' button to pay via Mobile Money or Card")
        return
      }
    }

    setProcessing(true)
    try {
      const currentPaidAmount = bill.paidAmount || 0
      const newPaidAmount = paymentType === "cancel" 
        ? 0 
        : paymentType === "partial" 
          ? currentPaidAmount + partialAmount 
          : bill.total

      const res = await fetch(`/api/billing/${bill.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: paymentType === "cancel" ? "Cancelled" : paymentType === "partial" ? "Partially Paid" : "Paid",
          paymentMethod: paymentType === "cancel" ? null : paymentMethod,
          paidAmount: newPaidAmount,
          notes,
        }),
      })
      const data = await res.json().catch(() => ({})) as {
        error?: string
        transactionAmount?: number
        payment?: { id: string; receiptNo: string; method: string }
        bill?: { status: string; paid_amount: string | number; paid_at: string | null; payment_method: string | null }
      }
      if (!res.ok) {
        const message = data?.error || `Payment failed (${res.status})`
        toast.error(message)
        return
      }

      const newStatus = paymentType === "cancel"
        ? "cancelled"
        : paymentType === "partial"
          ? "partially paid"
          : "paid"

      const transactionAmount =
        typeof data.transactionAmount === "number"
          ? data.transactionAmount
          : paymentType === "partial"
            ? partialAmount
            : currentBalance

      if (data.bill) {
        const b = data.bill
        updateBill(bill.id, {
          status: (b.status === "Partially Paid" ? "partially paid" : b.status === "Paid" ? "paid" : b.status === "Cancelled" ? "cancelled" : "pending") as "pending" | "paid" | "partially paid" | "cancelled",
          paymentMethod: paymentType === "cancel" ? undefined : (b.payment_method ?? paymentMethod),
          paymentDate: b.paid_at ? new Date(b.paid_at).toLocaleDateString("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" }) : undefined,
          paidAmount: Number(b.paid_amount) || 0,
          notes,
        })
      } else {
        updateBill(bill.id, {
          status: newStatus as "pending" | "paid" | "partially paid" | "cancelled",
          paymentMethod: paymentType === "cancel" ? undefined : paymentMethod,
          paymentDate: paymentType === "cancel" ? undefined : new Date().toISOString().split("T")[0],
          paidAmount: newPaidAmount,
          notes,
        })
      }
      await refreshBills()
      toast.success(paymentType === "cancel" ? "Bill cancelled successfully" : "Payment processed successfully")
      
      if (paymentType !== "cancel") {
        setPendingReceiptState({
          receiptNumber: data.payment?.receiptNo || bill.billNumber || bill.id,
          amount: transactionAmount,
          method: formatPaymentMethodLabel(data.payment?.method || paymentMethod),
          items: buildReceiptItems(transactionAmount),
          originalTotal: bill.total,
          remainingBalance: Math.max(0, bill.total - newPaidAmount),
          paymentId: data.payment?.id || null,
        })
        setShowSuccessScreen(true)
      } else {
        onBack()
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : ""
      const isNetworkError = /fetch|network|failed to fetch/i.test(msg)
      toast.error(isNetworkError ? "Network error. Please check your connection and try again." : "Failed to process payment")
    } finally {
      setProcessing(false)
    }
  }

  if (showSuccessScreen && pendingReceiptState) {
    return (
      <PaymentSuccessScreen
        amount={pendingReceiptState.amount}
        method={pendingReceiptState.method}
        paymentType={isSplit ? "split" : (paymentType as "full" | "partial")}
        onComplete={handleSuccessComplete}
      />
    )
  }

  if (receiptState) {
    return (
      <ReceiptPrinter
        receiptNumber={receiptState.receiptNumber}
        patientName={bill.patientName}
        patientNumber={formatPatientNumber(bill.patientNumber ?? patient?.patientNumber ?? bill.patientId)}
        items={receiptState.items}
        subtotal={bill.subtotal}
        tax={bill.tax}
        total={receiptState.amount}
        paymentMethod={receiptState.method}
        barcode={bill.barcode || ""}
        type="payment"
        onBack={() => {
          setReceiptState(null)
          onBack()
        }}
        originalTotal={receiptState.originalTotal}
        remainingBalance={receiptState.remainingBalance}
        receiptPdfUrl={receiptState.paymentId ? `/api/receipts/${receiptState.paymentId}` : undefined}
        invoicePdfUrl={invoicePdfUrl}
      />
    )
  }

  const handleDeleteBill = async () => {
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/billing/${billId}`, { method: "DELETE", credentials: "include" })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error || "Failed to delete bill")
        return
      }
      toast.success("Bill deleted")
      await refreshBills()
      onBack()
    } catch {
      toast.error("Failed to delete bill")
    } finally {
      setIsDeleting(false)
    }
  }

  const handleSplitPayment = async () => {
    if (!splitMethod1 || !splitMethod2) {
      toast.error("Please select both payment methods")
      return
    }
    if (splitAmount1 <= 0 || splitAmount2 <= 0) {
      toast.error("Both payment amounts must be greater than 0")
      return
    }
    if (Math.abs(splitAmount1 + splitAmount2 - currentBalance) > 0.01) {
      toast.error(`Split amounts must equal the balance due (${formatCurrency(currentBalance)})`)
      return
    }
    setProcessing(true)
    try {
      // Step 1: partial payment with first method
      const res1 = await fetch(`/api/billing/${bill.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "Partially Paid",
          paymentMethod: splitMethod1,
          paidAmount: (bill.paidAmount || 0) + splitAmount1,
          notes: notes || `Split payment 1/2: ${splitMethod1} — ${formatCurrency(splitAmount1)}`,
        }),
      })
      if (!res1.ok) {
        const err = await res1.json().catch(() => ({})) as { error?: string }
        toast.error(err.error || "First payment failed")
        return
      }
      // Step 2: settle remaining with second method
      const res2 = await fetch(`/api/billing/${bill.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "Paid",
          paymentMethod: splitMethod2,
          paidAmount: bill.total,
          notes: notes || `Split payment 2/2: ${splitMethod2} — ${formatCurrency(splitAmount2)}`,
        }),
      })
      const data2 = await res2.json().catch(() => ({})) as {
        error?: string
        payment?: { id: string; receiptNo: string; method: string }
        bill?: { status: string; paid_amount: string | number; paid_at: string | null; payment_method: string | null }
      }
      if (!res2.ok) {
        toast.error(data2.error || "Second payment failed")
        return
      }
      updateBill(bill.id, {
        status: "paid",
        paidAmount: bill.total,
        paymentMethod: `${splitMethod1} + ${splitMethod2}`,
        paymentDate: new Date().toISOString().split("T")[0],
        notes,
      })
      await refreshBills()
      toast.success("Split payment processed successfully")
      setPendingReceiptState({
        receiptNumber: data2.payment?.receiptNo || bill.billNumber || bill.id,
        amount: bill.total,
        method: `${splitMethod1} + ${splitMethod2}`,
        items: bill.items,
        originalTotal: bill.total,
        remainingBalance: 0,
        paymentId: data2.payment?.id || null,
      })
      setShowSuccessScreen(true)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : ""
      toast.error(/fetch|network/i.test(msg) ? "Network error. Please check your connection." : "Failed to process split payment")
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="sticky top-0 z-10 rounded-2xl border bg-white/80 backdrop-blur-sm px-4 py-2 print:hidden">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-2 -ml-1">
          <ArrowLeft className="h-4 w-4" />
          Back to Queue
        </Button>
        <Button variant="outline" size="sm" asChild className="gap-2">
          <a href={invoicePdfUrl} target="_blank" rel="noreferrer">
            <Printer className="h-4 w-4" />
            Open Official Invoice
          </a>
        </Button>
        <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-2">
          <Printer className="h-4 w-4" />
          Print Screen Copy
        </Button>
        {bill.status === "pending" && currentPaidAmount <= 0 && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2 text-destructive hover:bg-destructive/10">
                {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash className="h-4 w-4" />}
                Delete bill
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this bill?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently remove the bill. Use this if the patient will not pay (e.g. cancelled visit). This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <Button variant="destructive" onClick={handleDeleteBill} disabled={isDeleting}>
                  {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Delete
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_420px] xl:items-start">
        {/* Left panel — invoice (sticky) */}
        <div className="xl:sticky xl:top-16 xl:max-h-[calc(100vh-5rem)] xl:overflow-y-auto">
      <Card className="border-border/80 shadow-lg shadow-black/5 print:shadow-none print:border">
        <CardHeader className="border-b border-border/60 bg-gradient-to-b from-emerald-50/60 to-transparent pb-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-xl tracking-tight">Invoice Details</CardTitle>
              <CardDescription className="mt-1 font-mono text-xs">
                {bill.billNumber || `${bill.id.slice(0, 8)}...`}
              </CardDescription>
            </div>
            <Badge
              variant={
                bill.status === "paid"
                  ? "default"
                  : bill.status === "pending"
                    ? "secondary"
                    : bill.status === "partially paid"
                      ? "outline"
                      : "destructive"
              }
              className="w-fit capitalize"
            >
              {bill.status === "partially paid" ? "Partially Paid" : bill.status}
            </Badge>
          </div>
          {(bill.paidAmount ?? 0) > 0 && (bill.total - (bill.paidAmount ?? 0)) > 0 && (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50/80 p-3 dark:border-amber-800 dark:bg-amber-950/30">
              <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
                <span className="text-muted-foreground">Paid so far:</span>
                <span className="font-semibold text-green-700 dark:text-green-400">{formatCurrency(bill.paidAmount ?? 0)}</span>
                <span className="text-muted-foreground">Balance due:</span>
                <span className="font-bold text-amber-700 dark:text-amber-400">{formatCurrency(bill.total - (bill.paidAmount ?? 0))}</span>
              </div>
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Patient</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground shrink-0">Name</span>
                  <span className="text-right font-medium text-foreground">{bill.patientName}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground shrink-0">Patient ID</span>
                  <span className="font-mono text-foreground">{formatPatientNumber(bill.patientNumber ?? patient?.patientNumber ?? bill.patientId)}</span>
                </div>
                {(patient?.phone || bill.patientPhone) && (
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground shrink-0">Phone</span>
                    <span className="text-foreground">{patient?.phone || bill.patientPhone}</span>
                  </div>
                )}
                {patient?.email && (
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground shrink-0">Email</span>
                    <span className="truncate text-foreground">{patient.email}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Invoice</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground shrink-0">Date</span>
                  <span className="text-foreground">{bill.date}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground shrink-0">Status</span>
                  <span className="capitalize text-foreground">{bill.status}</span>
                </div>
                {bill.paymentDate && (
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground shrink-0">Paid on</span>
                    <span className="text-foreground">{bill.paymentDate}</span>
                  </div>
                )}
                {bill.paymentMethod && (
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground shrink-0">Method</span>
                    <span className="text-foreground">{bill.paymentMethod}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Bill Items</h3>
            <div className="overflow-hidden rounded-xl border border-border/60">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border/60 bg-muted/40">
                    <th className="px-4 py-3 text-left text-xs font-medium tracking-wider text-muted-foreground">Description</th>
                    <th className="px-4 py-3 text-right text-xs font-medium tracking-wider text-muted-foreground">Qty</th>
                    <th className="px-4 py-3 text-right text-xs font-medium tracking-wider text-muted-foreground">Unit</th>
                    <th className="px-4 py-3 text-right text-xs font-medium tracking-wider text-muted-foreground">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {bill.items.map((item, index) => (
                    <tr key={index} className="border-b border-border/40 last:border-0 transition-colors hover:bg-muted/20 odd:bg-muted/20">
                      <td className="px-4 py-3 text-sm font-medium text-foreground">{item.description}</td>
                      <td className="px-4 py-3 text-right text-sm text-muted-foreground">{item.quantity}</td>
                      <td className="px-4 py-3 text-right text-sm text-muted-foreground">{formatCurrency(item.unitPrice)}</td>
                      <td className="px-4 py-3 text-right text-sm font-medium text-foreground">{formatCurrency(item.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-2 rounded-xl border border-border/60 bg-muted/20 p-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="text-foreground">{formatCurrency(bill.subtotal)}</span>
              </div>
              {bill.tax > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tax</span>
                  <span className="text-foreground">{formatCurrency(bill.tax)}</span>
                </div>
              )}
              {bill.discount > 0 && (
                <div className="flex justify-between text-sm text-emerald-600">
                  <span className="text-muted-foreground">Discount</span>
                  <span className="text-foreground">-{formatCurrency(bill.discount)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-border/60 pt-3 text-base font-semibold">
                <span className="text-foreground">Total</span>
                <span className="text-foreground">{formatCurrency(bill.total)}</span>
              </div>
              {(bill.paidAmount ?? 0) > 0 && (
                <>
                  <div className="flex justify-between text-sm text-green-600 dark:text-green-400">
                    <span className="text-muted-foreground">Paid</span>
                    <span className="text-foreground">{formatCurrency(bill.paidAmount ?? 0)}</span>
                  </div>
                  {(bill.total - (bill.paidAmount ?? 0)) > 0 && (
                    <div className="flex justify-between text-sm font-semibold">
                      <span className="text-muted-foreground">Balance due</span>
                      <span className="text-foreground">{formatCurrency(bill.total - (bill.paidAmount ?? 0))}</span>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {bill.notes && (
            <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Notes</h3>
              <p className="text-sm text-foreground">{bill.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>
        </div>

        {/* Right panel — payment form */}
        <div>
          {(bill.status === "pending" || bill.status === "partially paid") && (
          <Card className="border-emerald-100 shadow-sm print:hidden">
            <CardContent className="space-y-5 pt-6">
              <span className="rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs px-3 py-1">
                Payment
              </span>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Payment Type</Label>
                  <Select value={paymentType} onValueChange={(v: "full" | "partial" | "cancel") => setPaymentType(v)}>
                    <SelectTrigger className="h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="full">Full Payment</SelectItem>
                      <SelectItem value="partial">Partial Payment</SelectItem>
                      {currentPaidAmount <= 0 && <SelectItem value="cancel">Cancel Bill</SelectItem>}
                    </SelectContent>
                  </Select>
                </div>
                {paymentType !== "cancel" && (
                  <div className="space-y-2">
                    <Label htmlFor="paymentMethod" className="text-sm font-medium">Payment Method *</Label>
                    <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                      <SelectTrigger id="paymentMethod" className="h-10">
                        <SelectValue placeholder="Select payment method" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Cash">Cash</SelectItem>
                        <SelectItem value="Mobile Money">Mobile Money (MTN, Airtel)</SelectItem>
                        <SelectItem value="Card">Card</SelectItem>
                        <SelectItem value="Bank">Bank Transfer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {paymentType === "cancel" && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    This will cancel the bill. This action cannot be undone.
                  </AlertDescription>
                </Alert>
              )}

              {paymentType !== "cancel" && !isSplit && (
                <div className="flex items-center justify-end">
                  <button
                    type="button"
                    onClick={() => { setIsSplit(true); setPaymentMethod("") }}
                    className="text-xs font-medium text-emerald-700 underline-offset-2 hover:underline"
                  >
                    + Split payment (two methods)
                  </button>
                </div>
              )}

              {paymentType !== "cancel" && isSplit && (
                <div className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50/40 p-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-foreground">Split Payment</div>
                    <button
                      type="button"
                      onClick={() => { setIsSplit(false); setSplitMethod1(""); setSplitMethod2(""); setSplitAmount1(0); setSplitAmount2(0) }}
                      className="text-xs text-muted-foreground underline-offset-2 hover:underline"
                    >
                      Cancel split
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Total to split: <span className="font-semibold text-foreground">{formatCurrency(currentBalance)}</span>
                    {splitAmount1 > 0 && splitAmount2 > 0 && Math.abs(splitAmount1 + splitAmount2 - currentBalance) > 0.01 && (
                      <span className="ml-2 text-destructive">· Amounts don&apos;t add up</span>
                    )}
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="split-method-1" className="text-xs text-muted-foreground">Method 1</Label>
                      <Select value={splitMethod1} onValueChange={setSplitMethod1}>
                        <SelectTrigger id="split-method-1" className="h-9">
                          <SelectValue placeholder="Select method" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Cash">Cash</SelectItem>
                          <SelectItem value="Bank">Bank Transfer</SelectItem>
                          <SelectItem value="Mobile Money">Mobile Money</SelectItem>
                          <SelectItem value="Card">Card</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="split-amount-1" className="text-xs text-muted-foreground">Amount 1</Label>
                      <Input
                        id="split-amount-1"
                        name="splitAmount1"
                        type="number"
                        step="0.01"
                        min="0.01"
                        max={currentBalance}
                        value={splitAmount1 || ""}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value) || 0
                          setSplitAmount1(v)
                          setSplitAmount2(Math.max(0, parseFloat((currentBalance - v).toFixed(2))))
                        }}
                        placeholder="Amount"
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="split-method-2" className="text-xs text-muted-foreground">Method 2</Label>
                      <Select value={splitMethod2} onValueChange={setSplitMethod2}>
                        <SelectTrigger id="split-method-2" className="h-9">
                          <SelectValue placeholder="Select method" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Cash">Cash</SelectItem>
                          <SelectItem value="Bank">Bank Transfer</SelectItem>
                          <SelectItem value="Mobile Money">Mobile Money</SelectItem>
                          <SelectItem value="Card">Card</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="split-amount-2" className="text-xs text-muted-foreground">Amount 2</Label>
                      <Input
                        id="split-amount-2"
                        name="splitAmount2"
                        type="number"
                        step="0.01"
                        min="0.01"
                        max={currentBalance}
                        value={splitAmount2 || ""}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value) || 0
                          setSplitAmount2(v)
                          setSplitAmount1(Math.max(0, parseFloat((currentBalance - v).toFixed(2))))
                        }}
                        placeholder="Auto-filled"
                        className="h-9"
                      />
                    </div>
                  </div>
                  {(splitMethod1 === "Mobile Money" || splitMethod1 === "Card" || splitMethod2 === "Mobile Money" || splitMethod2 === "Card") && (
                    <p className="text-xs text-amber-700">
                      Mobile Money and Card use Pesapal online checkout — split payments for these methods must be handled separately.
                    </p>
                  )}
                </div>
              )}

              {paymentType !== "cancel" && !isSplit && (
                <>
                  {paymentMethod === "Mobile Money" && (
                    <div className="space-y-2 rounded-lg border border-emerald-200 bg-emerald-50/50 p-4">
                      <Label htmlFor="mobileMoneyPhone">Mobile money phone (optional, for pre-fill)</Label>
                      <Input
                        id="mobileMoneyPhone"
                        type="tel"
                        placeholder={patient?.phone ? `e.g. ${patient.phone}` : "e.g. 0785493106 or 0751234567"}
                        value={mobileMoneyPhone}
                        onChange={(e) => setMobileMoneyPhone(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        MTN: 077/078/076 | Airtel: 075/074/070. Pesapal will pre-fill this number and auto-select the correct network (MTN or Airtel) based on the prefix.
                      </p>
                    </div>
                  )}
                  {paymentMethod === "Card" && (
                    <div className="space-y-2 rounded-lg border border-blue-200 bg-blue-50/50 p-4">
                      <p className="text-sm text-muted-foreground">
                        Patient&apos;s name, email, and phone will be pre-filled on Pesapal. They will enter card details on the secure payment page (card numbers cannot be pre-filled for security).
                      </p>
                    </div>
                  )}

                  {paymentMethod === "Cash" && (
                    <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/50 p-4">
                      <div className="flex items-center gap-2">
                        <Coins className="h-4 w-4 text-slate-500" />
                        <Label className="text-sm font-medium">Cash Calculator</Label>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1.5">
                          <Label htmlFor="cashReceived" className="text-xs text-muted-foreground">Cash Received</Label>
                          <Input
                            id="cashReceived"
                            type="number"
                            step="0.01"
                            min="0"
                            value={cashReceived || ""}
                            onChange={(e) => setCashReceived(parseFloat(e.target.value) || 0)}
                            placeholder={`e.g. ${formatCurrency(amountDue)}`}
                            className="h-9"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">Change to Give</Label>
                          <div className={`flex h-9 items-center rounded-md border px-3 text-sm font-semibold ${
                            cashReceived > 0 && cashReceived >= amountDue
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                              : "border-border bg-muted/30 text-muted-foreground"
                          }`}>
                            {cashReceived > 0 && cashReceived >= amountDue
                              ? formatCurrency(cashReceived - amountDue)
                              : "—"}
                          </div>
                        </div>
                      </div>
                      {cashReceived > 0 && cashReceived < amountDue && (
                        <p className="text-xs text-destructive">
                          Cash received is {formatCurrency(amountDue - cashReceived)} short of the amount due.
                        </p>
                      )}
                    </div>
                  )}

                  {paymentType === "partial" && (
                    <div className="space-y-2">
                      <Label htmlFor="partialAmount">Payment Amount *</Label>
                      <p className="text-xs text-muted-foreground">
                        Remaining to pay: {formatCurrency(bill.total - (bill.paidAmount ?? 0))} (max amount you can enter)
                      </p>
                      <Input
                        id="partialAmount"
                        type="number"
                        step="0.01"
                        min="0.01"
                        max={bill.total - (bill.paidAmount ?? 0)}
                        value={partialAmount || ""}
                        onChange={(e) => setPartialAmount(Number.parseFloat(e.target.value) || 0)}
                        placeholder="Enter payment amount"
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="notes" className="text-sm font-medium">Payment Notes</Label>
                    <Textarea
                      id="notes"
                      placeholder="Any additional notes about the payment..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={2}
                      className="resize-none"
                    />
                  </div>
                </>
              )}

              {isSplit && (
                <div className="space-y-2">
                  <Label htmlFor="notes" className="text-sm font-medium">Payment Notes</Label>
                  <Textarea
                    id="notes"
                    placeholder="Any additional notes about the split payment..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                    className="resize-none"
                  />
                </div>
              )}

              <div className="flex flex-wrap gap-2 pt-2">
                {isSplit ? (
                  <Button
                    onClick={handleSplitPayment}
                    className="flex-1"
                    disabled={
                      processing ||
                      !splitMethod1 ||
                      !splitMethod2 ||
                      splitAmount1 <= 0 ||
                      splitAmount2 <= 0 ||
                      Math.abs(splitAmount1 + splitAmount2 - currentBalance) > 0.01
                    }
                  >
                    {processing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <CreditCard className="mr-2 h-4 w-4" />
                        Process Split Payment — {formatCurrency(currentBalance)}
                      </>
                    )}
                  </Button>
                ) : isOnlinePayment ? (
                  <Button
                    onClick={handleInitiatePesapal}
                    className="flex-1"
                    disabled={processing || (paymentType === "partial" && (partialAmount <= 0 || partialAmount > bill.total - (bill.paidAmount || 0)))}
                  >
                    {processing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Initiating...
                      </>
                    ) : (
                      <>Initiate Payment</>
                    )}
                  </Button>
                ) : (
                  <Button
                    onClick={handleProcessPayment}
                    className="flex-1"
                    disabled={processing}
                    variant={paymentType === "cancel" ? "destructive" : "default"}
                  >
                    {processing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processing...
                      </>
                    ) : paymentType === "cancel" ? (
                      <>
                        <XCircle className="mr-2 h-4 w-4" />
                        Cancel Bill
                      </>
                    ) : (
                      <>
                        <CreditCard className="mr-2 h-4 w-4" />
                        {paymentType === "partial"
                          ? `Process Partial Payment — ${formatCurrency(partialAmount)}`
                          : `Process Full Payment — ${formatCurrency(bill.total - (bill.paidAmount || 0))}`}
                      </>
                    )}
                  </Button>
                )}
                {awaitingMobileMoney && (
                  <Button
                    variant="outline"
                    disabled={checkingPayment}
                    onClick={async () => {
                      setCheckingPayment(true)
                      try {
                        const updated = await refreshBills()
                        const b = updated?.find((x) => x.id === billId)
                        if (b?.status === "paid" || (paymentType === "partial" && b?.status === "partially paid")) {
                          toast.success("Payment received! Preparing receipt...")
                          setAwaitingMobileMoney(false)
                          const transactionAmount = paymentType === "partial" ? partialAmount : currentBalance
                          const latestPayment = await fetchLatestBillPayment()
                          setPaymentMethod(b.paymentMethod || latestPayment?.method || "N/A")
                          setReceiptState({
                            receiptNumber: latestPayment?.receiptNo || bill.billNumber || bill.id,
                            amount: transactionAmount,
                            method: formatPaymentMethodLabel(latestPayment?.method || b.paymentMethod || paymentMethod || "N/A"),
                            items: buildReceiptItems(transactionAmount),
                            originalTotal: bill.total,
                            remainingBalance: Math.max(0, bill.total - ((bill.paidAmount || 0) + transactionAmount)),
                            paymentId: latestPayment?.id || null,
                          })
                        } else {
                          toast.info("Payment not yet received. Ask the patient to complete payment, then try again.")
                        }
                      } catch {
                        toast.error("Failed to check payment status")
                      } finally {
                        setCheckingPayment(false)
                      }
                    }}
                  >
                    {checkingPayment ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Checking...
                      </>
                    ) : (
                      "Check Payment Status"
                    )}
                  </Button>
                )}
                <Button variant="outline" onClick={onBack} disabled={processing}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
          )}
        </div>
      </div>
    </div>
  )
}
