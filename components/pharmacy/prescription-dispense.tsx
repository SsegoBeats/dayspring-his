"use client"

import { useState } from "react"
import { useMedical } from "@/lib/medical-context"
import { usePharmacy } from "@/lib/pharmacy-context"
import { usePatients } from "@/lib/patient-context"
import { useAudit } from "@/lib/audit-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, CheckCircle, AlertCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useToast } from "@/hooks/use-toast"

interface PrescriptionDispenseProps {
  prescriptionId: string
  onBack: () => void
  billingPaid?: boolean
}

export function PrescriptionDispense({ prescriptionId, onBack, billingPaid }: PrescriptionDispenseProps) {
  const { prescriptions, updatePrescription } = useMedical()
  const { medications, updateMedication, getMedication } = usePharmacy()
  const { getPatient } = usePatients()
  const { logAction } = useAudit()
  const { toast } = useToast()
  const prescription = prescriptions.find((p) => p.id === prescriptionId)
  const patient = prescription ? getPatient(prescription.patientId) : null

  const [dispensing, setDispensing] = useState(false)
  const [stockIssues, setStockIssues] = useState<string[]>([])

  if (!prescription) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <p className="text-muted-foreground">Prescription not found</p>
          <Button onClick={onBack} className="mt-4">
            Go Back
          </Button>
        </CardContent>
      </Card>
    )
  }

  const checkStock = () => {
    const issues: string[] = []
    prescription.medications.forEach((med) => {
      const medication = getMedication(med.name)
      if (!medication) {
        issues.push(`${med.name} not found in inventory`)
      } else if (medication.stockQuantity < Number.parseInt(med.duration) || medication.stockQuantity === 0) {
        issues.push(`${med.name} has insufficient stock (Available: ${medication.stockQuantity})`)
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

    // Update stock for each medication using FEFO batch selection and track usage analytics
    const dispensePromises = prescription.medications.map(async (med) => {
      const medication = getMedication(med.name)
      if (medication) {
        const quantityToDispense = Number.parseInt(med.duration) || 1

        // Get FEFO batch suggestions
        try {
          const batchesRes = await fetch(
            `/api/pharmacy/batches?medicationId=${encodeURIComponent(medication.id)}&quantity=${quantityToDispense}`,
            { credentials: "include" },
          )

          if (batchesRes.ok) {
            const batchesData = await batchesRes.json()
            const suggestedBatches = batchesData.suggestedBatches || []

            if (suggestedBatches.length > 0) {
              // Dispense from batches using FEFO
              for (const batch of suggestedBatches) {
                try {
                  await fetch("/api/pharmacy/batches", {
                    method: "PATCH",
                    credentials: "include",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      batchId: batch.batchId,
                      quantity: Math.max(0, Number(batch.quantity) - quantityToDispense),
                    }),
                  })
                } catch (err) {
                  console.error("Failed to update batch:", err)
                }
              }

              // Record dispense in stock movements with batch info
              try {
                await fetch("/api/pharmacy/stock-movements", {
                  method: "POST",
                  credentials: "include",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    medicationId: medication.id,
                    movementType: "Dispense",
                    quantity: quantityToDispense,
                    reference: `Prescription: ${prescription.id}`,
                    batchNumber: suggestedBatches[0]?.batchNumber,
                    expiryDate: suggestedBatches[0]?.expiryDate,
                  }),
                })
              } catch (err) {
                console.error("Failed to record stock movement:", err)
              }
            }
          }
        } catch (err) {
          console.error("Failed to get batches, using fallback:", err)
        }

        // Fallback: update medication stock directly (for backward compatibility)
        updateMedication(medication.id, {
          stockQuantity: medication.stockQuantity - quantityToDispense,
        })

        // Record usage analytics
        try {
          await fetch("/api/pharmacy/usage-analytics", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              medicationId: medication.id,
              quantity: quantityToDispense,
              prescriptionId: prescription.id,
            }),
          })
        } catch (err) {
          console.error("Failed to record usage analytics:", err)
          // Non-fatal, continue with dispensing
        }
      }
    })

    await Promise.all(dispensePromises)

    // Update prescription status
    updatePrescription(prescription.id, { status: "completed" })

    // Fire and forget audit log
    void logAction(
      "DISPENSE",
      "PHARMACY",
      "Prescription",
      prescription.id,
      `Dispensed prescription for patient ${prescription.patientName}`,
      undefined,
      {
        medications: prescription.medications,
        billingPaid: billingPaid === true,
        stockSnapshot: medications.map((m) => ({
          id: m.id,
          name: m.name,
          stockQuantity: m.stockQuantity,
        })),
      },
    )

    toast({
      title: "Prescription dispensed",
      description: `Successfully dispensed ${prescription.medications.length} medication(s) for ${prescription.patientName}.`,
      variant: "default",
    })
    
    // Small delay to show toast before navigating back
    setTimeout(() => {
      onBack()
    }, 500)
  }

  return (
    <div className="space-y-4">
      <Button variant="outline" onClick={onBack}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Queue
      </Button>

      <Card>
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
                  <span className="text-foreground">{prescription.patientId}</span>
                </div>
                {patient && (
                  <>
                    <div>
                      <span className="text-muted-foreground">Age:</span>{" "}
                      <span className="text-foreground">
                        {new Date().getFullYear() - new Date(patient.dateOfBirth).getFullYear()}
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
            <Button onClick={handleDispense} disabled={dispensing} className="w-full">
              <CheckCircle className="mr-2 h-4 w-4" />
              {dispensing ? "Dispensing..." : "Dispense Prescription"}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
