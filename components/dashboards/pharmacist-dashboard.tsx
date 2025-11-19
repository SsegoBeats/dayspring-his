"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useMedical } from "@/lib/medical-context"
import { usePharmacy } from "@/lib/pharmacy-context"
import { PrescriptionQueue } from "@/components/pharmacy/prescription-queue"
import { PrescriptionDispense } from "@/components/pharmacy/prescription-dispense"
import { MedicationInventory } from "@/components/pharmacy/medication-inventory"
import {
  Pill,
  Clock,
  CheckCircle,
  AlertTriangle,
  ScanLine,
  PlusCircle,
  ClipboardList,
  Boxes,
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
  const [tab, setTab] = useState<"prescriptions" | "inventory">("prescriptions")

  const activePrescriptions = prescriptions.filter((p) => p.status === "active")
  const completedPrescriptions = prescriptions.filter((p) => p.status === "completed")
  const lowStockMeds = getLowStockMedications()
  const expiringSoon = getExpiringMedications(90)
  const outOfStock = medications.filter((m) => m.stockQuantity <= 0)

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
    } catch {
      setScanError("Error decoding or fetching bill")
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
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Pharmacist Dashboard</h2>
        <p className="text-muted-foreground">Manage prescriptions and inventory</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border border-sky-100 bg-gradient-to-b from-sky-50/80 to-background shadow-sm transition hover:shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Medications</CardTitle>
            <Pill className="h-4 w-4 text-sky-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{medications.length}</div>
            <p className="text-xs text-muted-foreground">In inventory</p>
          </CardContent>
        </Card>
        <Card className="border border-amber-100 bg-gradient-to-b from-amber-50/80 to-background shadow-sm transition hover:shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Prescriptions</CardTitle>
            <Clock className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activePrescriptions.length}</div>
            <p className="text-xs text-muted-foreground">To be dispensed</p>
          </CardContent>
        </Card>
        <Card className="border border-emerald-100 bg-gradient-to-b from-emerald-50/80 to-background shadow-sm transition hover:shadow-md">
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
          className={`border shadow-sm transition hover:shadow-md ${
            lowStockMeds.length > 0 ? "border-red-300 bg-red-50/70" : "border-emerald-100 bg-emerald-50/40"
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

      <Card className="border border-slate-100 bg-gradient-to-r from-slate-50/80 to-background">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Boxes className="h-4 w-4 text-slate-500" />
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

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList>
          <TabsTrigger value="prescriptions">
            Prescriptions ({prescriptions.length})
          </TabsTrigger>
          <TabsTrigger value="inventory">Inventory ({medications.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="prescriptions" className="space-y-4">
          <Card className="border border-slate-100 shadow-sm">
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
                  placeholder="Scan QR/barcode or paste bill token"
                  value={scanValue}
                  onChange={(e) => setScanValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      handleScan()
                    }
                  }}
                />
                <Button variant="outline" size="sm" onClick={handleScan} disabled={scanLoading}>
                  {scanLoading ? "Loading..." : "Load bill"}
                </Button>
              </div>
              {scanError && <p className="text-sm text-destructive">{scanError}</p>}
              {scannedInfo && (
                <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
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

        <TabsContent value="inventory">
          <MedicationInventory />
        </TabsContent>
      </Tabs>
    </div>
  )
}
