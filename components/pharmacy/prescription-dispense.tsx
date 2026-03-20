"use client"

import { useState } from "react"
import { useMedical } from "@/lib/medical-context"
import { usePharmacy } from "@/lib/pharmacy-context"
import { usePatients } from "@/lib/patient-context"
import { formatPatientNumber } from "@/lib/patients"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ArrowLeft, CheckCircle, AlertCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useToast } from "@/hooks/use-toast"

interface PrescriptionDispenseProps {
  prescriptionId: string
  onBack: () => void
  onSuccess?: () => void
  billingPaid?: boolean
}

export function PrescriptionDispense({ prescriptionId, onBack, onSuccess, billingPaid }: PrescriptionDispenseProps) {
  const { prescriptions, refreshMedicalData } = useMedical()
  const { medications, getMedication, refreshMedications } = usePharmacy()
  const { getPatient } = usePatients()
  const { toast } = useToast()
  const prescription = prescriptions.find((p) => p.id === prescriptionId)
  const patient = prescription ? getPatient(prescription.patientId) : null

  const [dispensing, setDispensing] = useState(false)
  const [stockIssues, setStockIssues] = useState<string[]>([])
  const [witnessName, setWitnessName] = useState("")
  const [dispensingNotes, setDispensingNotes] = useState("")
  const [dispenseError, setDispenseError] = useState<string | null>(null)

  if (!prescription) {
    return (
      <div className="mx-auto max-w-2xl animate-in fade-in-0 duration-200">
        <Card className="rounded-xl shadow-sm">
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">Prescription not found</p>
            <Button onClick={onBack} className="mt-4">
              Go Back
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const checkStock = () => {
    const issues: string[] = []
    prescription.medications.forEach((med) => {
      const medication = getMedication(med.name)
      if (!medication) {
        issues.push(`${med.name} not found in inventory`)
      } else {
        // Check for expired medications
        if (medication.expiryDate) {
          const expiryDate = new Date(medication.expiryDate)
          const today = new Date()
          today.setHours(0, 0, 0, 0)
          if (expiryDate < today) {
            issues.push(`${med.name} has expired (Expiry: ${medication.expiryDate}). Do not dispense expired medications.`)
            return // Don't check stock if expired
          }
        }
        // Check stock availability
        const quantityNeeded = Number.parseInt(med.duration) || 1
        if (medication.stockQuantity < quantityNeeded || medication.stockQuantity === 0) {
          issues.push(`${med.name} has insufficient stock (Available: ${medication.stockQuantity}, Required: ${quantityNeeded})`)
        }
      }
    })
    return issues
  }

  const handleDispense = async () => {
    if (billingPaid === false) {
      toast({
        title: "Payment verification required",
        description: "Cannot dispense: associated bill is not marked as paid. Please confirm payment with the cashier.",
        variant: "destructive",
      })
      return
    }
    const issues = checkStock()
    if (issues.length > 0) {
      setStockIssues(issues)
      toast({
        title: "Stock issues detected",
        description: "Please resolve stock issues before dispensing.",
        variant: "destructive",
      })
      return
    }

    setDispensing(true)
    setDispenseError(null)

    try {
      const res = await fetch(`/api/pharmacy/dispense/${prescriptionId}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ witness_name: witnessName || undefined, dispensing_notes: dispensingNotes || undefined }),
      })
      const data = await res.json()
      if (!res.ok) {
        setDispenseError(data.error || "Dispensing failed — no changes were made. Please try again or contact support.")
        return
      }

      // Refresh contexts post-dispense
      await Promise.all([refreshMedications(), refreshMedicalData()])

      toast({
        title: "Prescription dispensed",
        description: `Successfully dispensed prescription for ${prescription.patientName}.`,
        variant: "default",
      })

      onSuccess?.()
    } catch {
      setDispenseError("Network error — dispensing failed. No changes were made. Please try again or contact support.")
    } finally {
      setDispensing(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 animate-in fade-in-0 slide-in-from-bottom-4 duration-300">
      <Button variant="outline" onClick={onBack} className="rounded-lg transition-colors">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Queue
      </Button>

      <Card className="rounded-xl border-border/80 shadow-sm transition-shadow hover:shadow-md">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Prescription Details</CardTitle>
              <CardDescription>ID: {prescription.id}</CardDescription>
            </div>
            <Badge
              variant={
                prescription.status === "active"
                  ? "secondary"
                  : prescription.status === "completed"
                    ? "default"
                    : "destructive"
              }
            >
              {prescription.status}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {billingPaid === true && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>Billing verified: associated bill is marked as paid.</AlertDescription>
            </Alert>
          )}
          {billingPaid === false && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                This prescription is linked to a bill that is not marked as paid. Please confirm payment with the
                cashier before dispensing.
              </AlertDescription>
            </Alert>
          )}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3">
              <h3 className="font-semibold text-foreground">Patient Information</h3>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Name:</span>{" "}
                  <span className="text-foreground">{prescription.patientName}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Patient ID:</span>{" "}
                  <span className="text-foreground font-mono">{formatPatientNumber(patient?.patientNumber) ?? "-"}</span>
                </div>
                {patient && (
                  <>
                    <div>
                      <span className="text-muted-foreground">Age:</span>{" "}
                      <span className="text-foreground">
                        {patient.dateOfBirth ? new Date().getFullYear() - new Date(patient.dateOfBirth).getFullYear() : "N/A"}
                      </span>
                    </div>
                    {patient.allergies && (
                      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-2">
                        <p className="text-xs font-semibold text-destructive">Allergies: {patient.allergies}</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="font-semibold text-foreground">Prescription Information</h3>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Prescribed By:</span>{" "}
                  <span className="text-foreground">{prescription.doctorName}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Date:</span>{" "}
                  <span className="text-foreground">{prescription.date}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Status:</span>{" "}
                  <span className="text-foreground">{prescription.status}</span>
                </div>
              </div>
            </div>
          </div>

          {stockIssues.length > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <p className="font-semibold">Stock Issues:</p>
                <ul className="mt-2 list-inside list-disc">
                  {stockIssues.map((issue, index) => (
                    <li key={index}>{issue}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-3">
            <h3 className="font-semibold text-foreground">Medications</h3>
            <div className="space-y-3">
              {prescription.medications.map((med, index) => {
                const medication = getMedication(med.name)
                const hasStock = medication && medication.stockQuantity > 0
                const sufficientStock = medication && medication.stockQuantity >= (Number.parseInt(med.duration) || 1)

                // Check expiry date if available
                let expiryWarning: string | null = null
                if (medication?.expiryDate) {
                  const expiryDate = new Date(medication.expiryDate)
                  const today = new Date()
                  const daysUntilExpiry = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

                  if (expiryDate < today) {
                    expiryWarning = "Expired"
                  } else if (daysUntilExpiry <= 30) {
                    expiryWarning = `Expires in ${daysUntilExpiry} day${daysUntilExpiry !== 1 ? "s" : ""}`
                  }
                }

                return (
                  <Card key={index}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium text-foreground">{med.name}</p>
                            {!hasStock && <Badge variant="destructive">Out of Stock</Badge>}
                            {hasStock && !sufficientStock && <Badge variant="secondary">Low Stock</Badge>}
                            {sufficientStock && !expiryWarning && <Badge variant="default">Available</Badge>}
                            {expiryWarning && (
                              <Badge variant={expiryWarning === "Expired" ? "destructive" : "secondary"}>
                                {expiryWarning}
                              </Badge>
                            )}
                          </div>
                          <div className="mt-2 grid gap-2 text-sm md:grid-cols-2">
                            <div>
                              <span className="text-muted-foreground">Dosage:</span>{" "}
                              <span className="text-foreground">{med.dosage}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Frequency:</span>{" "}
                              <span className="text-foreground">{med.frequency}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Duration:</span>{" "}
                              <span className="text-foreground">{med.duration}</span>
                            </div>
                            {medication && (
                              <>
                                <div>
                                  <span className="text-muted-foreground">Stock:</span>{" "}
                                  <span className="text-foreground">{medication.stockQuantity} units</span>
                                </div>
                                {medication.expiryDate && (
                                  <div>
                                    <span className="text-muted-foreground">Expiry:</span>{" "}
                                    <span className={expiryWarning ? "font-medium text-amber-600" : "text-foreground"}>
                                      {medication.expiryDate}
                                    </span>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                          {expiryWarning && expiryWarning === "Expired" && (
                            <Alert variant="destructive" className="mt-2">
                              <AlertCircle className="h-4 w-4" />
                              <AlertDescription>
                                This medication has expired. Do not dispense expired medications.
                              </AlertDescription>
                            </Alert>
                          )}
                          {expiryWarning && expiryWarning !== "Expired" && (
                            <Alert variant="default" className="mt-2 border-amber-200 bg-amber-50">
                              <AlertCircle className="h-4 w-4 text-amber-600" />
                              <AlertDescription className="text-amber-800">
                                {expiryWarning}. Verify expiry date before dispensing.
                              </AlertDescription>
                            </Alert>
                          )}
                          {med.instructions && (
                            <p className="mt-2 text-sm text-muted-foreground">
                              <span className="font-medium">Instructions:</span> {med.instructions}
                            </p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </div>

          {prescription.status === "active" && (
            <div className="space-y-4 rounded-lg border border-border p-4">
              <h3 className="font-semibold text-foreground">Dispense Details</h3>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="witness-name">Witness Name (for controlled drugs)</Label>
                  <Input
                    id="witness-name"
                    value={witnessName}
                    onChange={(e) => setWitnessName(e.target.value)}
                    placeholder="Staff name witnessing dispense"
                    disabled={dispensing}
                  />
                </div>
                <div>
                  <Label htmlFor="dispensing-notes">Dispensing Notes</Label>
                  <Textarea
                    id="dispensing-notes"
                    value={dispensingNotes}
                    onChange={(e) => setDispensingNotes(e.target.value)}
                    placeholder="Any notes about this dispense..."
                    disabled={dispensing}
                    rows={3}
                  />
                </div>
              </div>

              {dispenseError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{dispenseError}</AlertDescription>
                </Alert>
              )}

              <Button onClick={handleDispense} disabled={dispensing} className="w-full">
                <CheckCircle className="mr-2 h-4 w-4" />
                {dispensing ? "Dispensing..." : "Dispense Prescription"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
