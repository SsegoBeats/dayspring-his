"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { useFormatCurrency } from "@/lib/settings-context"
import { TrendingUp, Package, DollarSign, RefreshCw } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"

type ValuationData = {
  valuation: {
    total_cost_value: number
    total_selling_value: number
    total_profit_margin: number
    medication_count: number
  }
  byCategory: Array<{
    category: string
    medication_count: number
    total_quantity: number
    total_cost_value: number
    total_selling_value: number
  }>
  topMedications: Array<{
    id: string
    name: string
    category: string
    stock_quantity: number
    unit_price: number
    cost_price: number | null
    total_value: number
    total_cost: number
  }>
}

export function InventoryValuation() {
  const formatCurrency = useFormatCurrency()
  const [data, setData] = useState<ValuationData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    ;(async () => {
      try {
        const res = await fetch("/api/pharmacy/inventory-valuation", { credentials: "include" })
        if (!res.ok) {
          setError("Failed to load valuation data")
          return
        }
        const json = await res.json()
        if (!cancelled) setData(json)
      } catch {
        if (!cancelled) setError("Failed to load valuation data")
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [refreshKey])

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl space-y-4">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Inventory Valuation</CardTitle>
                <CardDescription>Loading valuation data…</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-3/4" />
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-6xl">
        <Card>
          <CardHeader>
            <CardTitle>Inventory Valuation</CardTitle>
            <CardDescription className="text-destructive">{error || "No data available"}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  const { valuation, byCategory, topMedications } = data

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Inventory Valuation Summary</CardTitle>
              <CardDescription>Total value and profit analysis</CardDescription>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setRefreshKey((k) => k + 1)} title="Refresh">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="rounded-lg border p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Package className="h-4 w-4" />
                Total Medications
              </div>
              <div className="mt-2 text-2xl font-bold">{valuation.medication_count}</div>
            </div>
            <div className="rounded-lg border p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <DollarSign className="h-4 w-4" />
                Total Cost Value
              </div>
              <div className="mt-2 text-2xl font-bold">{formatCurrency(Number(valuation.total_cost_value))}</div>
            </div>
            <div className="rounded-lg border p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <DollarSign className="h-4 w-4" />
                Total Selling Value
              </div>
              <div className="mt-2 text-2xl font-bold">{formatCurrency(Number(valuation.total_selling_value))}</div>
            </div>
            <div className="rounded-lg border p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <TrendingUp className="h-4 w-4" />
                Profit Margin
              </div>
              <div className="mt-2 text-2xl font-bold">{Number(valuation.total_profit_margin).toFixed(1)}%</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Valuation by Category</CardTitle>
          <CardDescription>Breakdown of inventory value by medication category</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Medications</TableHead>
                  <TableHead className="text-right">Total Quantity</TableHead>
                  <TableHead className="text-right">Cost Value</TableHead>
                  <TableHead className="text-right">Selling Value</TableHead>
                  <TableHead className="text-right">Profit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byCategory.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-12 text-center text-muted-foreground">
                      <div className="flex flex-col items-center gap-3">
                        <Package className="h-8 w-8" />
                        <p>No category data found.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : byCategory.map((cat) => {
                  const profit = Number(cat.total_selling_value) - Number(cat.total_cost_value)
                  return (
                    <TableRow key={cat.category}>
                      <TableCell className="font-medium">{cat.category}</TableCell>
                      <TableCell className="text-right">{cat.medication_count}</TableCell>
                      <TableCell className="text-right">{cat.total_quantity}</TableCell>
                      <TableCell className="text-right">{formatCurrency(Number(cat.total_cost_value))}</TableCell>
                      <TableCell className="text-right">{formatCurrency(Number(cat.total_selling_value))}</TableCell>
                      <TableCell className="text-right">{formatCurrency(profit)}</TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Top 10 Most Valuable Medications</CardTitle>
          <CardDescription>Medications with highest inventory value</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Medication</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Stock</TableHead>
                  <TableHead className="text-right">Unit Price</TableHead>
                  <TableHead className="text-right">Cost Price</TableHead>
                  <TableHead className="text-right">Total Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topMedications.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-12 text-center text-muted-foreground">
                      <div className="flex flex-col items-center gap-3">
                        <DollarSign className="h-8 w-8" />
                        <p>No medication valuation data found.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : topMedications.map((med) => (
                  <TableRow key={med.id}>
                    <TableCell className="font-medium">{med.name}</TableCell>
                    <TableCell>{med.category}</TableCell>
                    <TableCell className="text-right">{med.stock_quantity}</TableCell>
                    <TableCell className="text-right">{formatCurrency(Number(med.unit_price))}</TableCell>
                    <TableCell className="text-right">
                      {med.cost_price ? formatCurrency(Number(med.cost_price)) : "—"}
                    </TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(Number(med.total_value))}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

