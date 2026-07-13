"use client"

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react"
import { useAuth } from "@/lib/auth-context"
import { can } from "@/lib/security"
import { ORG_NAME, ORG_EMAIL } from "@/lib/org-constants"
import { buildMedicationUpdatePayload } from "@/lib/pharmacy-update-payload"

export interface Medication {
  id: string
  name: string
  category: string
  manufacturer: string
  stockQuantity: number
  unitPrice: number
  costPrice?: number
  expiryDate: string
  batchNumber: string
  reorderLevel: number
  minStockLevel?: number
  maxStockLevel?: number
  lastRestockedAt?: string
  barcode?: string
  is_controlled: boolean
  schedule_class: string | null
}

export interface Supplier {
  id: string
  name: string
  contact_person?: string
  phone?: string
  email?: string
  address?: string
  nda_license_number?: string
  payment_terms?: string
  is_active: boolean
  created_at: string
}

export interface PurchaseOrderItem {
  medication_id: string
  quantity_ordered: number
  unit_cost?: number
  notes?: string
}

export interface PurchaseOrder {
  id: string
  po_number: string
  supplier_id: string
  supplier_name?: string
  status: string
  notes?: string
  expected_delivery_date?: string
  item_count?: number
  total_value?: number
  created_by_name?: string
  created_at: string
  updated_at: string
  approved_at?: string
  cancelled_at?: string
}

export interface GRNItem {
  medication_id: string
  batch_number: string
  expiry_date: string
  quantity_ordered?: number
  quantity_received: number
  unit_cost?: number
}

export interface GRN {
  id: string
  grn_number: string
  supplier_id: string
  supplier_name?: string
  purchase_order_id?: string
  invoice_number?: string
  notes?: string
  received_by_name?: string
  item_count?: number
  received_at: string
  created_at: string
}

export interface PharmacySettings {
  id: string
  user_id: string
  low_stock_threshold_override?: number
  expiry_warning_days: number
  expiry_critical_days: number
  default_dispensing_notes?: string
  preferred_print_format: string
  print_include_logo: boolean
  enable_controlled_drug_alerts: boolean
  notify_low_stock: boolean
  notify_expiry: boolean
  notify_new_prescriptions: boolean
  notify_po_approved: boolean
  updated_at: string
}

export interface StockAdjustment {
  id: string
  medicationId: string
  medicationName: string
  adjustmentType: "add" | "remove" | "correction"
  quantity: number
  reason: string
  adjustedBy: string
  adjustedAt: string
}

interface PharmacyContextType {
  medications: Medication[]
  suppliers: Supplier[]
  purchaseOrders: PurchaseOrder[]
  stockAdjustments: StockAdjustment[]
  grns: GRN[]
  pharmacySettings: PharmacySettings | null
  addMedication: (medication: Omit<Medication, "id">) => void
  updateMedication: (id: string, updates: Partial<Medication>) => void
  deleteMedication: (id: string) => Promise<void>
  getMedication: (name: string) => Medication | undefined
  getLowStockMedications: () => Medication[]
  getExpiringMedications: (days: number) => Medication[]
  refreshMedications: () => Promise<void>
  refreshSuppliers: () => Promise<void>
  refreshPurchaseOrders: () => Promise<void>
  createPurchaseOrder: (data: {
    supplier_id: string
    items: PurchaseOrderItem[]
    notes?: string
    expected_delivery_date?: string
    submit_for_approval?: boolean
  }) => Promise<PurchaseOrder>
  approvePurchaseOrder: (id: string) => Promise<void>
  cancelPurchaseOrder: (id: string, reason?: string) => Promise<void>
  refreshGrns: () => Promise<void>
  createGrn: (data: {
    supplier_id: string
    items: GRNItem[]
    purchase_order_id?: string
    invoice_number?: string
    notes?: string
  }) => Promise<GRN>
  refreshPharmacySettings: () => Promise<void>
  updatePharmacySettings: (data: Partial<PharmacySettings>) => Promise<PharmacySettings>
  adjustStock: (adjustment: Omit<StockAdjustment, "id" | "adjustedAt">) => void
  sendLowStockAlerts: () => Promise<void>
  sendExpiryAlerts: () => Promise<void>
}

const PharmacyContext = createContext<PharmacyContextType | undefined>(undefined)

