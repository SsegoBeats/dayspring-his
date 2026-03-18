"use client"

import { useState, useEffect, useRef } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useMedical } from "@/lib/medical-context"
import { usePharmacy } from "@/lib/pharmacy-context"
import { PrescriptionQueue } from "@/components/pharmacy/prescription-queue"
import { PrescriptionDispense } from "@/components/pharmacy/prescription-dispense"
import { MedicationInventory } from "@/components/pharmacy/medication-inventory"
import { InventoryValuation } from "@/components/pharmacy/inventory-valuation"
import { ReorderSuggestions } from "@/components/pharmacy/reorder-suggestions"
import { StockTaking } from "@/components/pharmacy/stock-taking"
import { UsageAnalytics } from "@/components/pharmacy/usage-analytics"
import { ABCAnalysis } from "@/components/pharmacy/abc-analysis"
import { StockAdjustments } from "@/components/pharmacy/stock-adjustments"
import { SupplierManagement } from "@/components/pharmacy/supplier-management"
import {
  Pill,
  Clock,
  CheckCircle,
  AlertTriangle,
  ScanLine,
  PlusCircle,
  ClipboardList,
  Boxes,
  DollarSign,
  ShoppingCart,
  ClipboardCheck,
  BarChart3,
  TrendingUp,
  SlidersHorizontal,
  Truck,
} from "lucide-react"
import { decodeBarcodeData } from "@/lib/security"

