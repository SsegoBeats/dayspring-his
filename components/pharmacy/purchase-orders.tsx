"use client"

import { useState } from "react"
import { usePharmacy } from "@/lib/pharmacy-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Plus, Package, CheckCircle } from "lucide-react"
import { CreatePurchaseOrderDialog } from "./create-purchase-order-dialog"

export function PurchaseOrders() {
  const { purchaseOrders, suppliers, receivePurchaseOrder } = usePharmacy()
  const [showCreateDialog, setShowCreateDialog] = useState(false)

  const getSupplierName = (supplierId: string) => {
    return suppliers.find((s) => s.id === supplierId)?.name || "Unknown"
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "secondary"
      case "approved":
        return "default"
      case "received":
        return "default"
      case "cancelled":
        return "destructive"
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
              <CardTitle>Purchase Orders</CardTitle>
              <CardDescription>Manage medication purchase orders</CardDescription>
            </div>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Order
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {purchaseOrders.length === 0 ? (
              <p className="text-center text-muted-foreground">No purchase orders yet</p>
            ) : (
              purchaseOrders.map((order) => (
                <div key={order.id} className="rounded-lg border border-border bg-card p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Package className="h-5 w-5 text-muted-foreground" />
                        <h3 className="font-semibold text-foreground">{order.id}</h3>
                        <Badge variant={getStatusColor(order.status)}>{order.status}</Badge>
                      </div>
                      <div className="mt-2 grid gap-2 text-sm md:grid-cols-2">
                        <div>
                          <span className="text-muted-foreground">Supplier:</span>{" "}
                          <span className="text-foreground">{getSupplierName(order.supplierId)}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Order Date:</span>{" "}
                          <span className="text-foreground">{order.orderDate}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Expected Delivery:</span>{" "}
                          <span className="text-foreground">{order.expectedDeliveryDate}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Total Amount:</span>{" "}
                          <span className="font-medium text-foreground">${order.totalAmount.toFixed(2)}</span>
                        </div>
                      </div>
                      <div className="mt-3">
                        <p className="text-sm font-medium text-foreground">Items:</p>
                        <ul className="mt-1 space-y-1">
                          {order.items.map((item, idx) => (
                            <li key={idx} className="text-sm text-muted-foreground">
                              {item.medicationName} - {item.quantity} units @ ${item.unitPrice.toFixed(2)}
                            </li>
                          ))}
                        </ul>
                      </div>
                      {order.notes && (
                        <div className="mt-2">
                          <p className="text-sm text-muted-foreground">Notes: {order.notes}</p>
                        </div>
                      )}
                    </div>
                    {order.status === "approved" && (
                      <Button size="sm" onClick={() => receivePurchaseOrder(order.id)}>
                        <CheckCircle className="mr-2 h-4 w-4" />
                        Receive Order
                      </Button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <CreatePurchaseOrderDialog open={showCreateDialog} onOpenChange={setShowCreateDialog} />
    </>
  )
}
