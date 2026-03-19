"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { type BillItem } from "@/lib/billing-context"
import { usePatients } from "@/lib/patient-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Plus, Trash2, Save, Loader2, Pill, Stethoscope } from "lucide-react"
import { toast } from "sonner"
import { Checkbox } from "@/components/ui/checkbox"
import { useBilling } from "@/lib/billing-context"
import { useFormatCurrency } from "@/lib/settings-context"
import { formatPatientNumber } from "@/lib/patients"
import { useAuth } from "@/lib/auth-context"
import {
  SERVICE_CATEGORIES,
  SERVICE_CATEGORY_OPTIONS,
  DELIVERY_TYPES,
  DELIVERY_TYPE_OPTIONS,
} from "@/lib/service-categories"

interface CreateBillProps {
  onBack: () => void
  mode?: "page" | "dialog"
}

export function CreateBill({ onBack, mode = "page" }: CreateBillProps) {
  const { patients } = usePatients()
  const { refreshBills } = useBilling()
  const formatCurrency = useFormatCurrency()
  const { user } = useAuth()
  const userRole = user?.role || ""

  const [patientId, setPatientId] = useState("")
  const [patientQuery, setPatientQuery] = useState("")
  const [items, setItems] = useState<BillItem[]>([
    { description: "", quantity: 1, unitPrice: 0, total: 0, itemType: "medication" },
  ])
  const [applyTax, setApplyTax] = useState(false)
  const [taxRate, setTaxRate] = useState(10)
  const [discountAmount, setDiscountAmount] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [coverage, setCoverage] = useState<any | null>(null)
  const [coverageLoading, setCoverageLoading] = useState(false)
  const [adminOverride, setAdminOverride] = useState(false)

  const filteredPatients = patients.filter((patient) => {
    const query = patientQuery.trim().toLowerCase()
    if (!query) return true
    return (
      `${patient.firstName} ${patient.lastName}`.toLowerCase().includes(query) ||
      (patient.patientNumber || "").toLowerCase().includes(query) ||
      patient.phone.toLowerCase().includes(query)
    )
  })

  const handleAddItem = () => {
    setItems([
      ...items,
      { description: "", quantity: 1, unitPrice: 0, total: 0, itemType: "medication" },
    ])
  }

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index))
  }

  const handleItemChange = (index: number, field: keyof BillItem, value: string | number) => {
    const newItems = [...items]
    const item = { ...newItems[index], [field]: value }

    if (field === "itemType") {
      const type = value as "medication" | "service"
      item.itemType = type
      if (type === "service") {
        item.unitPrice = 0
        item.total = 0
        item.serviceCategory = undefined
      } else {
        item.serviceCategory = undefined
        item.total = item.quantity * item.unitPrice
      }
    } else if (field === "serviceCategory") {
      item.serviceCategory = value as string
      const desc =
        value === "Delivery"
          ? "Delivery"
          : DELIVERY_TYPES[value as string] || SERVICE_CATEGORIES[value as string] || (value as string)
      item.description = desc
    } else if (field === "quantity" || field === "unitPrice") {
      if (item.itemType === "service") {
        // Services: total is entered directly, quantity doesn't change total
      } else {
        item.total = item.quantity * item.unitPrice
      }
    } else if (field === "total" && item.itemType === "service") {
      item.total = Number(value) || 0
    }

    newItems[index] = item
    setItems(newItems)
  }

  const handleDeliverySubChange = (index: number, deliveryType: string) => {
    const newItems = [...items]
    const item = newItems[index]
    const description = deliveryType ? `Delivery - ${deliveryType}` : "Delivery"
    newItems[index] = { ...item, description }
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

    if (!patientId) {
      toast.error("Please select a patient")
      return
    }

    const isItemValid = (item: BillItem) => {
      if (!item.description?.trim() || item.quantity <= 0) return false
      const isService = item.itemType === "service"
      if (isService) return item.total > 0
      return item.unitPrice >= 0 && item.quantity * item.unitPrice > 0
    }
    const validItems = items.filter(isItemValid)

    if (validItems.length === 0) {
      toast.error("Please add at least one valid item (description, quantity, and amount)")
      return
    }

    // Insurance readiness gate for restricted services.
    // We only block when the bill contains restricted service categories AND coverage is not ready.
    try {
      const restricted = new Set(["Admission", "Imaging", "Surgery", "Maternity"])
      const hasRestrictedService = validItems.some(
        (it) => it.itemType === "service" && it.serviceCategory && restricted.has(String(it.serviceCategory)),
      )
      const notReady = coverage?.summary?.readiness?.readyForRestrictedServices === false
      const isAdmin = userRole === "Hospital Admin"
      if (hasRestrictedService && notReady && !(isAdmin && adminOverride)) {
        toast.error(
          isAdmin
            ? "Insurance/documents not ready for restricted services. Enable admin override to proceed."
            : "Insurance/documents not ready for restricted services. Please complete verification/preauth/documents first.",
        )
        return
      }
    } catch {}

    for (const item of validItems) {
      if (!item.description.trim()) {
        toast.error("All items must have a description")
        return
      }
      if (item.quantity <= 0) {
        toast.error("All items must have a quantity greater than 0")
        return
      }
      if (item.itemType === "service") {
        if (item.total <= 0) {
          toast.error("Service items must have a total amount greater than 0")
          return
        }
      } else {
        if (item.unitPrice < 0) {
          toast.error("Unit price cannot be negative")
          return
        }
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

    const patient = patients.find((p) => p.id === patientId)
    if (!patient) {
      toast.error("Patient not found")
      return
    }

    setIsSubmitting(true)
    try {
      const res = await fetch("/api/billing", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId,
          source: "manual",
          items: validItems.map((item) => {
            const isService = item.itemType === "service"
            return {
              description: item.description.trim(),
              quantity: item.quantity,
              ...(isService
                ? { total: item.total, itemType: "service" as const, serviceCategory: item.serviceCategory }
                : { unitPrice: item.unitPrice, itemType: "medication" as const }),
            }
          }),
          taxAmount: calculateTax(),
          discountAmount: discountAmount,
        }),
      })
      
      if (!res.ok) {
        const error = await res.json().catch(() => ({}))
        toast.error(error.error || "Failed to create bill. Please try again.")
        return
      }
      
      await refreshBills()
      toast.success("Bill created successfully!")
      onBack()
    } catch (err: any) {
      toast.error(err.message || "Failed to create bill. Please check your connection and try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  useEffect(() => {
    if (!patientId) {
      setCoverage(null)
      return
    }
    let cancelled = false
    const controller = new AbortController()
    void (async () => {
      try {
        setCoverageLoading(true)
        const res = await fetch(`/api/insurance/coverage-summary?patientId=${patientId}`, {
          credentials: "include",
          signal: controller.signal,
        })
        if (!res.ok) throw new Error("Failed to load insurance summary")
        const data = await res.json()
        if (!cancelled) setCoverage(data)
      } catch {
        if (!cancelled) setCoverage(null)
      } finally {
        if (!cancelled) setCoverageLoading(false)
      }
    })()
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [patientId])

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
              <Label htmlFor="patientSearch">Find Patient</Label>
              <Input
                id="patientSearch"
                placeholder="Search by patient name, ID, or phone"
                value={patientQuery}
                onChange={(e) => setPatientQuery(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                {filteredPatients.length} patient{filteredPatients.length === 1 ? "" : "s"} available in the selector below
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="patient">Select Patient *</Label>
              <Select
                value={patientId}
                onValueChange={(next) => {
                  setPatientId(next)
                  setAdminOverride(false)
                }}
              >
                <SelectTrigger id="patient">
                  <SelectValue placeholder="Choose a patient" />
                </SelectTrigger>
                <SelectContent>
                  {filteredPatients.map((patient) => (
                    <SelectItem key={patient.id} value={patient.id}>
                      {patient.firstName} {patient.lastName} ({formatPatientNumber(patient.patientNumber)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {filteredPatients.length === 0 && (
                <p className="text-xs text-amber-700">No patients match that search yet.</p>
              )}
            </div>

            {patientId ? (
              <div className="rounded-lg border bg-muted/20 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-foreground">Insurance readiness</div>
                    <div className="text-xs text-muted-foreground">
                      Helps Cashier know whether restricted services should proceed under cover.
                    </div>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={coverageLoading}
                    onClick={async () => {
                      try {
                        setCoverageLoading(true)
                        const res = await fetch(`/api/insurance/coverage-summary?patientId=${patientId}`, { credentials: "include" })
                        if (!res.ok) throw new Error("Failed to load insurance summary")
                        setCoverage(await res.json())
                      } catch {
                        setCoverage(null)
                      } finally {
                        setCoverageLoading(false)
                      }
                    }}
                  >
                    {coverageLoading ? "Loading..." : "Refresh"}
                  </Button>
                </div>

                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  <div className="rounded-md border bg-white p-3">
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Primary cover</div>
                    <div className="mt-2 text-sm font-semibold text-foreground">
                      {coverage?.primaryPolicy?.payer_name ? coverage.primaryPolicy.payer_name : "—"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {coverage?.primaryPolicy?.policy_no ? `Policy ${coverage.primaryPolicy.policy_no}` : "No policy on file"}
                    </div>
                  </div>
                  <div className="rounded-md border bg-white p-3">
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Verification</div>
                    <div className="mt-2">
                      <Badge variant={coverage?.summary?.readiness?.missingVerification ? "destructive" : "default"}>
                        {coverage?.summary?.readiness?.missingVerification ? "Missing" : "OK"}
                      </Badge>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {coverage?.summary?.policies?.needsVerificationCount != null
                        ? `${coverage.summary.policies.needsVerificationCount} policy(ies) need verification`
                        : "—"}
                    </div>
                  </div>
                  <div className="rounded-md border bg-white p-3">
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Docs / preauth</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Badge variant={coverage?.summary?.readiness?.missingDocuments ? "destructive" : "outline"}>
                        Docs {coverage?.summary?.documents?.missingRequiredTypes?.length ? "Missing" : "OK"}
                      </Badge>
                      <Badge variant={coverage?.summary?.readiness?.missingPreauth ? "destructive" : "outline"}>
                        Preauth {coverage?.summary?.readiness?.missingPreauth ? "Missing" : "OK"}
                      </Badge>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {Array.isArray(coverage?.summary?.documents?.missingRequiredTypes) && coverage.summary.documents.missingRequiredTypes.length
                        ? `Missing: ${coverage.summary.documents.missingRequiredTypes.join(", ")}`
                        : "—"}
                    </div>
                  </div>
                </div>

                {userRole === "Hospital Admin" && coverage?.summary?.readiness?.readyForRestrictedServices === false ? (
                  <div className="mt-3 flex items-center justify-between gap-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm">
                    <div>
                      <div className="font-semibold text-amber-900">Admin override</div>
                      <div className="text-xs text-amber-800/80">
                        Enable only if you approve proceeding despite missing verification/preauth/documents.
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="adminOverride"
                        checked={adminOverride}
                        onCheckedChange={(v) => setAdminOverride(v === true)}
                      />
                      <Label htmlFor="adminOverride" className="cursor-pointer text-amber-900">
                        Proceed anyway
                      </Label>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-foreground">Bill Items</h3>
                <Button type="button" variant="outline" size="sm" onClick={handleAddItem}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Item
                </Button>
              </div>

              <div className="space-y-3">
                {items.map((item, index) => {
                  const isService = item.itemType === "service"
                  const isDelivery = item.serviceCategory === "Delivery"
                  return (
                    <Card key={index}>
                      <CardContent className="p-4">
                        <div className="space-y-3">
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-medium text-foreground">Item {index + 1}</h4>
                              <Badge variant={isService ? "secondary" : "outline"} className="text-xs">
                                {isService ? (
                                  <>
                                    <Stethoscope className="mr-1 h-3 w-3" />
                                    Service
                                  </>
                                ) : (
                                  <>
                                    <Pill className="mr-1 h-3 w-3" />
                                    Medication
                                  </>
                                )}
                              </Badge>
                            </div>
                            {items.length > 1 && (
                              <Button type="button" variant="ghost" size="sm" onClick={() => handleRemoveItem(index)}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            )}
                          </div>

                          <div className="space-y-2">
                            <Label>Item type</Label>
                            <Select
                              value={item.itemType ?? "medication"}
                              onValueChange={(v) => handleItemChange(index, "itemType", v as "medication" | "service")}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="medication">Medication</SelectItem>
                                <SelectItem value="service">Service</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          {isService && (
                            <>
                              <div className="space-y-2">
                                <Label>Service</Label>
                                <Select
                                  value={item.serviceCategory ?? ""}
                                  onValueChange={(v) => handleItemChange(index, "serviceCategory", v)}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select service" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {SERVICE_CATEGORY_OPTIONS.map((key) => (
                                      <SelectItem key={key} value={key}>
                                        {key}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              {isDelivery && (
                                <div className="space-y-2">
                                  <Label>Delivery type</Label>
                                  <Select
                                    value={
                                      item.description.startsWith("Delivery - ")
                                        ? item.description.replace("Delivery - ", "")
                                        : ""
                                    }
                                    onValueChange={(v) => handleDeliverySubChange(index, v)}
                                  >
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {DELIVERY_TYPE_OPTIONS.map((key) => (
                                        <SelectItem key={key} value={key}>
                                          {DELIVERY_TYPES[key]}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              )}
                            </>
                          )}

                          <div className="grid gap-3 md:grid-cols-4">
                            <div className="space-y-2 md:col-span-2">
                              <Label>Description</Label>
                              <Input
                                placeholder={isService ? "e.g., Laboratory Tests" : "e.g., General Consultation"}
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
                                onChange={(e) =>
                                  handleItemChange(index, "quantity", Math.max(1, Number.parseInt(e.target.value) || 1))
                                }
                              />
                            </div>
                            {isService ? (
                              <div className="space-y-2">
                                <Label>Total</Label>
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={item.total || ""}
                                  onChange={(e) =>
                                    handleItemChange(index, "total", Number.parseFloat(e.target.value) || 0)
                                  }
                                />
                              </div>
                            ) : (
                              <div className="space-y-2">
                                <Label>Unit Price</Label>
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={item.unitPrice}
                                  onChange={(e) =>
                                    handleItemChange(index, "unitPrice", Number.parseFloat(e.target.value) || 0)
                                  }
                                />
                              </div>
                            )}
                          </div>

                          <div className="text-right">
                            <span className="text-sm text-muted-foreground">Total: </span>
                            <span className="text-sm font-medium text-foreground">
                              {formatCurrency(isService ? item.total : item.quantity * item.unitPrice)}
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
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
                  <span className="text-foreground">{formatCurrency(calculateSubtotal())}</span>
                </div>
                {applyTax && calculateTax() > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Tax ({taxRate}%):</span>
                    <span className="text-foreground">{formatCurrency(calculateTax())}</span>
                  </div>
                )}
                {discountAmount > 0 && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span className="text-muted-foreground">Discount:</span>
                    <span className="text-foreground">-{formatCurrency(discountAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-border pt-2 text-base font-semibold">
                  <span className="text-foreground">Total:</span>
                  <span className="text-foreground">{formatCurrency(calculateTotal())}</span>
                </div>
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Create Bill
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
