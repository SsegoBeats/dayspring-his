"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import { useAuth } from "@/lib/auth-context"
import { can } from "@/lib/security"
import { ORG_NAME, ORG_EMAIL } from "@/lib/org-constants"

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
}

export interface Supplier {
  id: string
  name: string
  contactPerson: string
  email: string
  phone: string
  address: string
  medications: string[]
}

export interface PurchaseOrder {
  id: string
  supplierId: string
  orderDate: string
  expectedDeliveryDate: string
  status: "pending" | "approved" | "received" | "cancelled"
  items: {
    medicationId: string
    medicationName: string
    quantity: number
    unitPrice: number
    batchNumber?: string
    expiryDate?: string
  }[]
  totalAmount: number
  notes?: string
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
  addMedication: (medication: Omit<Medication, "id">) => void
  updateMedication: (id: string, updates: Partial<Medication>) => void
  deleteMedication: (id: string) => Promise<void>
  getMedication: (name: string) => Medication | undefined
  getLowStockMedications: () => Medication[]
  getExpiringMedications: (days: number) => Medication[]
  addSupplier: (supplier: Omit<Supplier, "id">) => void
  updateSupplier: (id: string, updates: Partial<Supplier>) => void
  createPurchaseOrder: (order: Omit<PurchaseOrder, "id">) => void
  updatePurchaseOrder: (id: string, updates: Partial<PurchaseOrder>) => void
  receivePurchaseOrder: (orderId: string) => void
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

  useEffect(() => {
    if (!hasPharmacyAccess) return
    ;(async () => {
      await refreshMedications()
      // Suppliers are loaded from backend once related APIs are wired
      setSuppliers([])
    })()
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
        }),
      })
      if (res.ok) {
        // Refresh medications from server to get the actual ID
        await refreshMedications()
      } else {
        // Optimistic update if server fails
        const newMedication: Medication = {
          ...medication,
          id: `MED${String(medications.length + 1).padStart(3, "0")}`,
        }
        setMedications([...medications, newMedication])
      }
    } catch (error) {
      // Optimistic update on error
      const newMedication: Medication = {
        ...medication,
        id: `MED${String(medications.length + 1).padStart(3, "0")}`,
      }
      setMedications([...medications, newMedication])
    }
  }

  const updateMedication = async (id: string, updates: Partial<Medication>) => {
    // Optimistic update
    setMedications(medications.map((m) => (m.id === id ? { ...m, ...updates } : m)))
    try {
      const res = await fetch(`/api/pharmacy/medications/${encodeURIComponent(id)}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: updates.name,
          category: updates.category,
          manufacturer: updates.manufacturer,
          stockQuantity: updates.stockQuantity,
          unitPrice: updates.unitPrice,
          costPrice: updates.costPrice,
          expiryDate: updates.expiryDate,
          reorderLevel: updates.reorderLevel,
          minStockLevel: updates.minStockLevel,
          maxStockLevel: updates.maxStockLevel,
          barcode: updates.barcode,
        }),
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

  const addSupplier = (supplier: Omit<Supplier, "id">) => {
    const newSupplier: Supplier = {
      ...supplier,
      id: `SUP${String(suppliers.length + 1).padStart(3, "0")}`,
    }
    setSuppliers([...suppliers, newSupplier])
  }

  const updateSupplier = (id: string, updates: Partial<Supplier>) => {
    setSuppliers(suppliers.map((s) => (s.id === id ? { ...s, ...updates } : s)))
  }

  const createPurchaseOrder = (order: Omit<PurchaseOrder, "id">) => {
    const newOrder: PurchaseOrder = {
      ...order,
      id: `PO${String(purchaseOrders.length + 1).padStart(4, "0")}`,
    }
    setPurchaseOrders([...purchaseOrders, newOrder])
  }

  const updatePurchaseOrder = (id: string, updates: Partial<PurchaseOrder>) => {
    setPurchaseOrders(purchaseOrders.map((po) => (po.id === id ? { ...po, ...updates } : po)))
  }

  const receivePurchaseOrder = (orderId: string) => {
    const order = purchaseOrders.find((po) => po.id === orderId)
    if (!order) return

    // Update medication stock
    order.items.forEach((item) => {
      const medication = medications.find((m) => m.id === item.medicationId)
      if (medication) {
        updateMedication(medication.id, {
          stockQuantity: medication.stockQuantity + item.quantity,
          batchNumber: item.batchNumber || medication.batchNumber,
          expiryDate: item.expiryDate || medication.expiryDate,
        })
      }
    })

    // Update order status
    updatePurchaseOrder(orderId, { status: "received" })
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
        addMedication,
        updateMedication,
        deleteMedication,
        getMedication,
        getLowStockMedications,
        getExpiringMedications,
        addSupplier,
        updateSupplier,
        createPurchaseOrder,
        updatePurchaseOrder,
        receivePurchaseOrder,
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
