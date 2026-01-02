"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { TrendingUp, Package, DollarSign } from "lucide-react"
import { useFormatCurrency } from "@/lib/settings-context"

type ABCData = {
  medications: Array<{
    medication_id: string
    medication_name: string
    category: string
    abc_category: "A" | "B" | "C"
    unit_price: number
    cost_price: number | null
    annual_quantity_dispensed: number
    annual_consumption_value: number
    annual_cost_value: number
    stock_quantity: number
    reorder_level: number
    min_stock_level: number | null
    max_stock_level: number | null
    value_percentage: number
    cumulative_percentage: number
  }>
  summary: {
    total_medications: number
    total_annual_value: number
    category_a: { count: number; total_value: number; percentage: number }
    category_b: { count: number; total_value: number; percentage: number }
    category_c: { count: number; total_value: number; percentage: number }
  }
}

export function ABCAnalysis() {
  const formatCurrency = useFormatCurrency()
  const [data, setData] = useState<ABCData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filterCategory, setFilterCategory] = useState<"all" | "A" | "B" | "C">("all")

  useEffect(() => {
    loadABCAnalysis()
  }, [])

  const loadABCAnalysis = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/pharmacy/abc-analysis", { credentials: "include" })
      if (!res.ok) {
        setError("Failed to load ABC analysis")
        return
      }
      const json = await res.json()
      setData(json)
    } catch {
      setError("Failed to load ABC analysis")
    } finally {
      setLoading(false)
    }
  }

  if (loading && !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>ABC Analysis</CardTitle>
          <CardDescription>Loading...</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  if (error && !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>ABC Analysis</CardTitle>
          <CardDescription className="text-destructive">{error}</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  if (!data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>ABC Analysis</CardTitle>
          <CardDescription>No data available</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const filteredMedications =
    filterCategory === "all"
      ? data.medications
      : data.medications.filter((m) => m.abc_category === filterCategory)

  const getCategoryColor = (category: "A" | "B" | "C") => {
    switch (category) {
      case "A":
        return "destructive"
      case "B":
        return "secondary"
      case "C":
        return "outline"
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                ABC Analysis
              </CardTitle>
              <CardDescription>
                Medication categorization by annual consumption value (A: High value, B: Medium, C: Low)
              </CardDescription>
            </div>
            <Select value={filterCategory} onValueChange={(v) => setFilterCategory(v as typeof filterCategory)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="A">Category A</SelectItem>
                <SelectItem value="B">Category B</SelectItem>
                <SelectItem value="C">Category C</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4 mb-6">
            <div className="rounded-lg border p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Package className="h-4 w-4" />
                Total Medications
              </div>
              <div className="mt-2 text-2xl font-bold">{data.summary.total_medications}</div>
            </div>
            <div className="rounded-lg border p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <DollarSign className="h-4 w-4" />
                Total Annual Value
              </div>
              <div className="mt-2 text-2xl font-bold">{formatCurrency(data.summary.total_annual_value)}</div>
            </div>
            <div className="rounded-lg border border-red-200 bg-red-50/50 p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Badge variant="destructive">Category A</Badge>
              </div>
              <div className="mt-2 text-2xl font-bold">{data.summary.category_a.count}</div>
              <div className="text-xs text-muted-foreground">
                {data.summary.category_a.percentage.toFixed(1)}% of value
              </div>
            </div>
            <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Badge variant="secondary">Category B</Badge>
              </div>
              <div className="mt-2 text-2xl font-bold">{data.summary.category_b.count}</div>
              <div className="text-xs text-muted-foreground">
                {data.summary.category_b.percentage.toFixed(1)}% of value
              </div>
            </div>
          </div>

          {filteredMedications.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Medication</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>ABC</TableHead>
                    <TableHead className="text-right">Annual Qty</TableHead>
                    <TableHead className="text-right">Annual Value</TableHead>
                    <TableHead className="text-right">Value %</TableHead>
                    <TableHead className="text-right">Cumulative %</TableHead>
                    <TableHead className="text-right">Stock</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMedications.map((med) => (
                    <TableRow key={med.medication_id}>
                      <TableCell className="font-medium">{med.medication_name}</TableCell>
                      <TableCell>{med.category}</TableCell>
                      <TableCell>
                        <Badge variant={getCategoryColor(med.abc_category)}>{med.abc_category}</Badge>
                      </TableCell>
                      <TableCell className="text-right">{med.annual_quantity_dispensed}</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(med.annual_consumption_value)}
                      </TableCell>
                      <TableCell className="text-right">{med.value_percentage.toFixed(2)}%</TableCell>
                      <TableCell className="text-right">{med.cumulative_percentage.toFixed(2)}%</TableCell>
                      <TableCell className="text-right">{med.stock_quantity}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-center text-muted-foreground">No medications found in selected category.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

