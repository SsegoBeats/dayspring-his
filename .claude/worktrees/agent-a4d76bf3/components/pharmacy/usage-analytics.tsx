"use client"

import { useCallback, useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { TrendingUp, TrendingDown, Minus, BarChart3, RefreshCw } from "lucide-react"
import { useFormatCurrency } from "@/lib/settings-context"
import { Skeleton } from "@/components/ui/skeleton"

type UsageData = {
  usage: Array<{
    id: string
    medication_id: string
    medication_name: string
    period_start: string
    period_end: string
    quantity_dispensed: number
    quantity_received: number
    average_daily_usage: number
    created_at: string
  }>
  forecasts: Array<{
    medication_id: string
    medication_name: string
    historical_avg_daily: number
    forecasted_monthly: number
    forecasted_30_days: number
    forecasted_90_days: number
    trend: "increasing" | "decreasing" | "stable"
    confidence: number
  }>
}

export function UsageAnalytics() {
  const formatCurrency = useFormatCurrency()
  const [data, setData] = useState<UsageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [months, setMonths] = useState(6)
  const [view, setView] = useState<"forecasts" | "history">("forecasts")

  const loadAnalytics = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/pharmacy/usage-analytics?months=${months}`, { credentials: "include" })
      if (!res.ok) {
        setError("Failed to load usage analytics")
        return
      }
      const json = await res.json()
      setData(json)
    } catch {
      setError("Failed to load usage analytics")
    } finally {
      setLoading(false)
    }
  }, [months])

  useEffect(() => {
    void loadAnalytics()
  }, [loadAnalytics])

  if (loading && !data) {
    return (
      <div className="mx-auto max-w-6xl">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Usage Analytics & Demand Forecasting
                </CardTitle>
                <CardDescription>Loading analytics…</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-3/4" />
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error && !data) {
    return (
      <div className="mx-auto max-w-6xl">
        <Card>
          <CardHeader>
            <CardTitle>Usage Analytics & Demand Forecasting</CardTitle>
            <CardDescription className="text-destructive">{error}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Usage Analytics & Demand Forecasting
              </CardTitle>
              <CardDescription>Historical usage patterns and predictive demand forecasts</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={() => void loadAnalytics()} title="Refresh">
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Select value={String(months)} onValueChange={(v) => setMonths(Number(v))}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">3 months</SelectItem>
                  <SelectItem value="6">6 months</SelectItem>
                  <SelectItem value="12">12 months</SelectItem>
                  <SelectItem value="24">24 months</SelectItem>
                </SelectContent>
              </Select>
              <Select value={view} onValueChange={(v) => setView(v as typeof view)}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="forecasts">Forecasts</SelectItem>
                  <SelectItem value="history">History</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {view === "forecasts" ? (
            data && data.forecasts.length > 0 ? (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Medication</TableHead>
                      <TableHead className="text-right">Avg Daily Usage</TableHead>
                      <TableHead className="text-right">30-Day Forecast</TableHead>
                      <TableHead className="text-right">90-Day Forecast</TableHead>
                      <TableHead>Trend</TableHead>
                      <TableHead className="text-right">Confidence</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.forecasts.map((forecast) => (
                      <TableRow key={forecast.medication_id}>
                        <TableCell className="font-medium">{forecast.medication_name}</TableCell>
                        <TableCell className="text-right">
                          {forecast.historical_avg_daily.toFixed(2)} units/day
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {Math.ceil(forecast.forecasted_30_days)} units
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {Math.ceil(forecast.forecasted_90_days)} units
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {forecast.trend === "increasing" && (
                              <>
                                <TrendingUp className="h-4 w-4 text-emerald-600" />
                                <span className="text-emerald-600">Increasing</span>
                              </>
                            )}
                            {forecast.trend === "decreasing" && (
                              <>
                                <TrendingDown className="h-4 w-4 text-red-600" />
                                <span className="text-red-600">Decreasing</span>
                              </>
                            )}
                            {forecast.trend === "stable" && (
                              <>
                                <Minus className="h-4 w-4 text-muted-foreground" />
                                <span className="text-muted-foreground">Stable</span>
                              </>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant={forecast.confidence >= 80 ? "default" : forecast.confidence >= 60 ? "secondary" : "outline"}>
                            {forecast.confidence}%
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 py-12 text-center text-muted-foreground">
                <BarChart3 className="h-8 w-8" />
                <p>No forecast data available. Dispense medications to generate usage analytics.</p>
              </div>
            )
          ) : (
            data && data.usage.length > 0 ? (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Medication</TableHead>
                      <TableHead>Period</TableHead>
                      <TableHead className="text-right">Quantity Dispensed</TableHead>
                      <TableHead className="text-right">Quantity Received</TableHead>
                      <TableHead className="text-right">Avg Daily Usage</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.usage.map((usage) => (
                      <TableRow key={usage.id}>
                        <TableCell className="font-medium">{usage.medication_name}</TableCell>
                        <TableCell>
                          {new Date(usage.period_start).toLocaleDateString()} - {new Date(usage.period_end).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">{usage.quantity_dispensed}</TableCell>
                        <TableCell className="text-right">{usage.quantity_received || 0}</TableCell>
                        <TableCell className="text-right">{usage.average_daily_usage.toFixed(2)} units/day</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 py-12 text-center text-muted-foreground">
                <BarChart3 className="h-8 w-8" />
                <p>No usage history available. Dispense medications to generate analytics.</p>
              </div>
            )
          )}
        </CardContent>
      </Card>
    </div>
  )
}

