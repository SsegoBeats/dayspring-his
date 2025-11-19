"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"

export interface Medication {
  id: string
  name: string
  category: string
  manufacturer: string
  stockQuantity: number
  unitPrice: number
  expiryDate: string
  batchNumber: string
  reorderLevel: number
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
  deleteMedication: (id: string) => void
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
  const [medications, setMedications] = useState<Medication[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([])
  const [stockAdjustments, setStockAdjustments] = useState<StockAdjustment[]>([])

  useEffect(() => {
    ;(async () => {
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
            expiryDate: m.expiry_date || "",
            batchNumber: "",
            reorderLevel: Number(m.reorder_level || 0),
            barcode: m.barcode || undefined,
          }))
          setMedications(meds)
        } else {
          setMedications([])
        }
      } catch {
        setMedications([])
      }
      // Suppliers are loaded from backend once related APIs are wired
      setSuppliers([])
    })()
  }, [])

  // Removed localStorage persistence in favor of backend as source of truth

  const addMedication = (medication: Omit<Medication, "id">) => {
    const newMedication: Medication = {
      ...medication,
      id: `MED${String(medications.length + 1).padStart(3, "0")}`,
    }
    setMedications([...medications, newMedication])
    ;(async () => {
      try {
        await fetch("/api/pharmacy/medications", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: medication.name,
            category: medication.category,
            manufacturer: medication.manufacturer,
            stockQuantity: medication.stockQuantity,
            unitPrice: medication.unitPrice,
            expiryDate: medication.expiryDate,
            reorderLevel: medication.reorderLevel,
            barcode: medication.barcode,
          }),
        })
      } catch {
        // ignore – local optimistic update already applied
      }
    })()
  }

  const updateMedication = (id: string, updates: Partial<Medication>) => {
    setMedications(medications.map((m) => (m.id === id ? { ...m, ...updates } : m)))
    ;(async () => {
      try {
        await fetch(`/api/pharmacy/medications/${encodeURIComponent(id)}`, {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: updates.name,
            category: updates.category,
            manufacturer: updates.manufacturer,
            stockQuantity: updates.stockQuantity,
            unitPrice: updates.unitPrice,
            expiryDate: updates.expiryDate,
            reorderLevel: updates.reorderLevel,
            barcode: updates.barcode,
          }),
        })
      } catch {
        // ignore
      }
    })()
  }

  const deleteMedication = (id: string) => {
    ;(async () => {
      try {
        const res = await fetch(`/api/pharmacy/medications/${encodeURIComponent(id)}`, {
          method: "DELETE",
          credentials: "include",
        })
        // Always reload from backend so UI reflects actual DB state
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
            expiryDate: m.expiry_date || "",
            batchNumber: "",
            reorderLevel: Number(m.reorder_level || 0),
            barcode: m.barcode || undefined,
          }))
          setMedications(meds)
        } else {
          setMedications([])
        }
      } catch {
        // On error, force a reload attempt so we never show phantom deletes
        try {
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
              expiryDate: m.expiry_date || "",
              batchNumber: "",
              reorderLevel: Number(m.reorder_level || 0),
              barcode: m.barcode || undefined,
            }))
            setMedications(meds)
          }
        } catch {
          // final fallback: leave current state as-is
        }
      }
    })()
  }

  const getMedication = (name: string) => {
    return medications.find((m) => m.name.toLowerCase() === name.toLowerCase())
  }

  const getLowStockMedications = () => {
    return medications.filter((m) => m.stockQuantity <= m.reorderLevel)
  }

  const getExpiringMedications = (days: number) => {
    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + days)
    return medications.filter((m) => new Date(m.expiryDate) <= futureDate && new Date(m.expiryDate) >= new Date())
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
      <h2>Low Stock Alert - Dayspring Medical Center</h2>
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
          to: process.env.NOTIFY_TO || "dayspringmedicalcenter@gmail.com",
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
      <h2>Medication Expiry Alert - Dayspring Medical Center</h2>
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
          to: process.env.NOTIFY_TO || "dayspringmedicalcenter@gmail.com",
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
