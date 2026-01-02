"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { ClipboardCheck, Plus, Check, X } from "lucide-react"
import { usePharmacy } from "@/lib/pharmacy-context"

type StockTaking = {
  id: string
  medication_id: string
  medication_name: string
  recorded_quantity: number
  system_quantity: number
  variance: number
  notes: string | null
  taken_at: string
  status: "Pending" | "Approved" | "Rejected"
  taken_by_name: string | null
}

export function StockTaking() {
  const { medications } = usePharmacy()
  const [stockTakings, setStockTakings] = useState<StockTaking[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showDialog, setShowDialog] = useState(false)
  const [formData, setFormData] = useState({
    medicationId: "",
    recordedQuantity: "",
    notes: "",
  })

  useEffect(() => {
    loadStockTakings()
  }, [])

  const loadStockTakings = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/pharmacy/stock-taking", { credentials: "include" })
      if (!res.ok) {
        setError("Failed to load stock takings")
        return
      }
      const json = await res.json()
      setStockTakings(json.stockTakings || [])
    } catch {
      setError("Failed to load stock takings")
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const recordedQty = Number.parseInt(formData.recordedQuantity)
    if (!formData.medicationId || !Number.isFinite(recordedQty) || recordedQty < 0) {
      alert("Please fill in all required fields with valid values")
      return
    }

    try {
      const res = await fetch("/api/pharmacy/stock-taking", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          medicationId: formData.medicationId,
          recordedQuantity: recordedQty,
          notes: formData.notes || undefined,
        }),
      })

      if (!res.ok) {
        const error = await res.json().catch(() => ({}))
        alert(error.error || "Failed to record stock taking")
        return
      }

      setFormData({ medicationId: "", recordedQuantity: "", notes: "" })
      setShowDialog(false)
      loadStockTakings()
    } catch (err) {
      console.error("Error submitting stock taking:", err)
      alert("Failed to record stock taking")
    }
  }

  const handleApprove = async (id: string, applyAdjustment: boolean) => {
    try {
      const res = await fetch("/api/pharmacy/stock-taking", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          status: "Approved",
          applyAdjustment,
        }),
      })

      if (!res.ok) {
        alert("Failed to approve stock taking")
        return
      }

      loadStockTakings()
    } catch (err) {
      console.error("Error approving stock taking:", err)
      alert("Failed to approve stock taking")
    }
  }

  const handleReject = async (id: string) => {
    try {
      const res = await fetch("/api/pharmacy/stock-taking", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          status: "Rejected",
        }),
      })

      if (!res.ok) {
        alert("Failed to reject stock taking")
        return
      }

      loadStockTakings()
    } catch (err) {
      console.error("Error rejecting stock taking:", err)
      alert("Failed to reject stock taking")
    }
  }

  if (loading && stockTakings.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Stock Taking (Physical Inventory)</CardTitle>
          <CardDescription>Loading...</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Stock Taking (Physical Inventory)</CardTitle>
              <CardDescription>Record physical inventory counts and reconcile with system</CardDescription>
            </div>
            <Button onClick={() => setShowDialog(true)}>
              <Plus className="mr-2 h-4 w-4" />
              New Stock Taking
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {error && stockTakings.length === 0 ? (
            <p className="text-destructive">{error}</p>
          ) : stockTakings.length === 0 ? (
            <p className="text-muted-foreground">No stock takings recorded yet.</p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Medication</TableHead>
                    <TableHead className="text-right">System Qty</TableHead>
                    <TableHead className="text-right">Recorded Qty</TableHead>
                    <TableHead className="text-right">Variance</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>By</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stockTakings.map((st) => {
                    const variance = Number(st.variance)
                    const isPositive = variance > 0
                    const isNegative = variance < 0
                    return (
                      <TableRow key={st.id}>
                        <TableCell>{new Date(st.taken_at).toLocaleString()}</TableCell>
                        <TableCell className="font-medium">{st.medication_name}</TableCell>
                        <TableCell className="text-right">{st.system_quantity}</TableCell>
                        <TableCell className="text-right">{st.recorded_quantity}</TableCell>
                        <TableCell
                          className={`text-right font-medium ${
                            isPositive ? "text-emerald-600" : isNegative ? "text-red-600" : ""
                          }`}
                        >
                          {variance > 0 ? "+" : ""}
                          {variance}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              st.status === "Approved"
                                ? "default"
                                : st.status === "Rejected"
                                ? "destructive"
                                : "secondary"
                            }
                          >
                            {st.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{st.taken_by_name || "—"}</TableCell>
                        <TableCell>
                          {st.status === "Pending" && (
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleApprove(st.id, true)}
                                title="Approve and apply adjustment"
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleReject(st.id)}
                                title="Reject"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Stock Taking</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="medication">Medication *</Label>
              <Select value={formData.medicationId} onValueChange={(value) => setFormData({ ...formData, medicationId: value })} required>
                <SelectTrigger>
                  <SelectValue placeholder="Select medication" />
                </SelectTrigger>
                <SelectContent>
                  {medications.map((med) => (
                    <SelectItem key={med.id} value={med.id}>
                      {med.name} (System: {med.stockQuantity} units)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="recordedQuantity">Recorded Quantity (Physical Count) *</Label>
              <Input
                id="recordedQuantity"
                type="number"
                value={formData.recordedQuantity}
                onChange={(e) => setFormData({ ...formData, recordedQuantity: e.target.value })}
                placeholder="Enter physical count"
                required
                min={0}
              />
            </div>
            <div>
              <Label htmlFor="notes">Notes (optional)</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Any additional notes about this count..."
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>
                Cancel
              </Button>
              <Button type="submit">
                <ClipboardCheck className="mr-2 h-4 w-4" />
                Record Stock Taking
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}

