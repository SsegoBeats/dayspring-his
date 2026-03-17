"use client"

import { usePatients } from "@/lib/patient-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Phone, MapPin, Droplet, AlertCircle, Activity } from "lucide-react"
import { InsuranceAuthorizations, InsurancePolicies } from "@/components/patient/insurance-policies"
import { DocumentsList } from "@/components/patient/documents-list"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { TriageForm } from "@/components/patient/triage-form"
import { useEffect, useMemo, useState } from "react"
import { Separator } from "@/components/ui/separator"
import { EditPatientDialog } from "@/components/patient/edit-patient-dialog"
import { formatPatientNumber } from "@/lib/patients"
interface PatientDetailsProps {
  patientId: string
  onBack: () => void
}

export function PatientDetails({ patientId, onBack }: PatientDetailsProps) {
  const [triageOpen, setTriageOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [coverage, setCoverage] = useState<any | null>(null)
  const [coverageLoading, setCoverageLoading] = useState(false)
  const { getPatient, getPatientAppointments, refreshPatients } = usePatients()
  const patient = getPatient(patientId)
  const appointments = getPatientAppointments(patientId)

  const coverageBadges = useMemo(() => {
    const readiness = coverage?.summary?.readiness
    if (!readiness) return null
    return {
      hasActivePolicy: !!readiness.hasActivePolicy,
      readyForRestricted: readiness.readyForRestrictedServices !== false,
      missingVerification: readiness.missingVerification === true,
      missingPreauth: readiness.missingPreauth === true,
      missingDocuments: readiness.missingDocuments === true,
      missingTypes: Array.isArray(coverage?.summary?.documents?.missingRequiredTypes)
        ? coverage.summary.documents.missingRequiredTypes
        : [],
    }
  }, [coverage])

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()
    void (async () => {
      try {
        setCoverageLoading(true)
        const res = await fetch(`/api/insurance/coverage-summary?patientId=${encodeURIComponent(patientId)}`, {
          credentials: "include",
          signal: controller.signal,
        })
        if (!res.ok) throw new Error("Failed to load coverage summary")
        const data = await res.json()
        if (!cancelled) setCoverage(data)
      } catch {
        if (!cancelled) setCoverage(null)
      } finally {
        if (!cancelled) setCoverageLoading(false)
      }
    })()
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [patientId])

  if (!patient) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <p className="text-muted-foreground">Patient not found</p>
          <Button onClick={onBack} className="mt-4">
            Go Back
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Button variant="outline" onClick={onBack} aria-label="Back to patient list">
        <ArrowLeft className="mr-2 h-4 w-4" aria-hidden />
        Back to List
      </Button>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px] xl:items-start">
        <div className="space-y-4">
          <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>
                  {patient.firstName} {patient.lastName}
                </CardTitle>
                <CardDescription>
                  {(() => {
                    return `P.ID: ${formatPatientNumber(patient.patientNumber)}`
                  })()}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>Edit Patient</Button>
                <Button size="sm" variant="outline" onClick={() => setTriageOpen(true)}>Record Triage</Button>
                <Badge variant={patient.status === "active" ? "default" : "secondary"}>{patient.status}</Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
          {/* Three columns: 1) Personal + Contact, 2) Emergency + NOK, 3) Appointments */}
          <div className="grid gap-4 md:grid-cols-3">
            {/* Column 1: Personal + Contact together */}
            <div className="space-y-4 rounded-lg border bg-card p-4">
              <div className="space-y-3">
                <h3 className="font-semibold text-foreground tracking-tight">Personal Information</h3>
                <div className="space-y-2 text-sm leading-6">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Age:</span>
                    <span className="text-foreground">{patient.ageYears || '-'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Sex:</span>
                    <span className="text-foreground">{patient.gender}</span>
                  </div>
                  {patient.bloodGroup && (
                    <div className="flex items-center gap-2">
                      <Droplet className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Blood Group:</span>
                      <span className="text-foreground">{patient.bloodGroup}</span>
                    </div>
                  )}
                  {patient.triageCategory && (
                    <div className="flex items-center gap-2">
                      <Activity className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Triage:</span>
                      <span className="text-foreground">{patient.triageCategory}</span>
                    </div>
                  )}
                </div>
              </div>
              <Separator />
              <div className="space-y-3">
                <h3 className="font-semibold text-foreground tracking-tight">Contact Information</h3>
                <div className="space-y-2 text-sm leading-6">
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span className="text-foreground">{patient.phone}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <MapPin className="mt-0.5 h-4 w-4 text-muted-foreground" />
                    <span className="text-foreground">{patient.address}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Column 2: Emergency Contact + Next of Kin */}
            <div className="space-y-4 rounded-lg border bg-card p-4">
              <div className="space-y-3">
                <h3 className="font-semibold text-foreground tracking-tight">Emergency Contact</h3>
                <div className="space-y-1.5 text-sm leading-6">
                  <div>
                    <span className="text-muted-foreground">Name:</span>{' '}
                    <span className="text-foreground">{patient.emergencyContact || '-'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span className="text-foreground">{patient.emergencyPhone || '-'}</span>
                  </div>
                </div>
              </div>
              <Separator />
              <div className="space-y-3">
                <h3 className="font-semibold text-foreground tracking-tight">Next of Kin</h3>
                <div className="space-y-1.5 text-sm leading-6">
                  <div>
                    <span className="text-muted-foreground">Name:</span>{' '}
                    <span className="text-foreground">{patient.nextOfKinName || '-'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span className="text-foreground">{patient.nextOfKinPhone || '-'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Relationship:</span>{' '}
                    <span className="text-foreground">{patient.nextOfKinRelation || '-'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Residence:</span>{' '}
                    <span className="text-foreground">{patient.nextOfKinResidence || '-'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Column 3: Appointments */}
            <div className="space-y-3 rounded-lg border bg-card p-4">
              <h3 className="font-semibold text-foreground tracking-tight">Appointments</h3>
              {appointments.length === 0 ? (
                <p className="text-sm text-muted-foreground">No appointments scheduled</p>
              ) : (
                <div className="space-y-2">
                  {appointments.map((apt) => (
                    <div key={apt.id} className="rounded-lg border border-border p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-foreground">{apt.type}</p>
                          <p className="text-sm text-muted-foreground">{apt.date} at {apt.time}</p>
                        </div>
                        <Badge variant={apt.status === 'scheduled' ? 'default' : 'secondary'}>{apt.status}</Badge>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">Clinician: {apt.doctorName}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {(() => {
            const val = patient.allergies?.trim()
            if (!val) return null
            const hasAllergy = val.toLowerCase() !== "none"
            if (hasAllergy) {
              return (
                <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="mt-0.5 h-4 w-4 text-destructive" />
                    <div>
                      <p className="font-semibold text-destructive">Allergies</p>
                      <p className="text-sm text-foreground">{val}</p>
                    </div>
                  </div>
                </div>
              )
            }
            return (
              <div className="rounded-lg border border-muted bg-muted/30 p-4">
                <div className="flex items-start gap-2">
                  <AlertCircle className="mt-0.5 h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="font-semibold text-foreground">Allergies</p>
                    <p className="text-sm text-muted-foreground">None reported</p>
                  </div>
                </div>
              </div>
            )
          })()}
          </CardContent>
          </Card>
        </div>

        {/* Wide-screen sidebar */}
        <div className="hidden xl:block">
          <div className="sticky top-24 space-y-4">
            <Card className="border-slate-200 bg-white/95 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Coverage & billing readiness</CardTitle>
              <CardDescription>
                Quick view for insurance completeness. Cash/self-pay patients can proceed without these checks.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-lg border bg-muted/20 p-3 text-sm">
                <div className="font-semibold text-foreground">
                  {coverage?.primaryPolicy?.payer_name ? coverage.primaryPolicy.payer_name : "No insurance on file"}
                </div>
                <div className="text-xs text-muted-foreground">
                  {coverage?.primaryPolicy?.policy_no ? `Policy ${coverage.primaryPolicy.policy_no}` : "Proceed as cash/self-pay unless cover is added."}
                </div>
              </div>

              {coverageBadges ? (
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant={coverageBadges.hasActivePolicy ? "default" : "secondary"}>
                      {coverageBadges.hasActivePolicy ? "Has active policy" : "Cash/self-pay"}
                    </Badge>
                    <Badge variant={coverageBadges.readyForRestricted ? "outline" : "destructive"}>
                      {coverageBadges.readyForRestricted ? "Restricted services OK" : "Restricted services blocked"}
                    </Badge>
                  </div>
                  {(coverageBadges.missingVerification || coverageBadges.missingPreauth || coverageBadges.missingDocuments) ? (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                      <div className="font-semibold">Missing items</div>
                      <div className="mt-1 space-y-1">
                        {coverageBadges.missingVerification ? <div>- Verification missing</div> : null}
                        {coverageBadges.missingPreauth ? <div>- Authorization (preauth) missing</div> : null}
                        {coverageBadges.missingDocuments ? (
                          <div>- Documents missing{coverageBadges.missingTypes.length ? `: ${coverageBadges.missingTypes.join(", ")}` : ""}</div>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">{coverageLoading ? "Loading coverage..." : "Coverage summary unavailable."}</div>
              )}

              <div className="flex flex-col gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    document.getElementById("patient-insurance")?.scrollIntoView({ behavior: "smooth", block: "start" })
                  }}
                >
                  Open insurance
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    document.getElementById("patient-documents")?.scrollIntoView({ behavior: "smooth", block: "start" })
                  }}
                >
                  Open documents
                </Button>
                <Button
                  onClick={async () => {
                    try {
                      setCoverageLoading(true)
                      const res = await fetch(`/api/insurance/coverage-summary?patientId=${encodeURIComponent(patientId)}`, { credentials: "include" })
                      if (!res.ok) throw new Error("Failed")
                      setCoverage(await res.json())
                    } catch {
                      setCoverage(null)
                    } finally {
                      setCoverageLoading(false)
                    }
                  }}
                  disabled={coverageLoading}
                >
                  {coverageLoading ? "Refreshing..." : "Refresh coverage"}
                </Button>
              </div>
            </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Below patient details: insurance + documents + detached sections */}
      <Separator />
      <div className="rounded-lg bg-muted/20 p-2">
        <div id="patient-insurance-docs" className="grid min-w-0 gap-4 xl:grid-cols-2">
          <Card id="patient-insurance" className="min-w-0 overflow-hidden border-border/80 shadow-sm">
            <CardContent className="p-4">
              <InsurancePolicies patientId={patientId} hideAuthorizations hideRecords hideAddPayer />
            </CardContent>
          </Card>

          <Card id="patient-documents" className="min-w-0 overflow-hidden border-border/80 shadow-sm">
            <CardContent className="p-4">
              <DocumentsList patientId={patientId} />
            </CardContent>
          </Card>
        </div>

        {/* Full-width: detach authorizations from left column */}
        <div className="mt-4 min-w-0">
          <InsuranceAuthorizations patientId={patientId} hideRecords />
        </div>

        {/* Full-width: detach policy records + payer management */}
        <div className="mt-4 min-w-0">
          <InsurancePolicies patientId={patientId} hideAuthorizations hideIntake hideRecords compact />
        </div>

        {/* Last row: two columns (preauth records + policy records) */}
        <div className="mt-4 grid min-w-0 items-stretch gap-4 xl:grid-cols-2">
          <InsuranceAuthorizations patientId={patientId} hideTracker />
          <InsurancePolicies patientId={patientId} hideAuthorizations hideIntake hideAddPayer compact />
        </div>
      </div>

      <Dialog open={triageOpen} onOpenChange={setTriageOpen}>
        <DialogContent size="xl" className="max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Triage Assessment - {patient.firstName} {patient.lastName}</DialogTitle>
            <DialogDescription>Record triage category, vital signs, and chief complaint for this patient.</DialogDescription>
          </DialogHeader>
          <TriageForm
            patientId={patientId}
            onSaved={async () => {
              try { await refreshPatients() } catch {}
              try { setTriageOpen(false) } catch {}
            }}
          />
        </DialogContent>
      </Dialog>
      <EditPatientDialog open={editOpen} onOpenChange={setEditOpen} patient={patient} />
    </div>
  )
}















