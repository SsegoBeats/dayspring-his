"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { type BillItem } from "@/lib/billing-context"
import { usePatients } from "@/lib/patient-context"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import { toast } from "sonner"
import { useBilling } from "@/lib/billing-context"
import { useFormatCurrency } from "@/lib/settings-context"
import { useAuth } from "@/lib/auth-context"
import { CreateBillAccordion } from "./create-bill-accordion"

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

  const loadCoverage = async () => {
    if (!patientId) return
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

      <div className="rounded-xl border border-border bg-card shadow-sm relative">
        <div className="px-6 pt-6">
          <h3 className="font-semibold text-card-foreground">Create New Bill</h3>
          <p className="mt-1 text-sm text-muted-foreground">Generate a new invoice for a patient</p>
        </div>
        <form onSubmit={handleSubmit} className="mt-4">
          <CreateBillAccordion
            patients={patients}
            patientId={patientId}
            patientQuery={patientQuery}
            onPatientQueryChange={setPatientQuery}
            onPatientChange={setPatientId}
            coverage={coverage}
            coverageLoading={coverageLoading}
            onRefreshCoverage={loadCoverage}
            userRole={userRole}
            adminOverride={adminOverride}
            onAdminOverrideChange={setAdminOverride}
            items={items}
            onItemsChange={setItems}
            onDeliverySubChange={handleDeliverySubChange}
            applyTax={applyTax}
            onApplyTaxChange={setApplyTax}
            taxRate={taxRate}
            onTaxRateChange={setTaxRate}
            discountAmount={discountAmount}
            onDiscountChange={setDiscountAmount}
            calculateSubtotal={calculateSubtotal}
            calculateTax={calculateTax}
            calculateTotal={calculateTotal}
            isSubmitting={isSubmitting}
            formatCurrency={formatCurrency}
          />
        </form>
      </div>
    </div>
  )
}
