"use client"
import { useState, useEffect } from "react"
import { usePatients } from "@/lib/patient-context"
import { useMedical } from "@/lib/medical-context"
import { useAuth } from "@/lib/auth-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, AlertCircle, FileText, Pill } from "lucide-react"
import { formatPatientNumber } from "@/lib/patients"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { OrderLabTest } from "@/components/doctor/order-lab-test"
import { useLab } from "@/lib/lab-context"

interface PatientConsultationProps {
  patientId: string
  onBack: () => void
  initialTab?: 'consultation' | 'prescription' | 'history' | 'labs'
}

export function PatientConsultation({ patientId, onBack, initialTab = 'consultation' }: PatientConsultationProps) {
  const { getPatient } = usePatients()
  const { addMedicalRecord, addPrescription, getPatientMedicalRecords, getPatientPrescriptions, getPatientLabResults, updateLabResult } =
    useMedical()
  const { user } = useAuth()
  const patient = getPatient(patientId)
  const medicalHistory = getPatientMedicalRecords(patientId)
  const prescriptions = getPatientPrescriptions(patientId)
  const { tests: labTests, refresh: refreshLab } = useLab()
  const [labResults, setLabResults] = useState<any[]>(labTests.filter(t=> t.patientId === patientId))
  const latestRecord = medicalHistory.length ? medicalHistory[medicalHistory.length - 1] : null
  // Patient-scoped SSE for efficient live updates in dialog
  ;(require('react') as any).useEffect(() => {
    try {
      const hasCookie = typeof document !== 'undefined' && /(?:^|;\s)(session=|session_dev=)/.test(document.cookie)
      const tokenMatch = typeof document !== 'undefined' ? (document.cookie.match(/(?:^|;\s)session_dev=([^;]+)/) || document.cookie.match(/(?:^|;\s)session=([^;]+)/)) : null
      const token = tokenMatch ? decodeURIComponent(tokenMatch[1]) : (typeof localStorage !== 'undefined' ? localStorage.getItem('session_dev_bearer') : null)
      const url = new URL('/api/lab-tests/stream', window.location.origin)
      url.searchParams.set('patientId', patientId)
      if (!hasCookie && token) url.searchParams.set('t', token as any)
      const es = new (window as any).EventSource(url.toString(), { withCredentials: true })
      es.onmessage = (ev: MessageEvent) => { try { const data = JSON.parse(ev.data); if (Array.isArray(data.tests)) setLabResults(data.tests) } catch {} }
      es.onerror = () => { try { es.close() } catch {} }
      return () => { try { es.close() } catch {} }
    } catch {}
  }, [patientId])
  const [orderOpen, setOrderOpen] = useState(false)
  const [selectedLabId, setSelectedLabId] = useState<string | null>(null)

  const [consultationForm, setConsultationForm] = useState({
    symptoms: "",
    diagnosis: "",
    treatment: "",
    notes: "",
    bloodPressure: "",
    temperature: "",
    heartRate: "",
    respiratoryRate: "",
    oxygenSaturation: "",
  })

  const [prescriptionForm, setPrescriptionForm] = useState({
    medications: [
      {
        name: "",
        dosage: "",
        frequency: "",
        duration: "",
        instructions: "",
      },
    ],
  })

  const [obstetricForm, setObstetricForm] = useState({
    gravida: "",
    parity: "",
    gestationalAgeWeeks: "",
    edd: "",
    fundalHeightCm: "",
    fetalHeartRate: "",
    presentation: "",
    notes: "",
  })

  const [dentalForm, setDentalForm] = useState({
    diagnosis: "",
    procedurePerformed: "",
    toothNotes: "",
  })

  const [obstetricHistory, setObstetricHistory] = useState<any[]>([])
  const [dentalHistory, setDentalHistory] = useState<any[]>([])

  const handleAddMedication = () => {
    setPrescriptionForm({
      medications: [
        ...prescriptionForm.medications,
        {
          name: "",
          dosage: "",
          frequency: "",
          duration: "",
          instructions: "",
        },
      ],
    })
  }

  const handleRemoveMedication = (index: number) => {
    setPrescriptionForm({
      medications: prescriptionForm.medications.filter((_, i) => i !== index),
    })
  }

  const handleMedicationChange = (index: number, field: string, value: string) => {
    const newMedications = [...prescriptionForm.medications]
    newMedications[index] = { ...newMedications[index], [field]: value }
    setPrescriptionForm({ medications: newMedications })
  }

  const handleSaveConsultation = () => {
    if (!patient || !user) return

    addMedicalRecord({
      patientId: patient.id,
      patientName: `${patient.firstName} ${patient.lastName}`,
      doctorName: user.name,
      date: new Date().toISOString().split("T")[0],
      diagnosis: consultationForm.diagnosis,
      symptoms: consultationForm.symptoms,
      treatment: consultationForm.treatment,
      notes: consultationForm.notes,
      vitalSigns: {
        bloodPressure: consultationForm.bloodPressure,
        temperature: consultationForm.temperature,
        heartRate: consultationForm.heartRate,
        respiratoryRate: consultationForm.respiratoryRate,
        oxygenSaturation: consultationForm.oxygenSaturation,
      },
    })

    // Reset form
    setConsultationForm({
      symptoms: "",
      diagnosis: "",
      treatment: "",
      notes: "",
      bloodPressure: "",
      temperature: "",
      heartRate: "",
      respiratoryRate: "",
      oxygenSaturation: "",
    })

    alert("Consultation saved successfully!")
  }

  const handleSavePrescription = () => {
    if (!patient || !user) return

    const validMedications = prescriptionForm.medications.filter((med) => med.name && med.dosage)

    if (validMedications.length === 0) {
      alert("Please add at least one medication")
      return
    }

    addPrescription({
      patientId: patient.id,
      patientName: `${patient.firstName} ${patient.lastName}`,
      doctorName: user.name,
      date: new Date().toISOString().split("T")[0],
      medications: validMedications,
      status: "active",
    })

    ;(async () => {
      try {
        await fetch("/api/billing", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            patientId: patient.id,
            source: "prescription",
            medications: validMedications.map((m) => ({
              name: m.name,
              dosage: m.dosage,
              frequency: m.frequency,
              duration: m.duration,
            })),
          }),
        })
      } catch {
        // If billing creation fails, we still keep the prescription; cashier can create a bill manually.
      }
    })()

    // Reset form
    setPrescriptionForm({
      medications: [
        {
          name: "",
          dosage: "",
          frequency: "",
          duration: "",
          instructions: "",
        },
      ],
    })

    alert("Prescription saved successfully!")
  }

  const handleSaveObstetricAssessment = async () => {
    if (!patient || !user) return

    try {
      const payload: any = {
        patientId: patient.id,
        notes: obstetricForm.notes || null,
        presentation: obstetricForm.presentation || null,
      }
      if (obstetricForm.gravida) payload.gravida = Number(obstetricForm.gravida)
      if (obstetricForm.parity) payload.parity = Number(obstetricForm.parity)
      if (obstetricForm.gestationalAgeWeeks) payload.gestationalAgeWeeks = Number(obstetricForm.gestationalAgeWeeks)
      if (obstetricForm.edd) payload.edd = obstetricForm.edd
      if (obstetricForm.fundalHeightCm) payload.fundalHeightCm = Number(obstetricForm.fundalHeightCm)
      if (obstetricForm.fetalHeartRate) payload.fetalHeartRate = Number(obstetricForm.fetalHeartRate)

      const res = await fetch("/api/obstetrics/assessments", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Failed to save assessment")
      }
      alert("Obstetric assessment saved successfully.")
    } catch (e: any) {
      alert(e?.message || "Failed to save obstetric assessment")
    }
  }

  const handleSaveDentalRecord = async () => {
    if (!patient || !user) return

    try {
      const payload: any = {
        patientId: patient.id,
        diagnosis: dentalForm.diagnosis || null,
        procedurePerformed: dentalForm.procedurePerformed || null,
        toothChart: dentalForm.toothNotes ? { notes: dentalForm.toothNotes } : null,
      }
      const res = await fetch("/api/dental/records", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Failed to save dental record")
      }
      alert("Dental record saved successfully.")
    } catch (e: any) {
      alert(e?.message || "Failed to save dental record")
    }
  }

  useEffect(() => {
    if (!patient) return

    ;(async () => {
      try {
        const res = await fetch(`/api/obstetrics/assessments?patientId=${encodeURIComponent(patient.id)}`, {
          credentials: "include",
        })
        if (res.ok) {
          const data = await res.json().catch(() => ({}))
          setObstetricHistory(Array.isArray(data.assessments) ? data.assessments : [])
        } else {
          setObstetricHistory([])
        }
      } catch {
        setObstetricHistory([])
      }
    })()

    ;(async () => {
      try {
        const res = await fetch(`/api/dental/records?patientId=${encodeURIComponent(patient.id)}`, {
          credentials: "include",
        })
        if (res.ok) {
          const data = await res.json().catch(() => ({}))
          setDentalHistory(Array.isArray(data.records) ? data.records : [])
        } else {
          setDentalHistory([])
        }
      } catch {
        setDentalHistory([])
      }
    })()
  }, [patient?.id])

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
      <div className="flex items-center gap-2">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Queue
        </Button>
        <Button variant="secondary" size="sm" className="ml-auto no-print" onClick={() => window.print()}>
          Print Summary
        </Button>
      </div>
      <style>{`@media print {.no-print { display:none !important; } .only-print { display:block !important; } } @media screen { .only-print { display:none; } }`}</style>
      <div className="only-print hidden border rounded p-4 text-sm space-y-2 bg-white">
        <h2 className="text-lg font-semibold">Clinician Summary</h2>
        <div>Patient: {patient.firstName} {patient.lastName} (PID: {patient.patientNumber ? formatPatientNumber(patient.patientNumber) : patient.id})</div>
        <div>Printed by: {user?.email || user?.name || "-"}</div>
        <div className="grid grid-cols-2 gap-2">
          <div>Age: {(patient as any).ageYears ?? "-"}</div>
          <div>Blood: {patient.bloodGroup || "-"}</div>
          <div>Sex: {patient.gender || "-"}</div>
          <div>Date: {new Date().toLocaleString()}</div>
        </div>
        <div>
          <div className="font-semibold">Vitals</div>
          <div className="border p-2 rounded">
            BP: {latestRecord?.vitalSigns?.bloodPressure || "-"}, Temp: {latestRecord?.vitalSigns?.temperature || "-"}, HR: {latestRecord?.vitalSigns?.heartRate || "-"}, RR: {latestRecord?.vitalSigns?.respiratoryRate || "-"}, SpO₂: {latestRecord?.vitalSigns?.oxygenSaturation || "-"}
          </div>
        </div>
        <div>
          <div className="font-semibold">Symptoms / Complaints</div>
          <div className="border p-2 rounded min-h-[40px]">{latestRecord?.symptoms || "-"}</div>
        </div>
        <div>
          <div className="font-semibold">History</div>
          <div className="border p-2 rounded min-h-[40px]">{latestRecord?.diagnosis || "-"}</div>
        </div>
        <div>
          <div className="font-semibold">Plan</div>
          <div className="border p-2 rounded min-h-[40px]">{latestRecord?.treatment || latestRecord?.notes || "-"}</div>
        </div>
        <div>
          <div className="font-semibold">Results</div>
          <div className="border p-2 rounded min-h-[40px]">
            {labResults.length === 0 ? "-" : labResults.map((l) => `${l.testName || l.testType || ""}: ${l.results || l.status || ""}`).join("; ")}
          </div>
        </div>
        <div>
          <div className="font-semibold">Prescription</div>
          <div className="border p-2 rounded min-h-[40px]">
            {prescriptions.length === 0
              ? "-"
              : prescriptions
                  .map((p) =>
                    p.medications
                      ?.map((m: any) => `${m.name}${m.dosage ? " (" + m.dosage + ")" : ""}${m.frequency ? " " + m.frequency : ""}${m.duration ? " for " + m.duration : ""}`)
                      .join(", "),
                  )
                  .join("; ")}
          </div>
        </div>
        <div>
          <div className="font-semibold">Instructions</div>
          <div className="border p-2 rounded min-h-[40px]">{latestRecord?.notes || "-"}</div>
        </div>
        <div className="pt-2">
          <div className="font-semibold">Signature / Stamp</div>
          <div className="h-12 border-b" />
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>
                {patient.firstName} {patient.lastName}
              </CardTitle>
              <CardDescription>
                Patient ID: {patient.patientNumber ? formatPatientNumber(patient.patientNumber) : patient.id}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Badge variant="outline">
                {(() => {
                  const derived = patient.dateOfBirth && !Number.isNaN(new Date(patient.dateOfBirth).getTime())
                    ? Math.max(0, new Date().getFullYear() - new Date(patient.dateOfBirth).getFullYear())
                    : null
                  const age = (patient as any).ageYears ?? derived
                  return 'Age: ' + (age ?? '-')
                })()}
              </Badge>
              {patient.bloodGroup && <Badge variant="outline">Blood: {patient.bloodGroup}</Badge>}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {(() => {
            const val = patient.allergies?.trim()
            const hasAllergy = !!val && val.toLowerCase() !== "none"
            if (!val) return null
            if (hasAllergy) {
              return (
                <div className="mb-4 rounded-lg border border-destructive/50 bg-destructive/10 p-3">
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
              <div className="mb-4 rounded-lg border border-muted bg-muted/30 p-3">
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

          <Tabs defaultValue={initialTab}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="consultation">Consultation</TabsTrigger>
              <TabsTrigger value="prescription">Prescription</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
              <TabsTrigger value="labs">Lab Results</TabsTrigger>
            </TabsList>

            <TabsContent value="consultation" className="space-y-4">
              <div className="space-y-4">
                <div>
                  <h3 className="mb-3 font-semibold text-foreground">Vital Signs</h3>
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-2">
                      <Label htmlFor="bloodPressure">Blood Pressure</Label>
                      <Input
                        id="bloodPressure"
                        placeholder="120/80"
                        value={consultationForm.bloodPressure}
                        onChange={(e) => setConsultationForm({ ...consultationForm, bloodPressure: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="temperature">Temperature</Label>
                      <Input
                        id="temperature"
                        placeholder="98.6°F"
                        value={consultationForm.temperature}
                        onChange={(e) => setConsultationForm({ ...consultationForm, temperature: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="heartRate">Heart Rate</Label>
                      <Input
                        id="heartRate"
                        placeholder="72 bpm"
                        value={consultationForm.heartRate}
                        onChange={(e) => setConsultationForm({ ...consultationForm, heartRate: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="respiratoryRate">Respiratory Rate</Label>
                      <Input
                        id="respiratoryRate"
                        placeholder="16/min"
                        value={consultationForm.respiratoryRate}
                        onChange={(e) => setConsultationForm({ ...consultationForm, respiratoryRate: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="oxygenSaturation">Oxygen Saturation</Label>
                      <Input
                        id="oxygenSaturation"
                        placeholder="98%"
                        value={consultationForm.oxygenSaturation}
                        onChange={(e) => setConsultationForm({ ...consultationForm, oxygenSaturation: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                {user?.role === "Midwife" && (
                  <div className="space-y-4 rounded-lg border border-rose-200 bg-rose-50/40 p-4">
                    <h3 className="font-semibold text-foreground">Obstetric Details</h3>
                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="space-y-2">
                        <Label htmlFor="gravida">Gravida</Label>
                        <Input
                          id="gravida"
                          value={obstetricForm.gravida}
                          onChange={(e) => setObstetricForm({ ...obstetricForm, gravida: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="parity">Parity</Label>
                        <Input
                          id="parity"
                          value={obstetricForm.parity}
                          onChange={(e) => setObstetricForm({ ...obstetricForm, parity: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="gestAge">Gestational Age (weeks)</Label>
                        <Input
                          id="gestAge"
                          value={obstetricForm.gestationalAgeWeeks}
                          onChange={(e) => setObstetricForm({ ...obstetricForm, gestationalAgeWeeks: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="edd">EDD</Label>
                        <Input
                          id="edd"
                          type="date"
                          value={obstetricForm.edd}
                          onChange={(e) => setObstetricForm({ ...obstetricForm, edd: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="fundalHeight">Fundal Height (cm)</Label>
                        <Input
                          id="fundalHeight"
                          value={obstetricForm.fundalHeightCm}
                          onChange={(e) => setObstetricForm({ ...obstetricForm, fundalHeightCm: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="fhr">Fetal Heart Rate</Label>
                        <Input
                          id="fhr"
                          value={obstetricForm.fetalHeartRate}
                          onChange={(e) => setObstetricForm({ ...obstetricForm, fetalHeartRate: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2 md:col-span-3">
                        <Label htmlFor="presentation">Presentation</Label>
                        <Input
                          id="presentation"
                          placeholder="Cephalic, breech, transverse..."
                          value={obstetricForm.presentation}
                          onChange={(e) => setObstetricForm({ ...obstetricForm, presentation: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2 md:col-span-3">
                        <Label htmlFor="obNotes">Obstetric Notes</Label>
                        <Textarea
                          id="obNotes"
                          placeholder="Any obstetric-specific notes..."
                          value={obstetricForm.notes}
                          onChange={(e) => setObstetricForm({ ...obstetricForm, notes: e.target.value })}
                        />
                      </div>
                    </div>
                    <Button variant="outline" onClick={handleSaveObstetricAssessment}>
                      Save Obstetric Assessment
                    </Button>
                  </div>
                )}

                {user?.role === "Dentist" && (
                  <div className="space-y-4 rounded-lg border border-sky-200 bg-sky-50/40 p-4">
                    <h3 className="font-semibold text-foreground">Dental Findings</h3>
                    <div className="space-y-2">
                      <Label htmlFor="dentDiag">Dental Diagnosis</Label>
                      <Textarea
                        id="dentDiag"
                        placeholder="Caries, pulpitis, periodontal disease..."
                        value={dentalForm.diagnosis}
                        onChange={(e) => setDentalForm({ ...dentalForm, diagnosis: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="dentProc">Procedure Performed</Label>
                      <Textarea
                        id="dentProc"
                        placeholder="Extraction, filling, root canal, scaling..."
                        value={dentalForm.procedurePerformed}
                        onChange={(e) => setDentalForm({ ...dentalForm, procedurePerformed: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="toothNotes">Tooth/Chart Notes</Label>
                      <Textarea
                        id="toothNotes"
                        placeholder="Tooth numbers and specific findings..."
                        value={dentalForm.toothNotes}
                        onChange={(e) => setDentalForm({ ...dentalForm, toothNotes: e.target.value })}
                      />
                    </div>
                    <Button variant="outline" onClick={handleSaveDentalRecord}>
                      Save Dental Record
                    </Button>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="symptoms">Symptoms</Label>
                  <Textarea
                    id="symptoms"
                    placeholder="Describe patient symptoms..."
                    value={consultationForm.symptoms}
                    onChange={(e) => setConsultationForm({ ...consultationForm, symptoms: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="diagnosis">Diagnosis</Label>
                  <Input
                    id="diagnosis"
                    placeholder="Enter diagnosis..."
                    value={consultationForm.diagnosis}
                    onChange={(e) => setConsultationForm({ ...consultationForm, diagnosis: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="treatment">Treatment Plan</Label>
                  <Textarea
                    id="treatment"
                    placeholder="Describe treatment plan..."
                    value={consultationForm.treatment}
                    onChange={(e) => setConsultationForm({ ...consultationForm, treatment: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Additional Notes</Label>
                  <Textarea
                    id="notes"
                    placeholder="Any additional notes..."
                    value={consultationForm.notes}
                    onChange={(e) => setConsultationForm({ ...consultationForm, notes: e.target.value })}
                  />
                </div>

                <Button onClick={handleSaveConsultation} className="w-full">
                  <FileText className="mr-2 h-4 w-4" />
                  Save Consultation
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="prescription" className="space-y-4">
              <div className="space-y-4">
                {prescriptionForm.medications.map((med, index) => (
                  <Card key={index}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">Medication {index + 1}</CardTitle>
                        {prescriptionForm.medications.length > 1 && (
                          <Button variant="destructive" size="sm" onClick={() => handleRemoveMedication(index)}>
                            Remove
                          </Button>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Medication Name</Label>
                          <Input
                            placeholder="e.g., Amoxicillin"
                            value={med.name}
                            onChange={(e) => handleMedicationChange(index, "name", e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Dosage</Label>
                          <Input
                            placeholder="e.g., 500mg"
                            value={med.dosage}
                            onChange={(e) => handleMedicationChange(index, "dosage", e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Frequency</Label>
                          <Input
                            placeholder="e.g., Twice daily"
                            value={med.frequency}
                            onChange={(e) => handleMedicationChange(index, "frequency", e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Duration</Label>
                          <Input
                            placeholder="e.g., 7 days"
                            value={med.duration}
                            onChange={(e) => handleMedicationChange(index, "duration", e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Instructions</Label>
                        <Textarea
                          placeholder="e.g., Take with food"
                          value={med.instructions}
                          onChange={(e) => handleMedicationChange(index, "instructions", e.target.value)}
                        />
                      </div>
                    </CardContent>
                  </Card>
                ))}

                <div className="flex gap-2">
                  <Button variant="outline" onClick={handleAddMedication} className="flex-1 bg-transparent">
                    Add Another Medication
                  </Button>
                  <Button onClick={handleSavePrescription} className="flex-1">
                    <Pill className="mr-2 h-4 w-4" />
                    Save Prescription
                  </Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="history" className="space-y-3">
              {medicalHistory.length === 0 && obstetricHistory.length === 0 && dentalHistory.length === 0 ? (
                <p className="text-center text-muted-foreground">No medical or specialty history available</p>
              ) : (
                <>
                  {medicalHistory.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="text-sm font-semibold text-foreground">Medical Consultations</h3>
                      {medicalHistory
                        .slice()
                        .reverse()
                        .map((record) => (
                          <Card key={record.id}>
                            <CardHeader>
                              <div className="flex items-center justify-between">
                                <CardTitle className="text-base">{record.diagnosis}</CardTitle>
                                <Badge variant="outline">{record.date}</Badge>
                              </div>
                              <CardDescription>Dr. {record.doctorName}</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-2 text-sm">
                              <div>
                                <span className="font-medium text-foreground">Symptoms:</span>
                                <p className="text-muted-foreground">{record.symptoms}</p>
                              </div>
                              <div>
                                <span className="font-medium text-foreground">Treatment:</span>
                                <p className="text-muted-foreground">{record.treatment}</p>
                              </div>
                              {record.vitalSigns && (
                                <div>
                                  <span className="font-medium text-foreground">Vital Signs:</span>
                                  <div className="mt-1 grid grid-cols-2 gap-2 text-muted-foreground">
                                    {record.vitalSigns.bloodPressure && <span>BP: {record.vitalSigns.bloodPressure}</span>}
                                    {record.vitalSigns.temperature && <span>Temp: {record.vitalSigns.temperature}</span>}
                                    {record.vitalSigns.heartRate && <span>HR: {record.vitalSigns.heartRate}</span>}
                                    {record.vitalSigns.oxygenSaturation && (
                                      <span>SpO2: {record.vitalSigns.oxygenSaturation}</span>
                                    )}
                                  </div>
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        ))}
                    </div>
                  )}

                  {obstetricHistory.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="text-sm font-semibold text-foreground">Obstetric Assessments</h3>
                      {obstetricHistory.map((a: any) => (
                        <Card key={a.id} className="border-rose-200">
                          <CardHeader>
                            <div className="flex items-center justify-between">
                              <CardTitle className="text-base">Obstetric Assessment</CardTitle>
                              <Badge variant="outline">
                                {a.visit_date ? String(a.visit_date).slice(0, 10) : ""}
                              </Badge>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-2 text-sm">
                            <div className="flex flex-wrap gap-3 text-muted-foreground">
                              {a.gravida != null && <span>G: {a.gravida}</span>}
                              {a.parity != null && <span>P: {a.parity}</span>}
                              {a.gestational_age_weeks != null && (
                                <span>GA: {a.gestational_age_weeks} weeks</span>
                              )}
                              {a.fundal_height_cm != null && <span>FH: {a.fundal_height_cm} cm</span>}
                              {a.fetal_heart_rate != null && <span>FHR: {a.fetal_heart_rate} bpm</span>}
                              {a.presentation && <span>Presentation: {a.presentation}</span>}
                              {a.edd && <span>EDD: {String(a.edd).slice(0, 10)}</span>}
                            </div>
                            {a.notes && (
                              <div>
                                <span className="font-medium text-foreground">Notes:</span>
                                <p className="text-muted-foreground">{a.notes}</p>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}

                  {dentalHistory.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="text-sm font-semibold text-foreground">Dental Records</h3>
                      {dentalHistory.map((d: any) => (
                        <Card key={d.id} className="border-sky-200">
                          <CardHeader>
                            <div className="flex items-center justify-between">
                              <CardTitle className="text-base">{d.diagnosis || "Dental Visit"}</CardTitle>
                              <Badge variant="outline">
                                {d.visit_date ? String(d.visit_date).slice(0, 10) : ""}
                              </Badge>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-2 text-sm">
                            {d.procedure_performed && (
                              <div>
                                <span className="font-medium text-foreground">Procedure:</span>
                                <p className="text-muted-foreground">{d.procedure_performed}</p>
                              </div>
                            )}
                            {d.tooth_chart && (
                              <div>
                                <span className="font-medium text-foreground">Tooth/Chart Notes:</span>
                                <p className="text-muted-foreground">
                                  {typeof d.tooth_chart.notes === "string"
                                    ? d.tooth_chart.notes
                                    : JSON.stringify(d.tooth_chart)}
                                </p>
                              </div>
                            )}
                            {d.notes && (
                              <div>
                                <span className="font-medium text-foreground">Notes:</span>
                                <p className="text-muted-foreground">{d.notes}</p>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </>
              )}
            </TabsContent>

            <TabsContent value="labs" className="space-y-3">
              <div className="flex justify-between items-center">
                <div className="text-sm text-muted-foreground">Lab Results</div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={()=> setOrderOpen(true)}>Order Lab Test</Button>
                  <Button size="sm" variant="outline" onClick={() => {
                    const start = new Date(); start.setHours(0,0,0,0)
                    const from = start.toISOString()
                    const to = new Date().toISOString()
                    const url = new URL('/lab-tests/print', window.location.origin)
                    url.searchParams.set('patientId', patientId)
                    url.searchParams.set('from', from)
                    url.searchParams.set('to', to)
                    window.open(url.toString(), '_blank')
                  }}>Batch Print Today</Button>
                  <Button size="sm" variant="outline" onClick={() => {
                    const start = new Date(); start.setHours(0,0,0,0)
                    const from = start.toISOString()
                    const to = new Date().toISOString()
                    const url = new URL('/api/lab-tests/pdf', window.location.origin)
                    url.searchParams.set('patientId', patientId)
                    url.searchParams.set('from', from)
                    url.searchParams.set('to', to)
                    window.open(url.toString(), '_blank')
                  }}>Download Today PDF</Button>
                </div>
              </div>
              {labResults.length === 0 ? (
                <p className="text-center text-muted-foreground">No lab results available</p>
              ) : (
                labResults
                  .slice()
                  .reverse()
                  .map((lab) => (
                    <Card key={lab.id}>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base">{lab.testName || lab.testType}</CardTitle>
                          <div className="flex items-center gap-2">
                            <Badge variant={(lab.status || '').toLowerCase() === "completed" ? "default" : "secondary"}>{lab.status}</Badge>
                            {(lab.status || '').toLowerCase() === 'completed' && lab.reviewedAt ? (
                              <Badge variant="outline" title={lab.reviewedBy ? `By ${lab.reviewedBy}` : ''}>Reviewed</Badge>
                            ) : null}
                            <Button size="sm" variant="outline" onClick={() => setSelectedLabId(lab.id)}>View</Button>
                            {(() => { const role = (user?.role || '').toLowerCase(); const isDoctor = role === 'doctor'; return isDoctor && (lab.status || '').toLowerCase() === 'completed' && !lab.reviewedAt })() && (
                              <Button size="sm" onClick={async () => {
                                try {
                                  const res = await fetch(`/api/lab-tests/${lab.id}`, { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reviewed: true }) })
                                  if (!res.ok) throw new Error('Failed')
                                  await refreshLab({ patientId })
                                } catch {}
                              }}>Mark Reviewed</Button>
                            )}
                          </div>
                        </div>
                        <CardDescription>
                          Ordered: {lab.orderedDate} {lab.completedDate && `| Completed: ${lab.completedDate}`}
                        </CardDescription>
                      </CardHeader>
                      {lab.results && (
                        <CardContent>
                          <div className="space-y-2 text-sm">
                            <span className="font-medium text-foreground">Results:</span>
                            <p className="text-muted-foreground">{lab.results}</p>
                            {lab.reviewedAt && (
                              <div className="text-xs text-muted-foreground">Reviewed {new Date(lab.reviewedAt).toLocaleString()} {lab.reviewedBy ? `by ${lab.reviewedBy}` : ''}</div>
                            )}
                          </div>
                        </CardContent>
                      )}
                    </Card>
                  ))
              )}
            </TabsContent>
          </Tabs>

          <OrderLabTest patientId={patient.id} open={orderOpen} onOpenChange={(o)=> { setOrderOpen(o); if (!o) refreshLab({ patientId: patient.id }).catch(()=>{}) }} />

          <Dialog open={!!selectedLabId} onOpenChange={(o)=> { if (!o) setSelectedLabId(null) }}>
            <DialogContent size="lg" className="max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Lab Result Details</DialogTitle>
              </DialogHeader>
              {selectedLabId && (()=>{
                const lab = labResults.find(l=>l.id===selectedLabId)
                if (!lab) return <div className="text-sm text-muted-foreground">Result not found</div>
                return (
                  <div className="space-y-4 text-sm">
                    <div className="grid md:grid-cols-2 gap-3">
                      <div><span className="text-muted-foreground">Test:</span> <span className="text-foreground">{lab.testType}</span></div>
                      <div><span className="text-muted-foreground">Status:</span> <span className="text-foreground capitalize">{lab.status}</span></div>
                      <div><span className="text-muted-foreground">Ordered By:</span> <span className="text-foreground">{lab.orderedBy}</span></div>
                      <div><span className="text-muted-foreground">Ordered Date:</span> <span className="text-foreground">{lab.orderedDate}</span></div>
                      {lab.completedDate && <div><span className="text-muted-foreground">Completed Date:</span> <span className="text-foreground">{lab.completedDate}</span></div>}
                    </div>
                    {lab.results && (
                      <div>
                        <div className="font-medium text-foreground mb-1">Results</div>
                        <div className="rounded border bg-muted/50 p-3 whitespace-pre-wrap">{lab.results}</div>
                      </div>
                    )}
                    {lab.notes && (
                      <div>
                        <div className="font-medium text-foreground mb-1">Notes</div>
                        <div className="rounded border bg-muted/50 p-3 whitespace-pre-wrap">{lab.notes}</div>
                      </div>
                    )}
                    <div className="text-right">
                      <Button onClick={()=> setSelectedLabId(null)}>Close</Button>
                    </div>
                  </div>
                )
              })()}
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    </div>
  )
}
