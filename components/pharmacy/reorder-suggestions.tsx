"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { AlertTriangle, ShoppingCart, PackageSearch } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { usePharmacy } from "@/lib/pharmacy-context"
import { CreatePurchaseOrderDialog } from "./create-purchase-order-dialog"

type ReorderSuggestion = {
  medication_id: string
  medication_name: string
  current_stock: number
  min_stock_level: number
  reorder_level: number
  suggested_order_quantity: number
  days_since_last_restock: number | null
}

export function ReorderSuggestions() {
  const { medications, suppliers, createPurchaseOrder } = usePharmacy()
  const { toast } = useToast()
  const [suggestions, setSuggestions] = useState<ReorderSuggestion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showPurchaseOrderDialog, setShowPurchaseOrderDialog] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    ;(async () => {
      try {
        const res = await fetch("/api/pharmacy/reorder-suggestions", { credentials: "include" })
        if (!res.ok) {
          setError("Failed to load reorder suggestions")
          return
        }
        const json = await res.json()
        if (!cancelled) setSuggestions(json.suggestions || [])
      } catch {
        if (!cancelled) setError("Failed to load reorder suggestions")
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-600" />
                  Reorder Suggestions
                </CardTitle>
                <CardDescription>Checking stock levels…</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-3/4" />
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error) {
    return (
      <div className="mx-auto max-w-6xl">
        <Card>
          <CardHeader>
            <CardTitle>Reorder Suggestions</CardTitle>
            <CardDescription className="text-destructive">{error}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  const handleCreatePurchaseOrder = () => {
    if (suggestions.length === 0) {
      toast({
        title: "No suggestions",
        description: "There are no medications that need reordering.",
        variant: "default",
      })
      return
    }
    setShowPurchaseOrderDialog(true)
  }

  const handleCreateOrderFromSuggestions = async (expectedDeliveryDate: string, notes?: string) => {
    const items = suggestions.map((sug) => ({
      medication_id: sug.medication_id,
      quantity_ordered: sug.suggested_order_quantity,
      unit_cost: (medications.find((m) => m.id === sug.medication_id) as any)?.unitPrice || 0,
    }))

    await createPurchaseOrder({
      supplier_id: "",
      expected_delivery_date: expectedDeliveryDate || undefined,
      notes: notes || undefined,
      items,
    })

    toast({
      title: "Purchase order created",
      description: `Purchase order created with ${items.length} item(s).`,
      variant: "default",
    })

    setShowPurchaseOrderDialog(false)
  }

  if (suggestions.length === 0) {
    return (
      <div className="mx-auto max-w-6xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              Reorder Suggestions
            </CardTitle>
            <CardDescription>All medications are well stocked. No reorders needed.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center gap-3 py-12 text-center text-muted-foreground">
              <PackageSearch className="h-8 w-8" />
              <p>All medications are well stocked. No reorders needed.</p>
            </div>
          </CardContent>
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
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
                Reorder Suggestions
              </CardTitle>
              <CardDescription>
                {suggestions.length} medication{suggestions.length !== 1 ? "s" : ""} need restocking
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={handleCreatePurchaseOrder}>
              <ShoppingCart className="mr-2 h-4 w-4" />
              Create Purchase Order
            </Button>
          </div>
        </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Medication</TableHead>
                <TableHead className="text-right">Current Stock</TableHead>
                <TableHead className="text-right">Min Level</TableHead>
                <TableHead className="text-right">Reorder Level</TableHead>
                <TableHead className="text-right">Suggested Order</TableHead>
                <TableHead className="text-right">Days Since Last Restock</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {suggestions.map((sug) => {
                const stockRatio = sug.current_stock / Math.max(sug.min_stock_level || sug.reorder_level, 1)
                const isCritical = stockRatio < 0.5
                const isLow = stockRatio < 1
                return (
                  <TableRow key={sug.medication_id}>
                    <TableCell className="font-medium">{sug.medication_name}</TableCell>
                    <TableCell className="text-right">
                      <span className={isCritical ? "font-bold text-red-600" : isLow ? "font-medium text-amber-600" : ""}>
                        {sug.current_stock}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">{sug.min_stock_level || "—"}</TableCell>
                    <TableCell className="text-right">{sug.reorder_level}</TableCell>
                    <TableCell className="text-right font-medium">{sug.suggested_order_quantity}</TableCell>
                    <TableCell className="text-right">
                      {sug.days_since_last_restock !== null ? `${sug.days_since_last_restock} days` : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={isCritical ? "destructive" : isLow ? "secondary" : "outline"}>
                        {isCritical ? "Critical" : isLow ? "Low" : "Below Min"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
      </Card>
      </div>
      <CreatePurchaseOrderDialog open={showPurchaseOrderDialog} onOpenChange={setShowPurchaseOrderDialog} />
    </>
  )
}

