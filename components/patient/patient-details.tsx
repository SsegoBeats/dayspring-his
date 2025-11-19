"use client"

import { usePatients } from "@/lib/patient-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Phone, MapPin, Droplet, AlertCircle, Activity } from "lucide-react"
import { InsurancePolicies } from "@/components/patient/insurance-policies"
import { DocumentsList } from "@/components/patient/documents-list"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { TriageForm } from "@/components/patient/triage-form"
import { useState } from "react"
import { Separator } from "@/components/ui/separator"
import { EditPatientDialog } from "@/components/patient/edit-patient-dialog"
import { formatPatientDigits } from "@/lib/patients"
interface PatientDetailsProps {
  patientId: string
  onBack: () => void
}

export function PatientDetails({ patientId, onBack }: PatientDetailsProps) {
  const [triageOpen, setTriageOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const { getPatient, getPatientAppointments, refreshPatients } = usePatients()
  const patient = getPatient(patientId)
  const appointments = getPatientAppointments(patientId)

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
      <Button variant="outline" onClick={onBack}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to List
      </Button>

      <Card>
      <CardHeader>
  <div className="flex items-center justify-between">
    <div>
      <CardTitle>
        {patient.firstName} {patient.lastName}
      </CardTitle>
      <CardDescription>
        {(() => {
          const pidDigits = formatPatientDigits(patient.patientNumber)
          return `P.ID: ${pidDigits ? `P.${pidDigits}` : "-"}`
        })()}
      </CardDescription>
    </div>
    <div className="flex items-center gap-2">
      <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>Edit Patient</Button>
      <Button size="sm" variant="outline" onClick={() => setTriageOpen(true)}>Record Triage</Button>
      <Badge variant={patient.status === "active" ? "default" : "secondary"}>{patient.status}</Badge>
    </div>
  </div>
</CardHeader><CardContent className="space-y-6">
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

          {patient.allergies && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
              <div className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 h-4 w-4 text-destructive" />
                <div>
                  <p className="font-semibold text-destructive">Allergies</p>
                  <p className="text-sm text-foreground">{patient.allergies}</p>
                </div>
              </div>
            </div>
          )}

          <Separator />
          {/* Insurance and Documents side by side */}
          <div className="grid gap-4 md:grid-cols-[1.6fr_1fr]">
            <div className="rounded-lg border bg-card p-4">
              <InsurancePolicies patientId={patientId} />
            </div>
            <div className="rounded-lg border bg-card p-4">
              <DocumentsList patientId={patientId} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={triageOpen} onOpenChange={setTriageOpen}>
        <DialogContent className="w-[min(96vw,1000px)] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Triage Assessment - {patient.firstName} {patient.lastName}</DialogTitle>
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















