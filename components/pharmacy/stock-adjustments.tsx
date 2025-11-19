"use client"

import { useState } from "react"
import { usePharmacy } from "@/lib/pharmacy-context"
import { useFormatDate } from "@/lib/date-utils"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Plus } from "lucide-react"
import { StockAdjustmentDialog } from "./stock-adjustment-dialog"

export function StockAdjustments() {
  const { stockAdjustments } = usePharmacy()
  const { formatDate } = useFormatDate()
  const [showDialog, setShowDialog] = useState(false)

  const getAdjustmentColor = (type: string) => {
    switch (type) {
      case "add":
        return "default"
      case "remove":
        return "destructive"
      case "correction":
        return "secondary"
      default:
        return "secondary"
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Stock Adjustments</CardTitle>
              <CardDescription>Track inventory adjustments</CardDescription>
            </div>
            <Button onClick={() => setShowDialog(true)}>
              <Plus className="mr-2 h-4 w-4" />
              New Adjustment
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {stockAdjustments.length === 0 ? (
              <p className="text-center text-muted-foreground">No stock adjustments yet</p>
            ) : (
              stockAdjustments.map((adjustment) => (
                <div key={adjustment.id} className="rounded-lg border border-border bg-card p-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-foreground">{adjustment.medicationName}</p>
                        <Badge variant={getAdjustmentColor(adjustment.adjustmentType)}>
                          {adjustment.adjustmentType}
                        </Badge>
                      </div>
                      <div className="mt-1 grid gap-1 text-sm md:grid-cols-3">
                        <div>
                          <span className="text-muted-foreground">Quantity:</span>{" "}
                          <span className="text-foreground">{adjustment.quantity} units</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">By:</span>{" "}
                          <span className="text-foreground">{adjustment.adjustedBy}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Date:</span>{" "}
                          <span className="text-foreground">
                            {formatDate(new Date(adjustment.adjustedAt))}
                          </span>
                        </div>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">Reason: {adjustment.reason}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <StockAdjustmentDialog open={showDialog} onOpenChange={setShowDialog} />
    </>
  )
}
