"use client"

import { createContext, useContext, type ReactNode } from "react"
import { useBilling } from "./billing-context"
import { usePatients } from "./patient-context"

export interface RevenueByDepartment {
  department: string
  revenue: number
  percentage: number
}

export interface RevenueByPaymentMethod {
  method: string
  amount: number
  count: number
}

export interface DailyRevenue {
  date: string
  revenue: number
}

export interface TopService {
  service: string
  revenue: number
  count: number
}

interface AnalyticsContextType {
  getTotalRevenue: (startDate?: string, endDate?: string) => number
  getRevenueByDepartment: (startDate?: string, endDate?: string) => RevenueByDepartment[]
  getRevenueByPaymentMethod: (startDate?: string, endDate?: string) => RevenueByPaymentMethod[]
  getDailyRevenue: (days: number) => DailyRevenue[]
  getTopServices: (limit: number) => TopService[]
  getOutstandingBalance: () => number
  getPatientVisitStats: (days: number) => { date: string; visits: number }[]
  getAverageTransactionValue: () => number
}

const AnalyticsContext = createContext<AnalyticsContextType | undefined>(undefined)

export function AnalyticsProvider({ children }: { children: ReactNode }) {
  const { bills } = useBilling()
  const { appointments } = usePatients()

  const getTotalRevenue = (startDate?: string, endDate?: string) => {
    return bills
      .filter((b) => {
        if (b.status !== "paid") return false
        if (startDate && b.paymentDate && b.paymentDate < startDate) return false
        if (endDate && b.paymentDate && b.paymentDate > endDate) return false
        return true
      })
      .reduce((sum, b) => sum + b.total, 0)
  }

  const getRevenueByDepartment = (startDate?: string, endDate?: string) => {
    const filteredBills = bills.filter((b) => {
      if (b.status !== "paid") return false
      if (startDate && b.paymentDate && b.paymentDate < startDate) return false
      if (endDate && b.paymentDate && b.paymentDate > endDate) return false
      return true
    })

    const departmentRevenue: Record<string, number> = {}

    filteredBills.forEach((bill) => {
      bill.items.forEach((item) => {
        let department = "Other"
        if (item.description.toLowerCase().includes("consultation")) department = "Consultation"
        else if (item.description.toLowerCase().includes("lab") || item.description.toLowerCase().includes("blood"))
          department = "Laboratory"
        else if (
          item.description.toLowerCase().includes("x-ray") ||
          item.description.toLowerCase().includes("scan") ||
          item.description.toLowerCase().includes("ct") ||
          item.description.toLowerCase().includes("mri")
        )
          department = "Radiology"
        else if (
          item.description.toLowerCase().includes("medication") ||
          item.description.toLowerCase().includes("drug") ||
          /$$\d+\s*days?$$/.test(item.description)
        )
          department = "Pharmacy"

        departmentRevenue[department] = (departmentRevenue[department] || 0) + item.total
      })
    })

    const total = Object.values(departmentRevenue).reduce((sum, val) => sum + val, 0)

    return Object.entries(departmentRevenue).map(([department, revenue]) => ({
      department,
      revenue,
      percentage: total > 0 ? (revenue / total) * 100 : 0,
    }))
  }

  const getRevenueByPaymentMethod = (startDate?: string, endDate?: string) => {
    const filteredBills = bills.filter((b) => {
      if (b.status !== "paid") return false
      if (startDate && b.paymentDate && b.paymentDate < startDate) return false
      if (endDate && b.paymentDate && b.paymentDate > endDate) return false
      return true
    })

    const methodStats: Record<string, { amount: number; count: number }> = {}

    filteredBills.forEach((bill) => {
      const method = bill.paymentMethod || "Unknown"
      if (!methodStats[method]) {
        methodStats[method] = { amount: 0, count: 0 }
      }
      methodStats[method].amount += bill.total
      methodStats[method].count += 1
    })

    return Object.entries(methodStats).map(([method, stats]) => ({
      method,
      amount: stats.amount,
      count: stats.count,
    }))
  }

  const getDailyRevenue = (days: number) => {
    const result: DailyRevenue[] = []
    const today = new Date()

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(today)
      date.setDate(date.getDate() - i)
      const dateStr = date.toISOString().split("T")[0]

      const dayRevenue = bills
        .filter((b) => b.status === "paid" && b.paymentDate === dateStr)
        .reduce((sum, b) => sum + b.total, 0)

      result.push({ date: dateStr, revenue: dayRevenue })
    }

    return result
  }

  const getTopServices = (limit: number) => {
    const serviceStats: Record<string, { revenue: number; count: number }> = {}

    bills
      .filter((b) => b.status === "paid")
      .forEach((bill) => {
        bill.items.forEach((item) => {
          if (!serviceStats[item.description]) {
            serviceStats[item.description] = { revenue: 0, count: 0 }
          }
          serviceStats[item.description].revenue += item.total
          serviceStats[item.description].count += item.quantity
        })
      })

    return Object.entries(serviceStats)
      .map(([service, stats]) => ({
        service,
        revenue: stats.revenue,
        count: stats.count,
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, limit)
  }

  const getOutstandingBalance = () => {
    return bills.filter((b) => b.status === "pending").reduce((sum, b) => sum + b.total, 0)
  }

  const getPatientVisitStats = (days: number) => {
    const result: { date: string; visits: number }[] = []
    const today = new Date()

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(today)
      date.setDate(date.getDate() - i)
      const dateStr = date.toISOString().split("T")[0]

      const visits = appointments.filter((a) => a.date === dateStr).length

      result.push({ date: dateStr, visits })
    }

    return result
  }

  const getAverageTransactionValue = () => {
    const paidBills = bills.filter((b) => b.status === "paid")
    if (paidBills.length === 0) return 0
    return paidBills.reduce((sum, b) => sum + b.total, 0) / paidBills.length
  }

  return (
    <AnalyticsContext.Provider
      value={{
        getTotalRevenue,
        getRevenueByDepartment,
        getRevenueByPaymentMethod,
        getDailyRevenue,
        getTopServices,
        getOutstandingBalance,
        getPatientVisitStats,
        getAverageTransactionValue,
      }}
    >
      {children}
    </AnalyticsContext.Provider>
  )
}

export function useAnalytics() {
  const context = useContext(AnalyticsContext)
  if (context === undefined) {
    throw new Error("useAnalytics must be used within an AnalyticsProvider")
  }
  return context
}
