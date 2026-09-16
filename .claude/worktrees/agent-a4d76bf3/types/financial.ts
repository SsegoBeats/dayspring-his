export interface FinancialSummary {
  totalRevenue: number
  outstandingBalance: number
  avgTransactionValue: number
  paidTransactions: number
  pendingTransactions: number
  activePaymentMethods: number
  revenueGrowth: number
}

export interface DailyRevenue {
  date: string
  revenue: number
  transactions: number
}

export interface DepartmentRevenue {
  department: string
  revenue: number
  transactions: number
}

export interface PaymentMethodRevenue {
  paymentMethod: string
  revenue: number
  transactions: number
}

export interface TopService {
  service: string
  revenue: number
  count: number
}

export interface PatientVisit {
  date: string
  visits: number
}

export interface FinancialData {
  summary: FinancialSummary
  dailyRevenue: DailyRevenue[]
  revenueByDepartment: DepartmentRevenue[]
  revenueByPaymentMethod: PaymentMethodRevenue[]
  topServices: TopService[]
  patientVisits: PatientVisit[]
}

export interface FinancialReportPayload {
  hospitalName: string
  logoUrl?: string
  periodLabel: string
  period?: "7days" | "30days" | "90days"
  startDate?: string
  endDate?: string
  generatedAtISO: string
  data: FinancialData
  generatedBy?: string
}