export function PharmacyProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [medications, setMedications] = useState<Medication[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([])
  const [stockAdjustments, setStockAdjustments] = useState<StockAdjustment[]>([])
  const [grns, setGrns] = useState<GRN[]>([])
  const [pharmacySettings, setPharmacySettings] = useState<PharmacySettings | null>(null)

  const hasPharmacyAccess = user && can(user.role, "pharmacy", "read")

  const refreshMedications = async () => {
    if (!hasPharmacyAccess) return
    try {
      const res = await fetch("/api/pharmacy/medications", { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        const meds: Medication[] = (data.medications || []).map((m: any) => ({
          id: m.id,
          name: m.name,
          category: m.category,
          manufacturer: m.manufacturer || "",
          stockQuantity: Number(m.stock_quantity),
          unitPrice: Number(m.unit_price),
          costPrice: m.cost_price ? Number(m.cost_price) : undefined,
          expiryDate: m.expiry_date || "",
          batchNumber: "",
          reorderLevel: Number(m.reorder_level || 0),
          minStockLevel: m.min_stock_level ? Number(m.min_stock_level) : undefined,
          maxStockLevel: m.max_stock_level ? Number(m.max_stock_level) : undefined,
          lastRestockedAt: m.last_restocked_at || undefined,
          barcode: m.barcode || undefined,
          is_controlled: m.is_controlled === true,
          schedule_class: m.schedule_class ?? null,
        }))
        setMedications(meds)
      } else if (res.status === 401 || res.status === 403) {
        // User doesn't have permission - this is expected for non-pharmacy users
        setMedications([])
      } else if (process.env.NODE_ENV === "development") {
        console.warn("[PharmacyContext] Failed to fetch medications:", res.status, res.statusText)
      } else {
        setMedications([])
      }
    } catch (err) {
      // Only log in development to avoid console noise in production
      if (process.env.NODE_ENV === "development") {
        console.warn("[PharmacyContext] Error fetching medications:", err)
      }
      setMedications([])
    }
  }

  const refreshSuppliers = useCallback(async () => {
    try {
      const res = await fetch("/api/pharmacy/suppliers", { credentials: "include" })
      if (!res.ok) {
        if (process.env.NODE_ENV === "development") {
          console.warn("[PharmacyContext] Failed to fetch suppliers:", res.status, res.statusText)
        }
        return
      }
      const data = await res.json()
      setSuppliers(data.suppliers ?? [])
    } catch (err) {
      if (process.env.NODE_ENV === "development") {
        console.warn("[PharmacyContext] Error fetching suppliers:", err)
      }
    }
  }, [])

  const refreshPurchaseOrders = useCallback(async () => {
    try {
      const res = await fetch("/api/pharmacy/purchase-orders", { credentials: "include" })
      if (!res.ok) {
        if (process.env.NODE_ENV === "development") {
          console.warn("[PharmacyContext] Failed to fetch purchase orders:", res.status, res.statusText)
        }
        return
      }
      const data = await res.json()
      setPurchaseOrders(data.purchase_orders ?? [])
    } catch (err) {
      if (process.env.NODE_ENV === "development") {
        console.warn("[PharmacyContext] Error fetching purchase orders:", err)
      }
    }
  }, [])

  const createPurchaseOrder = useCallback(async (data: {
    supplier_id: string
    items: PurchaseOrderItem[]
    notes?: string
    expected_delivery_date?: string
    submit_for_approval?: boolean
  }) => {
    const res = await fetch("/api/pharmacy/purchase-orders", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error((err as { error?: string }).error || "Failed to create purchase order")
    }
    const result = await res.json()
    await refreshPurchaseOrders()
    return result.purchase_order
  }, [refreshPurchaseOrders])

  const approvePurchaseOrder = useCallback(async (id: string) => {
    const res = await fetch(`/api/pharmacy/purchase-orders/${id}`, {
      credentials: "include",
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "approve" }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error((err as { error?: string }).error || "Failed to approve purchase order")
    }
    await refreshPurchaseOrders()
  }, [refreshPurchaseOrders])

  const cancelPurchaseOrder = useCallback(async (id: string, reason?: string) => {
    const res = await fetch(`/api/pharmacy/purchase-orders/${id}`, {
      credentials: "include",
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "cancel", cancellation_reason: reason }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error((err as { error?: string }).error || "Failed to cancel purchase order")
    }
    await refreshPurchaseOrders()
  }, [refreshPurchaseOrders])

  const refreshGrns = useCallback(async () => {
    try {
      const res = await fetch("/api/pharmacy/grn")
      if (!res.ok) return
      const data = await res.json()
      setGrns(data.grns ?? [])
    } catch {}
  }, [])

  const createGrn = useCallback(async (data: {
    supplier_id: string
    items: GRNItem[]
    purchase_order_id?: string
    invoice_number?: string
    notes?: string
  }) => {
    const res = await fetch("/api/pharmacy/grn", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error((err as { error?: string }).error || "Failed to create GRN")
    }
    const result = await res.json()
    await refreshGrns()
    return result.grn
  }, [refreshGrns])

  const refreshPharmacySettings = useCallback(async () => {
    try {
      const res = await fetch("/api/pharmacy/settings", { credentials: "include" })
      if (!res.ok) return
      const data = await res.json()
      setPharmacySettings(data.settings ?? null)
    } catch (err) {
      if (process.env.NODE_ENV === "development") {
        console.warn("[PharmacyContext] Error fetching pharmacy settings:", err)
      }
    }
  }, [])

  const updatePharmacySettings = useCallback(async (data: Partial<PharmacySettings>) => {
    const res = await fetch("/api/pharmacy/settings", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error((err as { error?: string }).error || "Failed to update settings")
    }
    const result = await res.json()
    setPharmacySettings(result.settings)
    return result.settings
  }, [])

  useEffect(() => {
    if (!hasPharmacyAccess) return
    ;(async () => {
      await refreshMedications()
      refreshSuppliers()
      refreshPurchaseOrders()
      refreshGrns()
      refreshPharmacySettings()
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasPharmacyAccess])

  // Removed localStorage persistence in favor of backend as source of truth

  const addMedication = async (medication: Omit<Medication, "id">) => {
    try {
      const res = await fetch("/api/pharmacy/medications", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: medication.name,
          category: medication.category,
          manufacturer: medication.manufacturer,
          stockQuantity: medication.stockQuantity,
          unitPrice: medication.unitPrice,
          costPrice: medication.costPrice,
          expiryDate: medication.expiryDate,
          reorderLevel: medication.reorderLevel,
          minStockLevel: medication.minStockLevel,
          maxStockLevel: medication.maxStockLevel,
          barcode: medication.barcode,
          is_controlled: medication.is_controlled,
          schedule_class: medication.schedule_class,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as { error?: string }).error || "Failed to add medication")
      }
      // Refresh medications from server to get the actual ID and ensure consistency
      await refreshMedications()
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("[PharmacyContext] Error adding medication:", error)
      }
      throw error
    }
  }

  const updateMedication = async (id: string, updates: Partial<Medication>) => {
    // Optimistic update
    setMedications(medications.map((m) => (m.id === id ? { ...m, ...updates } : m)))
    try {
      const payload = buildMedicationUpdatePayload(updates)
      const res = await fetch(`/api/pharmacy/medications/${encodeURIComponent(id)}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        // Refresh to ensure consistency
        await refreshMedications()
      }
    } catch (error) {
      // Refresh on error to restore correct state
      await refreshMedications()
    }
  }

  const deleteMedication = async (id: string): Promise<void> => {
    const res = await fetch(`/api/pharmacy/medications/${encodeURIComponent(id)}`, {
      method: "DELETE",
      credentials: "include",
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error((err as { error?: string }).error || "Failed to delete medication")
    }
    const res2 = await fetch("/api/pharmacy/medications", { credentials: "include" })
    if (res2.ok) {
      const data = await res2.json()
      const meds: Medication[] = (data.medications || []).map((m: any) => ({
        id: m.id,
        name: m.name,
        category: m.category,
        manufacturer: m.manufacturer || "",
        stockQuantity: Number(m.stock_quantity),
        unitPrice: Number(m.unit_price),
        costPrice: m.cost_price ? Number(m.cost_price) : undefined,
        expiryDate: m.expiry_date || "",
        batchNumber: "",
        reorderLevel: Number(m.reorder_level || 0),
        minStockLevel: m.min_stock_level ? Number(m.min_stock_level) : undefined,
        maxStockLevel: m.max_stock_level ? Number(m.max_stock_level) : undefined,
        lastRestockedAt: m.last_restocked_at || undefined,
        barcode: m.barcode || undefined,
      }))
      setMedications(meds)
    } else {
      setMedications([])
    }
  }

  const getMedication = (name: string) => {
    return medications.find((m) => m.name.toLowerCase() === name.toLowerCase())
  }

  const getLowStockMedications = () => {
    return medications.filter((m) => m.stockQuantity <= m.reorderLevel)
  }

  const getExpiringMedications = (days: number) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const futureDate = new Date(today)
    futureDate.setDate(futureDate.getDate() + days)
    return medications.filter((m) => {
      if (!m.expiryDate || String(m.expiryDate).trim() === "") return false
      const exp = new Date(m.expiryDate)
      if (Number.isNaN(exp.getTime())) return false
      return exp >= today && exp <= futureDate
    })
  }

  const adjustStock = (adjustment: Omit<StockAdjustment, "id" | "adjustedAt">) => {
    const newAdjustment: StockAdjustment = {
      ...adjustment,
      id: `ADJ${String(stockAdjustments.length + 1).padStart(4, "0")}`,
      adjustedAt: new Date().toISOString(),
    }

    const medication = medications.find((m) => m.id === adjustment.medicationId)
    if (medication) {
      let newQuantity = medication.stockQuantity
      if (adjustment.adjustmentType === "add") {
        newQuantity += adjustment.quantity
      } else if (adjustment.adjustmentType === "remove") {
        newQuantity -= adjustment.quantity
      } else {
        newQuantity = adjustment.quantity
      }

      updateMedication(medication.id, { stockQuantity: Math.max(0, newQuantity) })
    }

    setStockAdjustments([...stockAdjustments, newAdjustment])
  }

  const sendLowStockAlerts = async () => {
    const lowStockMeds = getLowStockMedications()
    if (lowStockMeds.length === 0) return

    const html = `
      <h2>Low Stock Alert - ${ORG_NAME}</h2>
      <p>The following medications are running low on stock:</p>
      <table style="border-collapse: collapse; width: 100%;">
        <thead>
          <tr style="background-color: #f3f4f6;">
            <th style="border: 1px solid #ddd; padding: 8px;">Medication</th>
            <th style="border: 1px solid #ddd; padding: 8px;">Current Stock</th>
            <th style="border: 1px solid #ddd; padding: 8px;">Reorder Level</th>
            <th style="border: 1px solid #ddd; padding: 8px;">Batch</th>
          </tr>
        </thead>
        <tbody>
          ${lowStockMeds
            .map(
              (med) => `
            <tr>
              <td style="border: 1px solid #ddd; padding: 8px;">${med.name}</td>
              <td style="border: 1px solid #ddd; padding: 8px; color: red;">${med.stockQuantity} units</td>
              <td style="border: 1px solid #ddd; padding: 8px;">${med.reorderLevel} units</td>
              <td style="border: 1px solid #ddd; padding: 8px;">${med.batchNumber}</td>
            </tr>
          `,
            )
            .join("")}
        </tbody>
      </table>
      <p>Please create purchase orders to restock these medications.</p>
    `

    try {
      await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: process.env.NOTIFY_TO || ORG_EMAIL,
          subject: "Low Stock Alert - Pharmacy Inventory",
          html,
        }),
      })
    } catch (error) {
      console.error("[v0] Failed to send low stock alert:", error)
    }
  }

  const sendExpiryAlerts = async () => {
    const expiringMeds = getExpiringMedications(90) // 90 days
    if (expiringMeds.length === 0) return

    const html = `
      <h2>Medication Expiry Alert - ${ORG_NAME}</h2>
      <p>The following medications will expire within the next 90 days:</p>
      <table style="border-collapse: collapse; width: 100%;">
        <thead>
          <tr style="background-color: #f3f4f6;">
            <th style="border: 1px solid #ddd; padding: 8px;">Medication</th>
            <th style="border: 1px solid #ddd; padding: 8px;">Expiry Date</th>
            <th style="border: 1px solid #ddd; padding: 8px;">Stock Quantity</th>
            <th style="border: 1px solid #ddd; padding: 8px;">Batch</th>
          </tr>
        </thead>
        <tbody>
          ${expiringMeds
            .map(
              (med) => `
            <tr>
              <td style="border: 1px solid #ddd; padding: 8px;">${med.name}</td>
              <td style="border: 1px solid #ddd; padding: 8px; color: orange;">${med.expiryDate}</td>
              <td style="border: 1px solid #ddd; padding: 8px;">${med.stockQuantity} units</td>
              <td style="border: 1px solid #ddd; padding: 8px;">${med.batchNumber}</td>
            </tr>
          `,
            )
            .join("")}
        </tbody>
      </table>
      <p>Please review and take appropriate action for these medications.</p>
    `

    try {
      await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: process.env.NOTIFY_TO || ORG_EMAIL,
          subject: "Medication Expiry Alert - Pharmacy Inventory",
          html,
        }),
      })
    } catch (error) {
      console.error("[v0] Failed to send expiry alert:", error)
    }
  }

  return (
    <PharmacyContext.Provider
      value={{
        medications,
        suppliers,
        purchaseOrders,
        stockAdjustments,
        grns,
        pharmacySettings,
        addMedication,
        updateMedication,
        deleteMedication,
        getMedication,
        getLowStockMedications,
        getExpiringMedications,
        refreshMedications,
        refreshSuppliers,
        refreshPurchaseOrders,
        createPurchaseOrder,
        approvePurchaseOrder,
        cancelPurchaseOrder,
        refreshGrns,
        createGrn,
        refreshPharmacySettings,
        updatePharmacySettings,
        adjustStock,
        sendLowStockAlerts,
        sendExpiryAlerts,
      }}
    >
      {children}
    </PharmacyContext.Provider>
  )
}

export function usePharmacy() {
  const context = useContext(PharmacyContext)
  if (context === undefined) {
    throw new Error("usePharmacy must be used within a PharmacyProvider")
  }
  return context
}
