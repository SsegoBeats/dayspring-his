"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { AlertTriangle, Package } from "lucide-react"

type Batch = {
  id: string
  batch_number: string
  quantity: number
  expiry_date: string | null
  received_at: string
  cost_price: number | null
}

interface MedicationBatchesProps {
  medicationId: string
  medicationName: string
}

export function MedicationBatches({ medicationId, medicationName }: MedicationBatchesProps) {
  const [batches, setBatches] = useState<Batch[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [totalQuantity, setTotalQuantity] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    ;(async () => {
      try {
        const res = await fetch(`/api/pharmacy/batches?medicationId=${encodeURIComponent(medicationId)}`, {
          credentials: "include",
        })
        if (!res.ok) {
          setError("Failed to load batches")
          return
        }
        const json = (await res.json()) as { batches?: Batch[]; availableQuantity?: number }
        if (!cancelled) {
          setBatches(json.batches || [])
          setTotalQuantity(json.availableQuantity || 0)
        }
      } catch {
        if (!cancelled) setError("Failed to load batches")
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [medicationId])

  if (loading && batches.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Batch Details</CardTitle>
          <CardDescription>Loading batches...</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Batch Details</CardTitle>
          <CardDescription className="text-destructive">{error}</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  if (batches.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Batch Details</CardTitle>
          <CardDescription>No batch-level tracking available for this medication.</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const now = new Date()
  const getExpiryStatus = (expiryDate: string | null) => {
    if (!expiryDate) return { status: "none", label: "No expiry", variant: "secondary" as const }
    const exp = new Date(expiryDate)
    if (exp < now) return { status: "expired", label: "Expired", variant: "destructive" as const }
    const daysUntilExpiry = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    if (daysUntilExpiry <= 30)
      return { status: "expiring", label: `Expires in ${daysUntilExpiry} days`, variant: "secondary" as const }
    return { status: "valid", label: "Valid", variant: "default" as const }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm">Batch Details</CardTitle>
            <CardDescription>
              {batches.length} batch{batches.length !== 1 ? "es" : ""} • Total: {totalQuantity} units
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Batch Number</TableHead>
                <TableHead className="text-right">Quantity</TableHead>
                <TableHead>Expiry Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Received</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {batches.map((batch) => {
                const expiryStatus = getExpiryStatus(batch.expiry_date)
                const receivedDate = batch.received_at ? new Date(batch.received_at).toLocaleDateString() : "—"

                return (
                  <TableRow key={batch.id}>
                    <TableCell className="font-medium">{batch.batch_number}</TableCell>
                    <TableCell className="text-right">{batch.quantity}</TableCell>
                    <TableCell>
                      {batch.expiry_date ? (
                        <span className={expiryStatus.status === "expired" ? "text-red-600 font-medium" : ""}>
                          {new Date(batch.expiry_date).toLocaleDateString()}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={expiryStatus.variant} className="text-xs">
                        {expiryStatus.status === "expired" && <AlertTriangle className="mr-1 h-3 w-3" />}
                        {expiryStatus.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">{receivedDate}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
        {batches.some((b) => getExpiryStatus(b.expiry_date).status === "expired") && (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-800">
            <AlertTriangle className="mr-1 inline h-3 w-3" />
            This medication has expired batches. Do not dispense expired medications.
          </div>
        )}
      </CardContent>
    </Card>
  )
}

