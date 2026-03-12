"use client"

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react"
import { useAuth } from "@/lib/auth-context"
import { can } from "@/lib/security"

export interface BillItem {
  description: string
  quantity: number
  unitPrice: number
  total: number
  /** Distinguishes medication (unit price) vs service (total-based) */
  itemType?: "medication" | "service"
  /** Service category when itemType is "service" */
  serviceCategory?: string
}

export interface Bill {
  id: string
  billNumber?: string
  patientId: string
  patientNumber?: string
  patientName: string
  patientPhone?: string
  patientEmail?: string
  date: string
  items: BillItem[]
  subtotal: number
  tax: number
  discount: number
  total: number
  paidAmount?: number
  status: "pending" | "paid" | "partially paid" | "cancelled"
  paymentMethod?: string
  paymentDate?: string
  notes?: string
  barcode?: string
  dueDate?: string
}

interface BillingContextType {
  bills: Bill[]
  addBill: (bill: Omit<Bill, "id">) => void
  updateBill: (id: string, updates: Partial<Bill>) => void
  refreshBills: () => Promise<Bill[]>
  getBill: (id: string) => Bill | undefined
  getPatientBills: (patientId: string) => Bill[]
  getPendingBills: () => Bill[]
  getOverdueBills: () => Bill[]
  getPartiallyPaidBills: () => Bill[]
}

const BillingContext = createContext<BillingContextType | undefined>(undefined)

export function BillingProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [bills, setBills] = useState<Bill[]>([])

  const refreshBills = useCallback(async (): Promise<Bill[]> => {
    try {
      const res = await fetch("/api/billing", { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        const itemsByBillId = new Map<string, BillItem[]>()
        ;(data.items || []).forEach((row: any) => {
          const billId = row.bill_id as string
          const arr = itemsByBillId.get(billId) || []
          arr.push({
            description: row.description,
            quantity: Number(row.quantity) || 1,
            unitPrice: Number(row.unit_price) || 0,
            total: Number(row.total_price) || 0,
          })
          itemsByBillId.set(billId, arr)
        })

        const mapped: Bill[] = (data.bills || []).map((b: any) => {
          const status = (b.status || "Pending").toString().toLowerCase()
          const paidAmount = Number(b.paid_amount) || 0
          const finalAmount = Number(b.final_amount)
          
          // Determine status based on paid amount
          let normalizedStatus: "pending" | "paid" | "partially paid" | "cancelled" = status as any
          if (status === "pending" && paidAmount > 0 && paidAmount < finalAmount) {
            normalizedStatus = "partially paid"
          } else if (status === "pending" && paidAmount >= finalAmount) {
            normalizedStatus = "paid"
          }
          
          return {
            id: b.id,
            billNumber: b.bill_number,
            patientId: b.patient_id,
            patientNumber: b.patient_number,
            patientName: `${b.first_name} ${b.last_name}`.trim(),
            patientPhone: b.phone || undefined,
            patientEmail: b.email || undefined,
            date: new Date(b.created_at).toISOString().slice(0, 10),
            items: itemsByBillId.get(b.id) || [],
            subtotal: Number(b.total_amount) - Number(b.tax_amount) + Number(b.discount_amount || 0),
            tax: Number(b.tax_amount),
            discount: Number(b.discount_amount) || 0,
            total: finalAmount,
            paidAmount: Number(b.paid_amount) || 0,
            status: normalizedStatus,
            paymentMethod: b.payment_method || undefined,
            paymentDate: b.paid_at
              ? new Date(b.paid_at).toLocaleDateString("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" })
              : undefined,
            barcode: b.barcode || undefined,
            dueDate: b.due_date ? new Date(b.due_date).toISOString().slice(0, 10) : undefined,
          }
        })
        setBills(mapped)
        return mapped
      } else {
        setBills([])
        return []
      }
    } catch {
      setBills([])
      return []
    }
  }, [])

  useEffect(() => {
    if (!user || !can(user.role, "billing", "read")) return
    void refreshBills()
  }, [user, refreshBills])

  const addBill = (bill: Omit<Bill, "id">) => {
    const newBill: Bill = {
      ...bill,
      id: `INV${String(bills.length + 1).padStart(3, "0")}`,
    }
    setBills([...bills, newBill])
  }

  const updateBill = (id: string, updates: Partial<Bill>) => {
    setBills(bills.map((b) => (b.id === id ? { ...b, ...updates } : b)))
  }

  const getBill = (id: string) => {
    return bills.find((b) => b.id === id)
  }

  const getPatientBills = (patientId: string) => {
    return bills.filter((b) => b.patientId === patientId)
  }

  const getPendingBills = () => {
    return bills.filter((b) => b.status === "pending")
  }

  const getOverdueBills = () => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    return bills.filter((b) => {
      if (b.status === "paid" || b.status === "cancelled") return false
      
      // Consider bills overdue if they're pending/partially paid and older than 30 days
      const billDate = new Date(b.date)
      billDate.setHours(0, 0, 0, 0)
      const daysDiff = Math.floor((today.getTime() - billDate.getTime()) / (1000 * 60 * 60 * 24))
      
      return daysDiff > 30
    })
  }

  const getPartiallyPaidBills = () => {
    return bills.filter((b) => b.status === "partially paid")
  }

  return (
    <BillingContext.Provider
      value={{
        bills,
        addBill,
        updateBill,
        refreshBills,
        getBill,
        getPatientBills,
        getPendingBills,
        getOverdueBills,
        getPartiallyPaidBills,
      }}
    >
      {children}
    </BillingContext.Provider>
  )
}

export function useBilling() {
  const context = useContext(BillingContext)
  if (context === undefined) {
    throw new Error("useBilling must be used within a BillingProvider")
  }
  return context
}
