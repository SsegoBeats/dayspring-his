"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

type StockMovement = {
  id: string
  medication_id: string
  medication_name: string
  movement_type: string
  quantity: number
  reference: string | null
  batch_number: string | null
  expiry_date: string | null
  barcode_snapshot: string | null
  created_at: string
  created_by_name: string | null
}

interface StockMovementsProps {
  medicationId?: string
}

export function StockMovements({ medicationId }: StockMovementsProps) {
  const [data, setData] = useState<StockMovement[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    ;(async () => {
      try {
        const params = new URLSearchParams()
        if (medicationId) params.set("medicationId", medicationId)
        const res = await fetch(`/api/pharmacy/stock-movements?${params.toString()}`, { credentials: "include" })
        if (!res.ok) {
          setError("Failed to load stock movements")
          return
        }
        const json = (await res.json()) as { movements?: StockMovement[] }
        if (!cancelled) setData(json.movements || [])
      } catch {
        if (!cancelled) setError("Failed to load stock movements")
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [medicationId])

  if (loading && data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Stock Movements</CardTitle>
          <CardDescription>Loading...</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  if (error && data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Stock Movements</CardTitle>
          <CardDescription className="text-destructive">{error}</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Stock Movements</CardTitle>
          <CardDescription>No stock movements recorded yet.</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Stock Movements</CardTitle>
        <CardDescription>{medicationId ? "History for this medication" : "Last inventory changes"}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                {!medicationId && <TableHead>Medication</TableHead>}
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead>Batch</TableHead>
                <TableHead>Expiry</TableHead>
                <TableHead>Barcode</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>By</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((m) => {
                const when = m.created_at ? new Date(m.created_at).toLocaleString() : ""
                const expiry = m.expiry_date ? new Date(m.expiry_date).toISOString().slice(0, 10) : ""
                return (
                  <TableRow key={m.id}>
                    <TableCell>{when}</TableCell>
                    {!medicationId && <TableCell>{m.medication_name}</TableCell>}
                    <TableCell>{m.movement_type}</TableCell>
                    <TableCell className="text-right">{m.quantity}</TableCell>
                    <TableCell>{m.batch_number || <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell>{expiry || <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell>{m.barcode_snapshot || <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell>{m.reference || <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell>{m.created_by_name || <span className="text-muted-foreground">—</span>}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}

