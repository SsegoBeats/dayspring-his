"use client"

import React, { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown,
  CreditCard, 
  AlertCircle, 
  Download,
  RefreshCw,
  Calendar,
  Users,
  Activity,
  BarChart3,
  PieChart
} from "lucide-react"
import { useFormatCurrency } from "@/lib/settings-context"
import { useFormatDate } from "@/lib/date-utils"
import {
  Bar,
  BarChart,
  Line,
  LineChart,
  Pie,
  PieChart as RePieChart,
  Cell,
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { ExportPdfButton } from "@/components/reports/ExportPdfButton"

// Custom chart container that bypasses ResponsiveContainer issues
const FixedChartContainer = ({ 
  children, 
  height = 400, 
  width = '100%',
  config 
}: { 
  children: React.ReactNode, 
  height?: number, 
  width?: string | number,
  config: any
}) => {
  const containerStyle = {
    width: typeof width === 'number' ? `${width}px` : width,
    height: `${height}px`,
    minHeight: `${height}px`,
    minWidth: typeof width === 'number' ? `${width}px` : '100%'
  }

  return (
    <div style={containerStyle}>
      <div style={{ width: '100%', height: '100%' }}>
        {React.cloneElement(children as React.ReactElement, {
          width: typeof width === 'number' ? width : undefined,
          height: height
        })}
      </div>
    </div>
  )
}
import { toast } from "@/hooks/use-toast"

const COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "hsl(var(--chart-6))",
  "hsl(var(--chart-7))",
  "hsl(var(--chart-8))",
]

interface FinancialSummary {
  totalRevenue: number
  outstandingBalance: number
  avgTransactionValue: number
  paidTransactions: number
  pendingTransactions: number
  activePaymentMethods: number
  revenueGrowth: number
}

interface DailyRevenue {
  date: string
  revenue: number
  transactions: number
}

interface DepartmentRevenue {
  department: string
  revenue: number
  transactions: number
}

interface PaymentMethodRevenue {
  paymentMethod: string
  revenue: number
  transactions: number
}

interface TopService {
  service: string
  revenue: number
  count: number
}

interface PatientVisit {
  date: string
  visits: number
}

interface FinancialData {
  summary: FinancialSummary
  dailyRevenue: DailyRevenue[]
  revenueByDepartment: DepartmentRevenue[]
  revenueByPaymentMethod: PaymentMethodRevenue[]
  topServices: TopService[]
  patientVisits: PatientVisit[]
}

