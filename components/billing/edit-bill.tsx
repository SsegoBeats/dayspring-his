"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { type BillItem } from "@/lib/billing-context"
import { useBilling } from "@/lib/billing-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { ArrowLeft, Plus, Trash2, Save, Loader2 } from "lucide-react"
import { toast } from "sonner"

interface EditBillProps {
  billId: string
  onBack: () => void
  mode?: "page" | "dialog"
}

export function EditBill({ billId, onBack, mode = "page" }: EditBillProps) {
  const { getBill, refreshBills } = useBilling()
  const bill = getBill(billId)

  const [items, setItems] = useState<BillItem[]>([])
  const [applyTax, setApplyTax] = useState(false)
  const [taxRate, setTaxRate] = useState(0)
  const [discountAmount, setDiscountAmount] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (bill) {
      setItems(bill.items || [])
      setApplyTax(bill.tax > 0)
      setTaxRate(bill.tax > 0 ? Math.round((bill.tax / bill.subtotal) * 100 * 10) / 10 : 0)
      setDiscountAmount(bill.discount || 0)
      setIsLoading(false)
    }
  }, [bill])

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">Loading bill...</p>
        </CardContent>
      </Card>
    )
  }

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

  if (bill.status !== "pending") {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <p className="text-muted-foreground">Only pending bills can be edited</p>
          <Button onClick={onBack} className="mt-4">
            Go Back
          </Button>
        </CardContent>
      </Card>
    )
  }

  const handleAddItem = () => {
    setItems([...items, { description: "", quantity: 1, unitPrice: 0, total: 0 }])
  }

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index))
  }

  const handleItemChange = (index: number, field: keyof BillItem, value: string | number) => {
    const newItems = [...items]
    newItems[index] = { ...newItems[index], [field]: value }

    // Recalculate total for this item
    if (field === "quantity" || field === "unitPrice") {
      newItems[index].total = newItems[index].quantity * newItems[index].unitPrice
    }

    setItems(newItems)
  }

  const calculateSubtotal = () => {
    return items.reduce((sum, item) => sum + item.total, 0)
  }

  const calculateTax = () => {
    if (!applyTax) return 0
    return calculateSubtotal() * (taxRate / 100)
  }

  const calculateTotal = () => {
    return calculateSubtotal() + calculateTax() - discountAmount
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const validItems = items.filter((item) => item.description && item.quantity > 0 && item.unitPrice > 0)

    if (validItems.length === 0) {
      toast.error("Please add at least one valid item")
      return
    }

    // Validate item fields
    for (const item of validItems) {
      if (!item.description.trim()) {
        toast.error("All items must have a description")
        return
      }
      if (item.quantity <= 0) {
        toast.error("All items must have a quantity greater than 0")
        return
      }
      if (item.unitPrice < 0) {
        toast.error("Unit price cannot be negative")
        return
      }
    }

    // Validate tax rate if tax is applied
    if (applyTax && (taxRate < 0 || taxRate > 100)) {
      toast.error("Tax rate must be between 0 and 100")
      return
    }

    // Validate discount
    if (discountAmount < 0) {
      toast.error("Discount cannot be negative")
      return
    }

    setIsSubmitting(true)
    try {
      const res = await fetch(`/api/billing/${billId}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: validItems.map((item) => ({
            description: item.description.trim(),
            quantity: item.quantity,
            unitPrice: item.unitPrice,
          })),
          taxAmount: calculateTax(),
          discountAmount: discountAmount,
        }),
      })

      if (!res.ok) {
        const error = await res.json().catch(() => ({}))
        toast.error(error.error || "Failed to update bill. Please try again.")
        return
      }

      toast.success("Bill updated successfully!")
      await refreshBills()
      onBack()
    } catch (err: any) {
      toast.error(err.message || "Failed to update bill. Please check your connection and try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      {mode === "page" && (
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Queue
        </Button>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Edit Bill</CardTitle>
          <CardDescription>Invoice ID: {bill.id} | Patient: {bill.patientName}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-foreground">Bill Items</h3>
                <Button type="button" variant="outline" size="sm" onClick={handleAddItem}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Item
                </Button>
              </div>

              <div className="space-y-3">
                {items.map((item, index) => (
                  <Card key={index}>
                    <CardContent className="p-4">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-medium text-foreground">Item {index + 1}</h4>
                          {items.length > 1 && (
                            <Button type="button" variant="ghost" size="sm" onClick={() => handleRemoveItem(index)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </div>

                        <div className="grid gap-3 md:grid-cols-4">
                          <div className="space-y-2 md:col-span-2">
                            <Label>Description</Label>
                            <Input
                              placeholder="e.g., General Consultation"
                              value={item.description}
                              onChange={(e) => handleItemChange(index, "description", e.target.value)}
                              required
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Quantity</Label>
                            <Input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) => handleItemChange(index, "quantity", Number.parseInt(e.target.value) || 1)}
                              required
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Unit Price</Label>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              value={item.unitPrice}
                              onChange={(e) => handleItemChange(index, "unitPrice", Number.parseFloat(e.target.value) || 0)}
                              required
                            />
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="text-sm text-muted-foreground">Total: </span>
                          <span className="text-sm font-medium text-foreground">${item.total.toFixed(2)}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            <div className="space-y-4 rounded-lg border border-border bg-muted/30 p-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="applyTax"
                  checked={applyTax}
                  onCheckedChange={(checked) => setApplyTax(checked === true)}
                />
                <Label htmlFor="applyTax" className="cursor-pointer">
                  Apply Tax
                </Label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="taxRate">Tax Rate (%)</Label>
                  <Input
                    id="taxRate"
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={taxRate}
                    onChange={(e) => setTaxRate(Number.parseFloat(e.target.value) || 0)}
                    disabled={!applyTax}
                    className={!applyTax ? "opacity-50" : ""}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="discount">Discount Amount</Label>
                  <Input
                    id="discount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={discountAmount}
                    onChange={(e) => setDiscountAmount(Number.parseFloat(e.target.value) || 0)}
                  />
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-border">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal:</span>
                  <span className="text-foreground">${calculateSubtotal().toFixed(2)}</span>
                </div>
                {applyTax && calculateTax() > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Tax ({taxRate}%):</span>
                    <span className="text-foreground">${calculateTax().toFixed(2)}</span>
                  </div>
                )}
                {discountAmount > 0 && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span className="text-muted-foreground">Discount:</span>
                    <span className="text-foreground">-${discountAmount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-border pt-2 text-base font-semibold">
                  <span className="text-foreground">Total:</span>
                  <span className="text-foreground">${calculateTotal().toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <Button type="submit" className="flex-1" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Update Bill
                  </>
                )}
              </Button>
              <Button type="button" variant="outline" onClick={onBack} disabled={isSubmitting}>
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