export function PharmacistDashboard() {
  const { prescriptions } = useMedical()
  const { medications, getLowStockMedications, getExpiringMedications } = usePharmacy()
  const [selectedPrescriptionId, setSelectedPrescriptionId] = useState<string | null>(null)
  const [scanValue, setScanValue] = useState("")
  const [scanLoading, setScanLoading] = useState(false)
  const [scanError, setScanError] = useState<string | null>(null)
  const [scannedInfo, setScannedInfo] = useState<{
    billId: string
    patientId: string
    patientName: string
    items: { description: string; quantity: number }[]
    billStatus: string
  } | null>(null)
  const [tab, setTab] = useState<"prescriptions" | "inventory" | "valuation" | "reorder" | "stocktaking" | "analytics" | "abc" | "adjustments" | "suppliers">("prescriptions")
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())
  const scanInputRef = useRef<HTMLInputElement>(null)

  // Auto-refresh metrics every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setLastRefresh(new Date())
      // Force re-render by updating timestamp
    }, 30000) // 30 seconds

    return () => clearInterval(interval)
  }, [])

  // Auto-focus scan input when prescriptions tab is active
  useEffect(() => {
    if (tab === "prescriptions" && scanInputRef.current && !selectedPrescriptionId) {
      scanInputRef.current.focus()
    }
  }, [tab, selectedPrescriptionId])

  // Handle notification deep-links into the prescription queue
  useEffect(() => {
    const handler = async (event: Event) => {
      const detail = (event as CustomEvent).detail || {}
      // Mark notification as read
      if (detail.notificationId) {
        try {
          await fetch("/api/notifications", {
            method: "PATCH",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ids: [detail.notificationId] }),
          })
        } catch {}
      }
      // Navigate to prescriptions tab and open the specific prescription if given
      setTab("prescriptions")
      if (detail.prescriptionId) {
        setSelectedPrescriptionId(detail.prescriptionId)
      }
    }
    window.addEventListener("openPharmacistDesk", handler as EventListener)
    return () => window.removeEventListener("openPharmacistDesk", handler as EventListener)
  }, [])

  const activePrescriptions = prescriptions.filter((p) => p.status === "active")
  const completedPrescriptions = prescriptions.filter((p) => p.status === "completed")
  const lowStockMeds = getLowStockMedications()
  const expiringSoon = getExpiringMedications(90)
  const outOfStock = medications.filter((m) => m.stockQuantity <= 0)
  
  // Refresh data when lastRefresh changes
  useEffect(() => {
    // Data will refresh automatically via context updates
    // This effect ensures metrics are recalculated
  }, [lastRefresh, prescriptions, medications])

  const handleScan = async () => {
    setScanError(null)
    setScannedInfo(null)
    const raw = scanValue.trim()
    if (!raw) return

    let billId = raw
    try {
      const decoded = decodeBarcodeData(raw)
      if (decoded && decoded.type === "payment" && decoded.id) {
        billId = decoded.id
      }
    } catch {
      // fall back to treating scan as plain bill id
    }

    setScanLoading(true)
    try {
      const res = await fetch(`/api/billing/${encodeURIComponent(billId)}`, { credentials: "include" })
      if (!res.ok) {
        setScanError("Could not load bill from scan")
        return
      }
      const data = await res.json()
      const bill = data.bill
      const items = (data.items || []).map((it: any) => ({
        description: it.description as string,
        quantity: Number(it.quantity) || 1,
      }))
      setScannedInfo({
        billId,
        patientId: bill.patient_id,
        patientName: `${bill.first_name} ${bill.last_name}`.trim(),
        items,
        billStatus: String(bill.status || "").toLowerCase(),
      })
      // Clear input and refocus for next scan
      setScanValue("")
      setTimeout(() => {
        scanInputRef.current?.focus()
      }, 100)
    } catch {
      setScanError("Error decoding or fetching bill")
      // Refocus on error so user can retry
      setTimeout(() => {
        scanInputRef.current?.focus()
      }, 100)
    } finally {
      setScanLoading(false)
    }
  }

  if (selectedPrescriptionId) {
    const isScannedPatient =
      !!scannedInfo &&
      prescriptions.some((p) => p.id === selectedPrescriptionId && p.patientId === scannedInfo.patientId)

    const billingPaid = isScannedPatient ? scannedInfo?.billStatus === "paid" : undefined

    return (
      <PrescriptionDispense
        prescriptionId={selectedPrescriptionId}
        onBack={() => setSelectedPrescriptionId(null)}
        billingPaid={billingPaid}
      />
    )
  }

  return (
    <div className="space-y-6">
      <div className="pharmacist-animate-in border-b border-border/60 pb-6">
        <h2 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">Pharmacist Dashboard</h2>
        <p className="mt-1 text-muted-foreground">Manage prescriptions and inventory</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="pharmacist-animate-in pharmacist-stagger-1 opacity-0 border border-sky-100/80 bg-gradient-to-br from-sky-50/90 to-background rounded-xl shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-0.5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Medications</CardTitle>
            <Pill className="h-4 w-4 text-sky-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{medications.length}</div>
            <p className="text-xs text-muted-foreground">In inventory</p>
          </CardContent>
        </Card>
        <Card className="pharmacist-animate-in pharmacist-stagger-2 opacity-0 border border-amber-100/80 bg-gradient-to-br from-amber-50/90 to-background rounded-xl shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-0.5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Prescriptions</CardTitle>
            <Clock className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activePrescriptions.length}</div>
            <p className="text-xs text-muted-foreground">To be dispensed</p>
          </CardContent>
        </Card>
        <Card className="pharmacist-animate-in pharmacist-stagger-3 opacity-0 border border-emerald-100/80 bg-gradient-to-br from-emerald-50/90 to-background rounded-xl shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-0.5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Dispensed</CardTitle>
            <CheckCircle className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completedPrescriptions.length}</div>
            <p className="text-xs text-muted-foreground">Completed</p>
          </CardContent>
        </Card>
        <Card
          className={`pharmacist-animate-in pharmacist-stagger-4 opacity-0 rounded-xl shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 ${
            lowStockMeds.length > 0 ? "border-red-200/80 bg-gradient-to-br from-red-50/80 to-background" : "border-emerald-100/80 bg-gradient-to-br from-emerald-50/80 to-background"
          }`}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle
                className={`h-4 w-4 ${lowStockMeds.length > 0 ? "text-red-600" : "text-emerald-500"}`}
              />
              Low Stock
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="text-2xl font-bold">{lowStockMeds.length}</div>
            <p className="text-xs text-muted-foreground">
              {lowStockMeds.length > 0 ? "Medications below reorder level" : "All medications above threshold"}
            </p>
            <Button
              variant="link"
              size="sm"
              className="px-0 text-xs"
              onClick={() => setTab("inventory")}
            >
              Review low stock
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="pharmacist-animate-in pharmacist-stagger-5 opacity-0 border border-slate-100/80 bg-gradient-to-r from-slate-50/80 to-background rounded-xl shadow-sm transition-all duration-300 hover:shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Boxes className="h-4 w-4 text-muted-foreground" />
            Inventory Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
          <div>
            <p className="font-medium text-foreground">Low stock</p>
            <p>{lowStockMeds.length}</p>
          </div>
          <div>
            <p className="font-medium text-foreground">Out of stock</p>
            <p>{outOfStock.length}</p>
          </div>
          <div>
            <p className="font-medium text-foreground">Expiring in 90 days</p>
            <p>{expiringSoon.length}</p>
          </div>
        </CardContent>
      </Card>

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} className="space-y-4">
        <TabsList className="flex w-full flex-wrap gap-1.5 rounded-xl bg-muted/60 p-1.5 transition-colors">
          <TabsTrigger value="prescriptions">
            Prescriptions ({prescriptions.length})
          </TabsTrigger>
          <TabsTrigger value="inventory">Inventory ({medications.length})</TabsTrigger>
          <TabsTrigger value="valuation">
            <DollarSign className="mr-1 h-4 w-4" />
            Valuation
          </TabsTrigger>
          <TabsTrigger value="reorder">
            <ShoppingCart className="mr-1 h-4 w-4" />
            Reorder
          </TabsTrigger>
          <TabsTrigger value="stocktaking">
            <ClipboardCheck className="mr-1 h-4 w-4" />
            Stock Taking
          </TabsTrigger>
          <TabsTrigger value="analytics">
            <BarChart3 className="mr-1 h-4 w-4" />
            Analytics
          </TabsTrigger>
          <TabsTrigger value="abc">
            <TrendingUp className="mr-1 h-4 w-4" />
            ABC
          </TabsTrigger>
          <TabsTrigger value="adjustments">
            <SlidersHorizontal className="mr-1 h-4 w-4" />
            Adjustments
          </TabsTrigger>
          <TabsTrigger value="suppliers">
            <Truck className="mr-1 h-4 w-4" />
            Suppliers
          </TabsTrigger>
        </TabsList>

        <TabsContent value="prescriptions" className="space-y-4 animate-in fade-in-0 duration-200 data-[state=active]:slide-in-from-bottom-2">
          <Card className="border border-slate-100/80 rounded-xl shadow-sm transition-shadow hover:shadow-md">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <ScanLine className="h-4 w-4" />
                Process Prescription
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Scan or paste a billing token to load the patient&apos;s prescription from cashier billing.
              </p>
              <div className="flex flex-col gap-2 md:flex-row md:items-center">
                <Input
                  ref={scanInputRef}
                  placeholder="Scan QR/barcode or paste bill token"
                  value={scanValue}
                  onChange={(e) => setScanValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      handleScan()
                    }
                  }}
                  autoFocus={tab === "prescriptions"}
                />
                <Button variant="outline" size="sm" onClick={handleScan} disabled={scanLoading}>
                  {scanLoading ? "Loading..." : "Load bill"}
                </Button>
              </div>
              {scanError && <p className="text-sm text-destructive">{scanError}</p>}
              {scannedInfo && (
                <div className="rounded-xl border border-border bg-muted/30 p-3 text-sm transition-all duration-200 animate-in fade-in-0 slide-in-from-top-2">
                  <div className="mb-2 flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-foreground">{scannedInfo.patientName}</p>
                      <p className="text-xs text-muted-foreground">Bill ID: {scannedInfo.billId}</p>
                      <p className="text-xs text-muted-foreground">
                        Status:{" "}
                        <span
                          className={
                            scannedInfo.billStatus === "paid"
                              ? "text-emerald-600"
                              : "text-amber-600 dark:text-amber-400"
                          }
                        >
                          {scannedInfo.billStatus || "unknown"}
                        </span>
                      </p>
                    </div>
                  </div>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">Items</p>
                  <ul className="mb-2 list-disc pl-4 text-xs text-foreground">
                    {scannedInfo.items.map((it, idx) => (
                      <li key={idx}>
                        {it.description} (x{it.quantity})
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-muted-foreground">
                    Use the prescriptions list below to open the matching prescription for dispensing.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
          <PrescriptionQueue
            prescriptions={
              scannedInfo ? activePrescriptions.filter((p) => p.patientId === scannedInfo.patientId) : activePrescriptions
            }
            onSelectPrescription={setSelectedPrescriptionId}
            title={scannedInfo ? "Active Prescriptions for Scanned Patient" : "Active Prescriptions"}
            emptyMessage={scannedInfo ? "No active prescriptions for this patient" : "No active prescriptions"}
          />

          {completedPrescriptions.length > 0 && (
            <PrescriptionQueue
              prescriptions={completedPrescriptions.slice(-5).reverse()}
              onSelectPrescription={setSelectedPrescriptionId}
              title="Recently Dispensed"
              emptyMessage="No completed prescriptions"
            />
          )}
        </TabsContent>

        <TabsContent value="inventory" className="animate-in fade-in-0 duration-200 data-[state=active]:slide-in-from-bottom-2">
          <MedicationInventory />
        </TabsContent>

        <TabsContent value="valuation" className="animate-in fade-in-0 duration-200 data-[state=active]:slide-in-from-bottom-2">
          <InventoryValuation />
        </TabsContent>

        <TabsContent value="reorder" className="animate-in fade-in-0 duration-200 data-[state=active]:slide-in-from-bottom-2">
          <ReorderSuggestions />
        </TabsContent>

        <TabsContent value="stocktaking" className="animate-in fade-in-0 duration-200 data-[state=active]:slide-in-from-bottom-2">
          <StockTaking />
        </TabsContent>

        <TabsContent value="analytics" className="animate-in fade-in-0 duration-200 data-[state=active]:slide-in-from-bottom-2">
          <UsageAnalytics />
        </TabsContent>

        <TabsContent value="abc" className="animate-in fade-in-0 duration-200 data-[state=active]:slide-in-from-bottom-2">
          <ABCAnalysis />
        </TabsContent>
        <TabsContent value="adjustments" className="animate-in fade-in-0 duration-200 data-[state=active]:slide-in-from-bottom-2">
          <StockAdjustments />
        </TabsContent>
        <TabsContent value="suppliers" className="animate-in fade-in-0 duration-200 data-[state=active]:slide-in-from-bottom-2">
          <SupplierManagement />
        </TabsContent>
      </Tabs>
    </div>
  )
}