export function FinancialReports() {
  const formatCurrency = useFormatCurrency()
  const { formatDate } = useFormatDate()
  const [period, setPeriod] = useState<"7days" | "30days" | "90days">("30days")
  const [activeTab, setActiveTab] = useState("revenue")
  const [data, setData] = useState<FinancialData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const fetchFinancialData = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const response = await fetch(`/api/analytics/financial?period=${period}`, {
        credentials: "include"
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        
        // Handle specific authentication errors
        if (response.status === 401) {
          if (errorData.error === "Authentication required") {
            throw new Error("Please log in to access financial analytics")
          } else if (errorData.error === "Invalid token") {
            throw new Error("Your session has expired. Please log in again")
          } else if (errorData.error === "User not found or inactive") {
            throw new Error("Your account is inactive. Please contact an administrator")
          }
        } else if (response.status === 403) {
          throw new Error("You don't have permission to access financial analytics. Only Hospital Admin and Cashier roles can view this data.")
        }
        
        throw new Error(errorData.error || "Failed to fetch financial data")
      }
      
      const financialData = await response.json()
      setData(financialData)
      setLastUpdated(new Date())
      
    } catch (err: any) {
      console.error("Error fetching financial data:", err)
      setError(err.message || "Failed to load financial data")
      toast({
        title: "Error",
        description: err.message || "Failed to load financial data",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchFinancialData()
  }, [period])

  // Use `formatDate` from `useFormatDate` for all chart/date formatting


  const getGrowthIcon = (growth: number) => {
    return growth >= 0 ? (
      <TrendingUp className="h-4 w-4 text-green-600" />
    ) : (
      <TrendingDown className="h-4 w-4 text-red-600" />
    )
  }

  const getGrowthColor = (growth: number) => {
    return growth >= 0 ? "text-green-600" : "text-red-600"
  }

  const exportData = async (format: 'csv' | 'xlsx' | 'pdf') => {
    if (!data) return
    
    try {
      const response = await fetch('/api/exports/direct', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          dataset: 'billing',
          format,
          filters: {
            from: (period === '7days' ? 
              new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) :
              period === '30days' ? 
                new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) :
                new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)).toISOString(),
            to: new Date().toISOString()
          }
        })
      })

      if (!response.ok) {
        throw new Error('Export failed')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `financial-report-${period}-${new Date().toISOString().split('T')[0]}.${format}`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      toast({
        title: "Export Successful",
        description: `Financial report exported as ${format.toUpperCase()}`
      })
    } catch (err: any) {
      toast({
        title: "Export Failed",
        description: err.message || "Failed to export financial report",
        variant: "destructive"
      })
    }
  }

  if (loading && !data) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">Financial Reports & Analytics</h2>
            <p className="text-muted-foreground">Comprehensive financial insights and performance metrics</p>
          </div>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">Loading financial data...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">Financial Reports & Analytics</h2>
            <p className="text-muted-foreground">Comprehensive financial insights and performance metrics</p>
          </div>
        </div>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-2">
              <p>{error}</p>
              {error?.includes("permission") && (
                <p className="text-sm text-muted-foreground">
                  To access financial analytics, you need to be logged in as a Hospital Admin or Cashier.
                </p>
              )}
              {error?.includes("log in") && (
                <p className="text-sm text-muted-foreground">
                  Please log in with your Hospital Admin or Cashier credentials.
                </p>
              )}
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={fetchFinancialData}
              className="ml-4"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Financial Reports & Analytics</h2>
          <p className="text-muted-foreground">Comprehensive financial insights and performance metrics</p>
          {lastUpdated && (
            <p className="text-xs text-muted-foreground mt-1">
              Last updated: {formatDate(lastUpdated, { 
                year: 'numeric', 
                month: 'short', 
                day: 'numeric', 
                hour: '2-digit', 
                minute: '2-digit' 
              })}
            </p>
          )}
          <p className="mt-1 text-xs text-muted-foreground">
            {data.summary.totalRevenue === 0 && data.summary.outstandingBalance === 0
              ? "No financial activity recorded for this period. New invoices and payments will appear here."
              : data.summary.revenueGrowth > 0
              ? "Revenue is trending up compared to the previous period."
              : data.summary.revenueGrowth < 0
              ? "Revenue is below the previous period; review billing and collections."
              : "Revenue is stable compared to the previous period."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchFinancialData}
            disabled={loading}
            title="Reload financial metrics for the selected period"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportData('csv')}
            title="Export billing transactions as CSV for this period"
          >
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          {data && (
            <ExportPdfButton
              size="sm"
              hospitalName="Dayspring Medical Center - Information System"
              logoUrl="/logo0.png"
              periodLabel={
                period === '7days' ? 'Last 7 Days' : period === '30days' ? 'Last 30 Days' : 'Last 90 Days'
              }
              period={period}
              data={data}
              generatedBy="Admin Dashboard"
            />
          )}
        </div>
      </div>

      {/* Period Selector */}
      <div className="inline-flex rounded-full bg-muted/60 p-1">
        <Button
          variant="ghost"
          size="sm"
          className={period === "7days" ? "bg-background shadow-sm text-slate-900" : "text-muted-foreground"}
          onClick={() => setPeriod("7days")}
        >
          7 Days
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className={period === "30days" ? "bg-background shadow-sm text-slate-900" : "text-muted-foreground"}
          onClick={() => setPeriod("30days")}
        >
          30 Days
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className={period === "90days" ? "bg-background shadow-sm text-slate-900" : "text-muted-foreground"}
          onClick={() => setPeriod("90days")}
        >
          90 Days
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="hover:shadow-sm transition-shadow border-emerald-100 bg-emerald-50/40">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-emerald-700">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold text-slate-900">{formatCurrency(data.summary.totalRevenue)}</div>
            <div className="mt-1 flex items-center gap-1.5 text-xs">
              {getGrowthIcon(data.summary.revenueGrowth)}
              <span className={getGrowthColor(data.summary.revenueGrowth)}>
                {data.summary.revenueGrowth >= 0 ? '+' : ''}{data.summary.revenueGrowth.toFixed(1)}%
              </span>
              <span className="text-muted-foreground">vs previous period</span>
            </div>
            <div className="mt-2 h-1.5 w-full rounded-full bg-gradient-to-r from-emerald-400 via-sky-400 to-indigo-400 opacity-80" />
          </CardContent>
        </Card>

        <Card className="hover:shadow-sm transition-shadow border-amber-100 bg-amber-50/40">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-amber-700">Outstanding Balance</CardTitle>
            <AlertCircle className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-semibold ${data.summary.outstandingBalance > 0 ? 'text-amber-700' : 'text-slate-900'}`}>{formatCurrency(data.summary.outstandingBalance)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {data.summary.pendingTransactions} pending payments
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-sm transition-shadow border-sky-100 bg-sky-50/40">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-sky-700">Avg Transaction</CardTitle>
            <TrendingUp className="h-4 w-4 text-sky-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold text-slate-900">{formatCurrency(data.summary.avgTransactionValue)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Per transaction
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-sm transition-shadow border-purple-100 bg-purple-50/40">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-purple-700">Payment Methods</CardTitle>
            <CreditCard className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold text-slate-900">{data.summary.activePaymentMethods}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Active methods
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-5 bg-muted/60 rounded-xl p-1">
          <TabsTrigger value="revenue" className="flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <BarChart3 className="h-4 w-4" />
            Revenue Trends
          </TabsTrigger>
          <TabsTrigger value="departments" className="flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <PieChart className="h-4 w-4" />
            By Department
          </TabsTrigger>
          <TabsTrigger value="payments" className="flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <CreditCard className="h-4 w-4" />
            Payment Methods
          </TabsTrigger>
          <TabsTrigger value="services" className="flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Activity className="h-4 w-4" />
            Top Services
          </TabsTrigger>
          <TabsTrigger value="visits" className="flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Users className="h-4 w-4" />
            Patient Visits
          </TabsTrigger>
        </TabsList>

        <TabsContent value="revenue" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Daily Revenue Trend</CardTitle>
              <CardDescription>Revenue collected over the selected period</CardDescription>
            </CardHeader>
            <CardContent>
              {data.dailyRevenue.length === 0 ? (
                <div className="flex h-64 flex-col items-center justify-center text-sm text-muted-foreground">
                  <BarChart3 className="mb-2 h-6 w-6" />
                  <p>Revenue data will appear here once billing transactions are recorded for this period.</p>
                </div>
              ) : (
                <FixedChartContainer 
                  height={400}
                  config={{
                    revenue: {
                      label: "Revenue",
                      color: "hsl(var(--chart-1))",
                    },
                    transactions: {
                      label: "Transactions",
                      color: "hsl(var(--chart-2))",
                    },
                  }}
                >
                  <BarChart data={data.dailyRevenue}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={formatDate}
                      tick={{ fontSize: 12 }}
                    />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip 
                      content={<ChartTooltipContent />}
                      formatter={(value, name) => [
                        name === 'revenue' ? formatCurrency(Number(value)) : value,
                        name === 'revenue' ? 'Revenue' : 'Transactions'
                      ]}
                    />
                    <Bar dataKey="revenue" fill="hsl(var(--chart-1))" radius={4} />
                  </BarChart>
                </FixedChartContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="departments" className="space-y-4">
          <Card>
            <CardHeader>
            <CardTitle>Revenue by Department</CardTitle>
            <CardDescription>Revenue distribution across hospital departments</CardDescription>
          </CardHeader>
          <CardContent>
            {data.revenueByDepartment.length === 0 ? (
              <div className="flex h-64 flex-col items-center justify-center text-sm text-muted-foreground">
                <PieChart className="mb-2 h-6 w-6" />
                <p>Department revenue will appear once bills are posted for this period.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <FixedChartContainer 
                  height={300}
                  config={{
                    revenue: {
                      label: "Revenue",
                    },
                  }}
                >
                    <RePieChart>
                      <Pie
                        data={data.revenueByDepartment}
                        dataKey="revenue"
                        nameKey="department"
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        label={({ department, revenue }) => 
                          `${department}: ${formatCurrency(revenue)}`
                        }
                      >
                        {data.revenueByDepartment.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                    </RePieChart>
                  </FixedChartContainer>
                <div className="space-y-2">
                  {data.revenueByDepartment.map((dept, index) => (
                      <div key={dept.department} className="flex items-center justify-between p-2 border rounded">
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: COLORS[index % COLORS.length] }}
                          />
                          <span className="font-medium">{dept.department}</span>
                        </div>
                        <div className="text-right">
                          <div className="font-bold">{formatCurrency(dept.revenue)}</div>
                          <div className="text-xs text-muted-foreground">{dept.transactions} transactions</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
            )}
          </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payments" className="space-y-4">
          <Card>
            <CardHeader>
            <CardTitle>Payment Methods</CardTitle>
            <CardDescription>Revenue breakdown by payment method</CardDescription>
          </CardHeader>
          <CardContent>
            {data.revenueByPaymentMethod.length === 0 ? (
              <div className="flex h-64 flex-col items-center justify-center text-sm text-muted-foreground">
                <CreditCard className="mb-2 h-6 w-6" />
                <p>Payment method breakdown will appear once payments are recorded for this period.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <FixedChartContainer 
                  height={300}
                  config={{
                    revenue: {
                      label: "Revenue",
                    },
                  }}
                >
                    <RePieChart>
                      <Pie
                        data={data.revenueByPaymentMethod}
                        dataKey="revenue"
                        nameKey="paymentMethod"
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        label={({ paymentMethod, revenue }) => 
                          `${paymentMethod}: ${formatCurrency(revenue)}`
                        }
                      >
                        {data.revenueByPaymentMethod.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                    </RePieChart>
                  </FixedChartContainer>
                <div className="space-y-2">
                  {data.revenueByPaymentMethod.map((method, index) => (
                      <div key={method.paymentMethod} className="flex items-center justify-between p-2 border rounded">
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: COLORS[index % COLORS.length] }}
                          />
                          <span className="font-medium">{method.paymentMethod}</span>
                        </div>
                        <div className="text-right">
                          <div className="font-bold">{formatCurrency(method.revenue)}</div>
                          <div className="text-xs text-muted-foreground">{method.transactions} transactions</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
            )}
          </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="services" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Top Services</CardTitle>
              <CardDescription>Most profitable services and procedures</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {data.topServices.map((service, index) => (
                  <div key={service.service} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-4">
                      <Badge variant="outline" className="w-8 h-8 rounded-full flex items-center justify-center">
                        {index + 1}
                      </Badge>
                      <div>
                        <div className="font-medium">{service.service}</div>
                        <div className="text-sm text-muted-foreground">{service.count} procedures</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-lg">{formatCurrency(service.revenue)}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatCurrency(service.revenue / service.count)} avg
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="visits" className="space-y-4">
          <Card>
            <CardHeader>
            <CardTitle>Patient Visits</CardTitle>
            <CardDescription>Daily patient visit trends</CardDescription>
          </CardHeader>
          <CardContent>
            <FixedChartContainer 
              height={400}
              config={{
                visits: {
                  label: "Visits",
                  color: "hsl(var(--chart-3))",
                },
              }}
            >
                <LineChart data={data.patientVisits}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={formatDate}
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip 
                    content={<ChartTooltipContent />}
                    formatter={(value) => [value, 'Visits']}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="visits" 
                    stroke="hsl(var(--chart-3))" 
                    strokeWidth={2}
                    dot={{ fill: "hsl(var(--chart-3))", strokeWidth: 2, r: 4 }}
                  />
                </LineChart>
              </FixedChartContainer>
          </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
