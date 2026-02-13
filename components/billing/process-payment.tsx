"use client"

import { useState } from "react"
import { useBilling } from "@/lib/billing-context"
import { usePatients } from "@/lib/patient-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, CreditCard, Loader2, XCircle, AlertTriangle } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useFormatCurrency } from "@/lib/settings-context"
import { formatPatientNumber } from "@/lib/patients"
import { ReceiptPrinter } from "@/components/receipt-printer"
import { toast } from "sonner"

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

  const [paymentMethod, setPaymentMethod] = useState("")
  const [notes, setNotes] = useState("")
  const [showReceipt, setShowReceipt] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [paymentType, setPaymentType] = useState<"full" | "partial" | "cancel">("full")
  const [partialAmount, setPartialAmount] = useState<number>(0)
  const [mobileMoneyPhone, setMobileMoneyPhone] = useState("")
  const [awaitingMobileMoney, setAwaitingMobileMoney] = useState(false)

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
          email: patient?.email,
          phoneNumber: paymentMethod === "Mobile Money"
            ? ((mobileMoneyPhone || patient?.phone || "").trim() || undefined)
            : (paymentMethod === "Card" ? (patient?.phone || undefined) : undefined),
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
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string }
        const message = err?.error || `Payment failed (${res.status})`
        toast.error(message)
        return
      }
      
      const newStatus = paymentType === "cancel" 
        ? "cancelled" 
        : paymentType === "partial" 
          ? "partially paid" 
          : "paid"
      
      updateBill(bill.id, {
        status: newStatus as any,
        paymentMethod: paymentType === "cancel" ? undefined : paymentMethod,
        paymentDate: paymentType === "cancel" ? undefined : new Date().toISOString().split("T")[0],
        paidAmount: newPaidAmount,
        notes,
      })
      await refreshBills()
      toast.success(paymentType === "cancel" ? "Bill cancelled successfully" : "Payment processed successfully")
      
      if (paymentType !== "cancel") {
        setShowReceipt(true)
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

  if (showReceipt) {
    const paidAmount = paymentType === "partial" ? partialAmount : bill.total
    const originalTotal = bill.total
    const remainingBalance = paymentType === "partial" ? originalTotal - (bill.paidAmount || 0) - partialAmount : 0
    
    return (
      <ReceiptPrinter
        receiptNumber={bill.billNumber || bill.id}
        patientName={bill.patientName}
        patientNumber={formatPatientNumber(bill.patientNumber ?? patient?.patientNumber ?? bill.patientId)}
        items={bill.items}
        subtotal={bill.subtotal}
        tax={bill.tax}
        total={paidAmount}
        paymentMethod={paymentMethod || bill.paymentMethod || "N/A"}
        barcode={bill.barcode || ""}
        type="payment"
        onBack={() => {
          setShowReceipt(false)
          onBack()
        }}
        originalTotal={paymentType === "partial" ? originalTotal : undefined}
        remainingBalance={paymentType === "partial" ? remainingBalance : undefined}
      />
    )
  }

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onBack} className="gap-2">
        <ArrowLeft className="h-4 w-4" />
        Back to Queue
      </Button>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Invoice Details</CardTitle>
              <CardDescription>Invoice ID: {bill.id}</CardDescription>
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
            >
              {bill.status === "partially paid" ? "Partially Paid" : bill.status}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3">
              <h3 className="font-semibold text-foreground">Patient Information</h3>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Name:</span>{" "}
                  <span className="text-foreground">{bill.patientName}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Patient ID:</span>{" "}
                  <span className="text-foreground font-mono">{formatPatientNumber(bill.patientNumber ?? patient?.patientNumber ?? bill.patientId)}</span>
                </div>
                {patient && (
                  <>
                    <div>
                      <span className="text-muted-foreground">Phone:</span>{" "}
                      <span className="text-foreground">{patient.phone}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Email:</span>{" "}
                      <span className="text-foreground">{patient.email}</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="font-semibold text-foreground">Invoice Information</h3>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Invoice Date:</span>{" "}
                  <span className="text-foreground">{bill.date}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Status:</span>{" "}
                  <span className="text-foreground">{bill.status}</span>
                </div>
                {bill.paymentDate && (
                  <div>
                    <span className="text-muted-foreground">Payment Date:</span>{" "}
                    <span className="text-foreground">{bill.paymentDate}</span>
                  </div>
                )}
                {bill.paymentMethod && (
                  <div>
                    <span className="text-muted-foreground">Payment Method:</span>{" "}
                    <span className="text-foreground">{bill.paymentMethod}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="font-semibold text-foreground">Bill Items</h3>
            <div className="rounded-lg border border-border">
              <table className="w-full">
                <thead className="border-b border-border bg-muted/50">
                  <tr>
                    <th className="p-3 text-left text-sm font-medium text-foreground">Description</th>
                    <th className="p-3 text-right text-sm font-medium text-foreground">Qty</th>
                    <th className="p-3 text-right text-sm font-medium text-foreground">Unit Price</th>
                    <th className="p-3 text-right text-sm font-medium text-foreground">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {bill.items.map((item, index) => (
                    <tr key={index} className="border-b border-border last:border-0">
                      <td className="p-3 text-sm text-foreground">{item.description}</td>
                      <td className="p-3 text-right text-sm text-foreground">{item.quantity}</td>
                      <td className="p-3 text-right text-sm text-foreground">{formatCurrency(item.unitPrice)}</td>
                      <td className="p-3 text-right text-sm text-foreground">{formatCurrency(item.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal:</span>
                <span className="text-foreground">{formatCurrency(bill.subtotal)}</span>
              </div>
              {bill.tax > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tax:</span>
                  <span className="text-foreground">{formatCurrency(bill.tax)}</span>
                </div>
              )}
              {bill.discount > 0 && (
                <div className="flex justify-between text-sm text-green-600">
                  <span className="text-muted-foreground">Discount:</span>
                  <span className="text-foreground">-{formatCurrency(bill.discount)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-border pt-2 text-base font-semibold">
                <span className="text-foreground">Total:</span>
                <span className="text-foreground">{formatCurrency(bill.total)}</span>
              </div>
              {bill.paidAmount && bill.paidAmount > 0 && (
                <>
                  <div className="flex justify-between text-sm text-amber-600">
                    <span className="text-muted-foreground">Paid Amount:</span>
                    <span className="text-foreground">{formatCurrency(bill.paidAmount)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-semibold">
                    <span className="text-muted-foreground">Remaining Balance:</span>
                    <span className="text-foreground">{formatCurrency(bill.total - bill.paidAmount)}</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {(bill.status === "pending" || bill.status === "partially paid") && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Payment Type</Label>
                <Select value={paymentType} onValueChange={(v: "full" | "partial" | "cancel") => setPaymentType(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full">Full Payment</SelectItem>
                    <SelectItem value="partial">Partial Payment</SelectItem>
                    <SelectItem value="cancel">Cancel Bill</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {paymentType === "cancel" && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    This will cancel the bill. This action cannot be undone.
                  </AlertDescription>
                </Alert>
              )}

              {paymentType !== "cancel" && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="paymentMethod">Payment Method *</Label>
                    <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                      <SelectTrigger id="paymentMethod">
                        <SelectValue placeholder="Select payment method" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Cash">Cash</SelectItem>
                        <SelectItem value="Mobile Money">Mobile Money (MTN, Airtel)</SelectItem>
                        <SelectItem value="Card">Card</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

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

                  {paymentType === "partial" && (
                    <div className="space-y-2">
                      <Label htmlFor="partialAmount">
                        Payment Amount * (Remaining: {formatCurrency(bill.total - (bill.paidAmount || 0))})
                      </Label>
                      <Input
                        id="partialAmount"
                        type="number"
                        step="0.01"
                        min="0.01"
                        max={bill.total - (bill.paidAmount || 0)}
                        value={partialAmount || ""}
                        onChange={(e) => setPartialAmount(Number.parseFloat(e.target.value) || 0)}
                        placeholder="Enter payment amount"
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="notes">Payment Notes</Label>
                    <Textarea
                      id="notes"
                      placeholder="Any additional notes about the payment..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={3}
                    />
                  </div>
                </>
              )}

              <div className="flex flex-wrap gap-2">
                {isOnlinePayment ? (
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
                          ? `Process Partial Payment - ${formatCurrency(partialAmount)}`
                          : `Process Full Payment - ${formatCurrency(bill.total - (bill.paidAmount || 0))}`}
                      </>
                    )}
                  </Button>
                )}
                {awaitingMobileMoney && (
                  <Button variant="outline" onClick={async () => { await refreshBills(); setAwaitingMobileMoney(false); }}>
                    Check Payment Status
                  </Button>
                )}
                <Button variant="outline" onClick={onBack} disabled={processing}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {bill.notes && (
            <div className="space-y-2">
              <h3 className="font-semibold text-foreground">Payment Notes</h3>
              <div className="rounded-lg border border-border bg-muted/50 p-3">
                <p className="text-sm text-foreground">{bill.notes}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
