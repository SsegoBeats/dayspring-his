"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ClipboardCheck, Plus, Check, X, Pill, Box, AlertCircle, Info } from "lucide-react"
import { usePharmacy } from "@/lib/pharmacy-context"
import { useToast } from "@/hooks/use-toast"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

type MedicationStockTaking = {
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

type NonMedicationStockTaking = {
  id: string
  item_id: string
  item_name: string
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
  const { toast } = useToast()
  const [medicationStockTakings, setMedicationStockTakings] = useState<MedicationStockTaking[]>([])
  const [nonMedicationStockTakings, setNonMedicationStockTakings] = useState<NonMedicationStockTaking[]>([])
  const [nonMedicationItems, setNonMedicationItems] = useState<Array<{ id: string; item_name: string; item_type: string; stock_quantity: number }>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showMedicationDialog, setShowMedicationDialog] = useState(false)
  const [showNonMedicationDialog, setShowNonMedicationDialog] = useState(false)
  const [activeTab, setActiveTab] = useState<"medications" | "non-medication">("medications")
  const [medicationFormData, setMedicationFormData] = useState({
    medicationId: "",
    recordedQuantity: "",
    notes: "",
  })
  const [nonMedicationFormData, setNonMedicationFormData] = useState({
    itemId: "",
    recordedQuantity: "",
    notes: "",
  })

  useEffect(() => {
    loadStockTakings()
    loadNonMedicationItems()
  }, [])

  const loadStockTakings = async () => {
    setLoading(true)
    setError(null)
    try {
      const [medRes, nonMedRes] = await Promise.all([
        fetch("/api/pharmacy/stock-taking", { credentials: "include" }),
        fetch("/api/pharmacy/non-medication-stock-taking", { credentials: "include" }),
      ])
      if (medRes.ok) {
        const medJson = await medRes.json()
        setMedicationStockTakings(medJson.stockTakings || [])
      }
      if (nonMedRes.ok) {
        const nonMedJson = await nonMedRes.json()
        setNonMedicationStockTakings(nonMedJson.stockTakings || [])
      }
    } catch {
      setError("Failed to load stock takings")
    } finally {
      setLoading(false)
    }
  }

  const loadNonMedicationItems = async () => {
    try {
      const res = await fetch("/api/pharmacy/non-medication-inventory", { credentials: "include" })
      if (res.ok) {
        const data = await res.json()
        setNonMedicationItems(
          (data.items || []).map((item: any) => ({
            id: item.id,
            item_name: item.item_name,
            item_type: item.item_type,
            stock_quantity: item.stock_quantity,
          })),
        )
      }
    } catch {
      // Non-fatal
    }
  }

  const handleMedicationSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const recordedQty = Number.parseInt(medicationFormData.recordedQuantity)
    if (!medicationFormData.medicationId || !Number.isFinite(recordedQty) || recordedQty < 0) {
      toast({
        title: "Validation error",
        description: "Please fill in all required fields with valid values",
        variant: "destructive",
      })
      return
    }

    try {
      const res = await fetch("/api/pharmacy/stock-taking", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          medicationId: medicationFormData.medicationId,
          recordedQuantity: recordedQty,
          notes: medicationFormData.notes || undefined,
        }),
      })

      if (!res.ok) {
        const error = await res.json().catch(() => ({}))
        toast({
          title: "Error",
          description: error.error || "Failed to record stock taking",
          variant: "destructive",
        })
        return
      }

      setMedicationFormData({ medicationId: "", recordedQuantity: "", notes: "" })
      setShowMedicationDialog(false)
      toast({
        title: "Stock taking recorded",
        description: "Medication stock taking has been recorded and is pending approval.",
        variant: "default",
      })
      loadStockTakings()
    } catch (err) {
      console.error("Error submitting medication stock taking:", err)
      toast({
        title: "Error",
        description: "Failed to record stock taking. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleNonMedicationSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const recordedQty = Number.parseInt(nonMedicationFormData.recordedQuantity)
    if (!nonMedicationFormData.itemId || !Number.isFinite(recordedQty) || recordedQty < 0) {
      toast({
        title: "Validation error",
        description: "Please fill in all required fields with valid values",
        variant: "destructive",
      })
      return
    }

    try {
      const res = await fetch("/api/pharmacy/non-medication-stock-taking", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId: nonMedicationFormData.itemId,
          recordedQuantity: recordedQty,
          notes: nonMedicationFormData.notes || undefined,
        }),
      })

      if (!res.ok) {
        const error = await res.json().catch(() => ({}))
        toast({
          title: "Error",
          description: error.error || "Failed to record stock taking",
          variant: "destructive",
        })
        return
      }

      setNonMedicationFormData({ itemId: "", recordedQuantity: "", notes: "" })
      setShowNonMedicationDialog(false)
      toast({
        title: "Stock taking recorded",
        description: "Non-medication stock taking has been recorded and is pending approval.",
        variant: "default",
      })
      loadStockTakings()
    } catch (err) {
      console.error("Error submitting non-medication stock taking:", err)
      toast({
        title: "Error",
        description: "Failed to record stock taking. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleMedicationApprove = async (id: string, applyAdjustment: boolean) => {
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
        toast({
          title: "Error",
          description: "Failed to approve stock taking",
          variant: "destructive",
        })
        return
      }

      toast({
        title: "Stock taking approved",
        description: applyAdjustment ? "Stock adjustment has been applied." : "Stock taking approved (no adjustment applied).",
        variant: "default",
      })
      loadStockTakings()
    } catch (err) {
      console.error("Error approving medication stock taking:", err)
      toast({
        title: "Error",
        description: "Failed to approve stock taking. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleNonMedicationApprove = async (id: string, applyAdjustment: boolean) => {
    try {
      const res = await fetch("/api/pharmacy/non-medication-stock-taking", {
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
        toast({
          title: "Error",
          description: "Failed to approve stock taking",
          variant: "destructive",
        })
        return
      }

      toast({
        title: "Stock taking approved",
        description: applyAdjustment ? "Stock adjustment has been applied." : "Stock taking approved (no adjustment applied).",
        variant: "default",
      })
      loadStockTakings()
    } catch (err) {
      console.error("Error approving non-medication stock taking:", err)
      toast({
        title: "Error",
        description: "Failed to approve stock taking. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleMedicationReject = async (id: string) => {
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
        toast({
          title: "Error",
          description: "Failed to reject stock taking",
          variant: "destructive",
        })
        return
      }

      toast({
        title: "Stock taking rejected",
        description: "Stock taking has been rejected.",
        variant: "default",
      })
      loadStockTakings()
    } catch (err) {
      console.error("Error rejecting medication stock taking:", err)
      toast({
        title: "Error",
        description: "Failed to reject stock taking. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleNonMedicationReject = async (id: string) => {
    try {
      const res = await fetch("/api/pharmacy/non-medication-stock-taking", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          status: "Rejected",
        }),
      })

      if (!res.ok) {
        toast({
          title: "Error",
          description: "Failed to reject stock taking",
          variant: "destructive",
        })
        return
      }

      toast({
        title: "Stock taking rejected",
        description: "Stock taking has been rejected.",
        variant: "default",
      })
      loadStockTakings()
    } catch (err) {
      console.error("Error rejecting non-medication stock taking:", err)
      toast({
        title: "Error",
        description: "Failed to reject stock taking. Please try again.",
        variant: "destructive",
      })
    }
  }

  if (loading && medicationStockTakings.length === 0 && nonMedicationStockTakings.length === 0) {
    return (
      <div className="mx-auto max-w-6xl">
        <Card>
          <CardHeader>
            <CardTitle>Stock Taking (Physical Inventory)</CardTitle>
            <CardDescription>Loading...</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <>
      <div className="mx-auto max-w-6xl">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Stock Taking (Physical Inventory)</CardTitle>
              <CardDescription>
                Record physical inventory counts and reconcile with system records. 
                Stock taking helps identify discrepancies between actual stock and system records.
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => setShowMedicationDialog(true)} variant="outline">
                <Pill className="mr-2 h-4 w-4" />
                Medication
              </Button>
              <Button onClick={() => setShowNonMedicationDialog(true)} variant="outline">
                <Box className="mr-2 h-4 w-4" />
                Non-Medication
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
            <TabsList>
              <TabsTrigger value="medications">
                <Pill className="mr-2 h-4 w-4" />
                Medications ({medicationStockTakings.length})
              </TabsTrigger>
              <TabsTrigger value="non-medication">
                <Box className="mr-2 h-4 w-4" />
                Non-Medication ({nonMedicationStockTakings.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="medications" className="mt-4">
              {error && medicationStockTakings.length === 0 ? (
                <p className="text-destructive">{error}</p>
              ) : medicationStockTakings.length === 0 ? (
                <p className="text-muted-foreground">No medication stock takings recorded yet.</p>
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
                      {medicationStockTakings.map((st) => {
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
                                    onClick={() => handleMedicationApprove(st.id, true)}
                                    title="Approve and apply adjustment"
                                  >
                                    <Check className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleMedicationReject(st.id)}
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
            </TabsContent>

            <TabsContent value="non-medication" className="mt-4">
              {error && nonMedicationStockTakings.length === 0 ? (
                <p className="text-destructive">{error}</p>
              ) : nonMedicationStockTakings.length === 0 ? (
                <div className="space-y-4">
                  <p className="text-muted-foreground">No non-medication stock takings recorded yet.</p>
                  {nonMedicationItems.length === 0 && (
                    <Alert>
                      <Info className="h-4 w-4" />
                      <AlertTitle>Get started with stock taking</AlertTitle>
                      <AlertDescription>
                        <p className="mt-2">
                          To perform stock taking, you first need to add non-medication items to your inventory. 
                          Stock taking compares physical counts with system records for items that are already in the system.
                        </p>
                        <p className="mt-2 font-medium">
                          Go to Non-Medication Inventory to add items, then return here to record stock counts.
                        </p>
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Item</TableHead>
                        <TableHead className="text-right">System Qty</TableHead>
                        <TableHead className="text-right">Recorded Qty</TableHead>
                        <TableHead className="text-right">Variance</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>By</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {nonMedicationStockTakings.map((st) => {
                        const variance = Number(st.variance)
                        const isPositive = variance > 0
                        const isNegative = variance < 0
                        return (
                          <TableRow key={st.id}>
                            <TableCell>{new Date(st.taken_at).toLocaleString()}</TableCell>
                            <TableCell className="font-medium">{st.item_name}</TableCell>
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
                                    onClick={() => handleNonMedicationApprove(st.id, true)}
                                    title="Approve and apply adjustment"
                                  >
                                    <Check className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleNonMedicationReject(st.id)}
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
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
      </div>

      <Dialog open={showMedicationDialog} onOpenChange={setShowMedicationDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Medication Stock Taking</DialogTitle>
            <DialogDescription>Record a physical count for a medication to reconcile with system inventory.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleMedicationSubmit} className="space-y-4">
            {medications.length === 0 ? (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>No medications available</AlertTitle>
                <AlertDescription>
                  <p className="mt-2">
                    You need to add medications to the system before you can perform stock taking. 
                    Stock taking is used to reconcile physical inventory counts with the system records for medications that are already in your inventory.
                  </p>
                  <p className="mt-2 font-medium">
                    To add medications, go to the Medication Inventory page and click &quot;Add Medication&quot;.
                  </p>
                </AlertDescription>
              </Alert>
            ) : (
              <>
                <div>
                  <Label htmlFor="medication">Medication *</Label>
                  <Select
                    value={medicationFormData.medicationId}
                    onValueChange={(value) => setMedicationFormData({ ...medicationFormData, medicationId: value })}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select medication" />
                    </SelectTrigger>
                    <SelectContent>
                      {medications.map((med) => (
                        <SelectItem key={med.id} value={med.id}>
                          {med.name} ({med.category}) - System: {med.stockQuantity} units
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
                    value={medicationFormData.recordedQuantity}
                    onChange={(e) => setMedicationFormData({ ...medicationFormData, recordedQuantity: e.target.value })}
                    placeholder="Enter physical count"
                    required
                    min={0}
                  />
                </div>
                <div>
                  <Label htmlFor="notes">Notes (optional)</Label>
                  <Textarea
                    id="notes"
                    value={medicationFormData.notes}
                    onChange={(e) => setMedicationFormData({ ...medicationFormData, notes: e.target.value })}
                    placeholder="Any additional notes about this count..."
                  />
                </div>
              </>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowMedicationDialog(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={medications.length === 0}>
                <ClipboardCheck className="mr-2 h-4 w-4" />
                Record Stock Taking
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={showNonMedicationDialog} onOpenChange={setShowNonMedicationDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Non-Medication Stock Taking</DialogTitle>
            <DialogDescription>Record a physical count for a non-medication item to reconcile with system inventory.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleNonMedicationSubmit} className="space-y-4">
            {nonMedicationItems.length === 0 ? (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>No non-medication items available</AlertTitle>
                <AlertDescription>
                  <p className="mt-2">
                    You need to add non-medication items to the system before you can perform stock taking. 
                    Stock taking is used to reconcile physical inventory counts with the system records for items that are already in your inventory.
                  </p>
                  <p className="mt-2 font-medium">
                    To add items, go to the Non-Medication Inventory page and click &quot;Add Item&quot;.
                  </p>
                </AlertDescription>
              </Alert>
            ) : (
              <>
                <div>
                  <Label htmlFor="item">Item *</Label>
                  <Select
                    value={nonMedicationFormData.itemId}
                    onValueChange={(value) => setNonMedicationFormData({ ...nonMedicationFormData, itemId: value })}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select non-medication item" />
                    </SelectTrigger>
                    <SelectContent>
                      {nonMedicationItems.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.item_name} ({item.item_type}) - System: {item.stock_quantity} units
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
                    value={nonMedicationFormData.recordedQuantity}
                    onChange={(e) => setNonMedicationFormData({ ...nonMedicationFormData, recordedQuantity: e.target.value })}
                    placeholder="Enter physical count"
                    required
                    min={0}
                  />
                </div>
                <div>
                  <Label htmlFor="notes">Notes (optional)</Label>
                  <Textarea
                    id="notes"
                    value={nonMedicationFormData.notes}
                    onChange={(e) => setNonMedicationFormData({ ...nonMedicationFormData, notes: e.target.value })}
                    placeholder="Any additional notes about this count..."
                  />
                </div>
              </>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowNonMedicationDialog(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={nonMedicationItems.length === 0}>
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

