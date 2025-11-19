"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"

export interface BillItem {
  description: string
  quantity: number
  unitPrice: number
  total: number
}

export interface Bill {
  id: string
  billNumber?: string
  patientId: string
  patientName: string
  date: string
  items: BillItem[]
  subtotal: number
  tax: number
  total: number
  status: "pending" | "paid" | "cancelled"
  paymentMethod?: string
  paymentDate?: string
  notes?: string
  barcode?: string
}

interface BillingContextType {
  bills: Bill[]
  addBill: (bill: Omit<Bill, "id">) => void
  updateBill: (id: string, updates: Partial<Bill>) => void
  getBill: (id: string) => Bill | undefined
  getPatientBills: (patientId: string) => Bill[]
  getPendingBills: () => Bill[]
}

const BillingContext = createContext<BillingContextType | undefined>(undefined)

export function BillingProvider({ children }: { children: ReactNode }) {
  const [bills, setBills] = useState<Bill[]>([])

  useEffect(() => {
    ;(async () => {
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

          const mapped: Bill[] = (data.bills || []).map((b: any) => ({
            id: b.id,
            billNumber: b.bill_number,
            patientId: b.patient_id,
            patientName: `${b.first_name} ${b.last_name}`.trim(),
            date: new Date(b.created_at).toISOString().slice(0, 10),
            items: itemsByBillId.get(b.id) || [],
            subtotal: Number(b.total_amount) - Number(b.tax_amount) + Number(b.discount_amount || 0),
            tax: Number(b.tax_amount),
            total: Number(b.final_amount),
            status: (b.status || "Pending").toString().toLowerCase() as any,
            paymentMethod: b.payment_method || undefined,
            paymentDate: b.paid_at ? new Date(b.paid_at).toISOString().slice(0, 10) : undefined,
            barcode: b.barcode || undefined,
          }))
          setBills(mapped)
        } else {
          setBills([])
        }
      } catch {
        setBills([])
      }
    })()
  }, [])

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

  return (
    <BillingContext.Provider
      value={{
        bills,
        addBill,
        updateBill,
        getBill,
        getPatientBills,
        getPendingBills,
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
