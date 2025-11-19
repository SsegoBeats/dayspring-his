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
import { ArrowLeft, CreditCard } from "lucide-react"
import { useFormatCurrency } from "@/lib/settings-context"
import { ReceiptPrinter } from "@/components/receipt-printer"

interface ProcessPaymentProps {
  billId: string
  onBack: () => void
}

export function ProcessPayment({ billId, onBack }: ProcessPaymentProps) {
  const formatCurrency = useFormatCurrency()
  const { getBill, updateBill } = useBilling()
  const { getPatient } = usePatients()
  const bill = getBill(billId)
  const patient = bill ? getPatient(bill.patientId) : null

  const [paymentMethod, setPaymentMethod] = useState("")
  const [notes, setNotes] = useState("")
  const [showReceipt, setShowReceipt] = useState(false)

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

  const handleProcessPayment = () => {
    if (!paymentMethod) {
      alert("Please select a payment method")
      return
    }

    updateBill(bill.id, {
      status: "paid",
      paymentMethod,
      paymentDate: new Date().toISOString().split("T")[0],
      notes,
    })

    setShowReceipt(true)
  }

  if (showReceipt) {
    return (
      <ReceiptPrinter
        receiptNumber={bill.billNumber || bill.id}
        patientName={bill.patientName}
        patientNumber={bill.patientId}
        items={bill.items}
        subtotal={bill.subtotal}
        tax={bill.tax}
        total={bill.total}
        paymentMethod={paymentMethod || bill.paymentMethod || "N/A"}
        barcode={bill.barcode || ""}
        type="payment"
      />
    )
  }

  return (
    <div className="space-y-4">
      <Button variant="outline" onClick={onBack}>
        <ArrowLeft className="mr-2 h-4 w-4" />
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
              variant={bill.status === "paid" ? "default" : bill.status === "pending" ? "secondary" : "destructive"}
            >
              {bill.status}
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
                  <span className="text-foreground">{bill.patientId}</span>
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
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Tax (10%):</span>
                <span className="text-foreground">{formatCurrency(bill.tax)}</span>
              </div>
              <div className="flex justify-between border-t border-border pt-2 text-base font-semibold">
                <span className="text-foreground">Total:</span>
                <span className="text-foreground">{formatCurrency(bill.total)}</span>
              </div>
            </div>
          </div>

          {bill.status === "pending" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="paymentMethod">Payment Method *</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger id="paymentMethod">
                    <SelectValue placeholder="Select payment method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Cash">Cash</SelectItem>
                    <SelectItem value="Credit Card">Credit Card</SelectItem>
                    <SelectItem value="Debit Card">Debit Card</SelectItem>
                    <SelectItem value="Insurance">Insurance</SelectItem>
                    <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                  </SelectContent>
                </Select>
              </div>

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

              <Button onClick={handleProcessPayment} className="w-full">
                <CreditCard className="mr-2 h-4 w-4" />
                Process Payment - {formatCurrency(bill.total)}
              </Button>
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
