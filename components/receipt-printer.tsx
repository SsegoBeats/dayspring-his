"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { BarcodeGenerator } from "./barcode-generator"
import { useFormatCurrency } from "@/lib/settings-context"
import { useFormatDate } from "@/lib/date-utils"
import { Printer, ArrowLeft } from "lucide-react"

interface ReceiptItem {
  description: string
  quantity: number
  unitPrice: number
  total: number
}

interface ReceiptPrinterProps {
  receiptNumber: string
  patientName: string
  patientNumber: string
  items: ReceiptItem[]
  subtotal: number
  /** @deprecated Tax line removed from receipt; prop kept for backward compatibility */
  tax?: number
  total: number
  paymentMethod: string
  barcode: string
  type: "payment" | "prescription"
  onBack?: () => void
  originalTotal?: number
  remainingBalance?: number
}

export function ReceiptPrinter({
  receiptNumber,
  patientName,
  patientNumber,
  items,
  subtotal,
  total,
  paymentMethod,
  barcode,
  type,
  onBack,
  originalTotal,
  remainingBalance,
}: ReceiptPrinterProps) {
  const formatCurrency = useFormatCurrency()
  const { formatDateTime } = useFormatDate()
  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between print:hidden">
        {onBack && (
          <Button variant="outline" onClick={onBack} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        )}
        <Button onClick={handlePrint} className="gap-2">
          <Printer className="h-4 w-4" />
          Print Receipt
        </Button>
      </div>

      <Card className="p-8 max-w-2xl mx-auto print:shadow-none print:border-0">
        {/* Header */}
        <div className="text-center border-b-2 border-primary pb-4 mb-6">
          <h1 className="text-2xl font-bold text-primary">Dayspring Medical Center</h1>
          <p className="text-sm text-muted-foreground">Quality Healthcare for Everyone</p>
          <p className="text-xs text-muted-foreground mt-1">
            Kampala, Uganda | Tel: {process.env.NEXT_PUBLIC_ORG_PHONE || "See reception for contact details"}
          </p>
        </div>

        {/* Receipt Type */}
        <div className="text-center mb-4">
          <h2 className="text-xl font-semibold">{type === "payment" ? "Payment Receipt" : "Prescription Receipt"}</h2>
          <p className="text-sm text-muted-foreground">Receipt #{receiptNumber}</p>
        </div>

        {/* Patient Info */}
        <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
          <div>
            <p className="text-muted-foreground">Patient Name:</p>
            <p className="font-semibold">{patientName}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Patient Number:</p>
            <p className="font-semibold">{patientNumber}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Date:</p>
            <p className="font-semibold">{formatDateTime(new Date())}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Payment Method:</p>
            <p className="font-semibold">{paymentMethod}</p>
          </div>
        </div>

        {/* Items */}
        <div className="mb-6">
          <table className="w-full text-sm">
            <thead className="border-b">
              <tr className="text-left">
                <th className="pb-2">Description</th>
                <th className="pb-2 text-center">Qty</th>
                <th className="pb-2 text-right">Unit Price</th>
                <th className="pb-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr key={index} className="border-b">
                  <td className="py-2">{item.description}</td>
                  <td className="py-2 text-center">{item.quantity}</td>
                  <td className="py-2 text-right">{formatCurrency(item.unitPrice)}</td>
                  <td className="py-2 text-right">{formatCurrency(item.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="space-y-2 text-sm mb-6">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal:</span>
            <span>{formatCurrency(subtotal)}</span>
          </div>
          {originalTotal && originalTotal > total && (
            <>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Amount:</span>
                <span>{formatCurrency(originalTotal)}</span>
              </div>
              <div className="flex justify-between text-green-600">
                <span>Amount Paid:</span>
                <span>{formatCurrency(total)}</span>
              </div>
              {remainingBalance !== undefined && remainingBalance > 0 && (
                <div className="flex justify-between text-amber-600 font-semibold">
                  <span>Remaining Balance:</span>
                  <span>{formatCurrency(remainingBalance)}</span>
                </div>
              )}
            </>
          )}
          <div className="flex justify-between text-lg font-bold border-t-2 pt-2">
            <span>{originalTotal && originalTotal > total ? "AMOUNT PAID:" : "TOTAL PAID:"}</span>
            <span className="text-primary">{formatCurrency(total)}</span>
          </div>
        </div>

        {/* Barcode */}
        <div className="flex justify-center mb-6 border-t pt-6">
          <BarcodeGenerator value={barcode} />
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-muted-foreground border-t pt-4">
          <p>Thank you for choosing Dayspring Medical Center</p>
          <p className="mt-1">Please keep this receipt for your records</p>
          {type === "payment" && (
            <p className="mt-2 font-semibold">Present this receipt at the pharmacy to collect your medications</p>
          )}
        </div>
      </Card>
    </div>
  )
}
