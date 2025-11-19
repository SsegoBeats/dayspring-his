"use client"

import type React from "react"
import { useState } from "react"
import { type BillItem } from "@/lib/billing-context"
import { usePatients } from "@/lib/patient-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeft, Plus, Trash2, Save } from "lucide-react"

interface CreateBillProps {
  onBack: () => void
  mode?: "page" | "dialog"
}

export function CreateBill({ onBack, mode = "page" }: CreateBillProps) {
  const { patients } = usePatients()

  const [patientId, setPatientId] = useState("")
  const [items, setItems] = useState<BillItem[]>([{ description: "", quantity: 1, unitPrice: 0, total: 0 }])

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
    return calculateSubtotal() * 0.1 // 10% tax
  }

  const calculateTotal = () => {
    return calculateSubtotal() + calculateTax()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!patientId) {
      alert("Please select a patient")
      return
    }

    const validItems = items.filter((item) => item.description && item.quantity > 0 && item.unitPrice > 0)

    if (validItems.length === 0) {
      alert("Please add at least one valid item")
      return
    }

    const patient = patients.find((p) => p.id === patientId)
    if (!patient) {
      alert("Patient not found")
      return
    }

    try {
      const res = await fetch("/api/billing", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId,
          source: "manual",
          items: validItems.map((item) => ({
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
          })),
        }),
      })
      if (!res.ok) {
        alert("Failed to create bill. Please try again.")
        return
      }
    } catch {
      alert("Failed to create bill. Please check your connection and try again.")
      return
    }

    alert("Bill created successfully!")
    onBack()
    if (typeof window !== "undefined") {
      window.location.reload()
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
          <CardTitle>Create New Bill</CardTitle>
          <CardDescription>Generate a new invoice for a patient</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="patient">Select Patient *</Label>
              <Select value={patientId} onValueChange={setPatientId}>
                <SelectTrigger id="patient">
                  <SelectValue placeholder="Choose a patient" />
                </SelectTrigger>
                <SelectContent>
                  {patients.map((patient) => (
                    <SelectItem key={patient.id} value={patient.id}>
                      {patient.firstName} {patient.lastName} ({patient.id})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

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
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Quantity</Label>
                            <Input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) => handleItemChange(index, "quantity", Number.parseInt(e.target.value))}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Unit Price ($)</Label>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              value={item.unitPrice}
                              onChange={(e) => handleItemChange(index, "unitPrice", Number.parseFloat(e.target.value))}
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

            <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal:</span>
                <span className="text-foreground">${calculateSubtotal().toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Tax (10%):</span>
                <span className="text-foreground">${calculateTax().toFixed(2)}</span>
              </div>
              <div className="flex justify-between border-t border-border pt-2 text-base font-semibold">
                <span className="text-foreground">Total:</span>
                <span className="text-foreground">${calculateTotal().toFixed(2)}</span>
              </div>
            </div>

            <Button type="submit" className="w-full">
              <Save className="mr-2 h-4 w-4" />
              Create Bill
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
