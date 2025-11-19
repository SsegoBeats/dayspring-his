"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { usePatients } from "@/lib/patient-context"
import { useNursing } from "@/lib/nursing-context"
import { useAuth } from "@/lib/auth-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { formatPatientNumber } from "@/lib/patients"
import { ArrowLeft, Activity, FileText, AlertCircle } from "lucide-react"
import { TriageForm } from "@/components/patient/triage-form"

interface PatientCareViewProps {
  patientId: string
  onBack: () => void
  initialTab?: 'vitals' | 'notes' | 'history' | 'triage'
}

export function PatientCareView({ patientId, onBack, initialTab = 'vitals' }: PatientCareViewProps) {
  const { getPatient } = usePatients()
  const { addVitalSigns, addNursingNote, getPatientVitals, getPatientNotes, prefetchPatient } = useNursing()
  const { user } = useAuth()
  const patient = getPatient(patientId)
  const [activeTab, setActiveTab] = useState<'vitals'|'notes'|'history'|'triage'>(initialTab)

  // Remember last active tab per patient
  const storageKey = `nurse-care-tab:${patientId}`
  useEffect(() => {
    try {
      const saved = typeof window !== 'undefined' ? localStorage.getItem(storageKey) : null
      if (saved && (['vitals','notes','history','triage'] as string[]).includes(saved)) {
        setActiveTab(saved as any)
      } else if (initialTab) {
        setActiveTab(initialTab)
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId])
  useEffect(() => {
    try { if (typeof window !== 'undefined') localStorage.setItem(storageKey, activeTab) } catch {}
  }, [activeTab])
  const vitalHistory = getPatientVitals(patientId)
  const noteHistory = getPatientNotes(patientId)

  const [vitalsForm, setVitalsForm] = useState({
    bloodPressure: "",
    temperature: "",
    heartRate: "",
    respiratoryRate: "",
    oxygenSaturation: "",
    weight: "",
    height: "",
    notes: "",
  })

  const [noteForm, setNoteForm] = useState({
    category: "observation" as "assessment" | "medication" | "procedure" | "observation" | "other",
    note: "",
  })

  // Helpers to normalize and format values with metric units
  const numInt = (s: string) => {
    const m = String(s || '').match(/-?\d+/)
    return m ? parseInt(m[0], 10) : null
  }
  const numFloat = (s: string) => {
    const m = String(s || '').replace(',', '.').match(/-?\d+(?:\.\d+)?/)
    return m ? parseFloat(m[0]) : null
  }
  const fmtBP = (s: string) => {
    const raw = String(s || '')
    const m = raw.match(/(\d+)\D+(\d+)/)
    if (m) return `${m[1]}/${m[2]}`
    const nums = raw.match(/\d+/g)
    if (nums && nums.length >= 2) return `${nums[0]}/${nums[1]}`
    const n = numInt(raw)
    return n == null ? '' : String(n)
  }
  const fmtTemp = (s: string) => {
    const n = numFloat(s)
    if (n == null) return ''
    const c = n > 45 ? (n - 32) * 5/9 : n
    return `${c.toFixed(1)} °C`
  }
  const fmtBpm = (s: string) => (numInt(s) == null ? '' : `${numInt(s)} bpm`)
  const fmtRR = (s: string) => (numInt(s) == null ? '' : `${numInt(s)}/min`)
  const fmtSpO2 = (s: string) => (numInt(s) == null ? '' : `${numInt(s)}%`)
  const fmtKg = (s: string) => {
    const raw = String(s || '').toLowerCase()
    const n = numFloat(raw)
    if (n == null) return ''
    const kg = /lb/.test(raw) ? n * 0.453592 : n
    return `${kg.toFixed(1)} kg`
  }
  const fmtCm = (s: string) => {
    const raw = String(s || '')
    if (!raw) return ''
    if (/cm/i.test(raw)) {
      const n = numFloat(raw)
      return n == null ? '' : `${n.toFixed(0)} cm`
    }
    const m = raw.match(/(\d+)\s*'\s*(\d+)?/)
    if (m) {
      const ft = parseInt(m[1], 10) || 0
      const inches = parseInt(m[2] || '0', 10) || 0
      const cm = ft * 30.48 + inches * 2.54
      return `${Math.round(cm)} cm`
    }
    const n = numFloat(raw)
    return n == null ? '' : `${n.toFixed(0)} cm`
  }

  // Prefetch patient history when opening the dialog
  useEffect(() => {
    prefetchPatient(patientId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const commitVitals = () => {
    if (!user || !patient) return
    const now = new Date()
    addVitalSigns({
      patientId: patient.id,
      patientName: `${patient.firstName} ${patient.lastName}`,
      nurseName: user.name,
      date: now.toISOString().split("T")[0],
      time: now.toTimeString().slice(0, 5),
      bloodPressure: vitalsForm.bloodPressure,
      temperature: vitalsForm.temperature,
      heartRate: vitalsForm.heartRate,
      respiratoryRate: vitalsForm.respiratoryRate,
      oxygenSaturation: vitalsForm.oxygenSaturation,
      weight: vitalsForm.weight,
      height: vitalsForm.height,
      notes: vitalsForm.notes,
    })
    setVitalsForm({ bloodPressure: "", temperature: "", heartRate: "", respiratoryRate: "", oxygenSaturation: "", weight: "", height: "", notes: "" })
    alert("Vital signs recorded successfully!")
  }
  const handleSaveVitals = (e: React.FormEvent) => { e.preventDefault(); commitVitals() }

  const commitNote = () => {
    if (!user || !patient || !noteForm.note) return
    const now = new Date()
    addNursingNote({
      patientId: patient.id,
      patientName: `${patient.firstName} ${patient.lastName}`,
      nurseName: user.name,
      date: now.toISOString().split("T")[0],
      time: now.toTimeString().slice(0, 5),
      category: noteForm.category,
      note: noteForm.note,
    })
    setNoteForm({ category: "observation", note: "" })
    alert("Nursing note added successfully!")
  }
  const handleSaveNote = (e: React.FormEvent) => { e.preventDefault(); commitNote() }

  // Keyboard shortcuts: Ctrl+Enter saves current tab
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        if (activeTab === 'vitals') commitVitals()
        if (activeTab === 'notes') commitNote()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [activeTab, vitalsForm, noteForm, patient, user])

  // Pre-fill vitals with latest record for this patient (as a starting template)
  useEffect(() => {
    try {
      const last = (vitalHistory || [])[vitalHistory.length - 1]
      if (last) {
        setVitalsForm((f) => ({
          bloodPressure: f.bloodPressure || last.bloodPressure || "",
          temperature: f.temperature || last.temperature || "",
          heartRate: f.heartRate || last.heartRate || "",
          respiratoryRate: f.respiratoryRate || last.respiratoryRate || "",
          oxygenSaturation: f.oxygenSaturation || last.oxygenSaturation || "",
          weight: f.weight || last.weight || "",
          height: f.height || last.height || "",
          notes: f.notes || "",
        }))
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId])

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
                Patient ID: {patient.patientNumber ? formatPatientNumber(patient.patientNumber) : patient.id}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Badge variant="outline">
                Age: {new Date().getFullYear() - new Date(patient.dateOfBirth).getFullYear()}
              </Badge>
              {patient.bloodGroup && <Badge variant="outline">Blood: {patient.bloodGroup}</Badge>}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {patient.allergies && (
            <div className="mb-4 rounded-lg border border-destructive/50 bg-destructive/10 p-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 h-4 w-4 text-destructive" />
                <div>
                  <p className="font-semibold text-destructive">Allergies</p>
                  <p className="text-sm text-foreground">{patient.allergies}</p>
                </div>
              </div>
            </div>
          )}

          <Tabs value={activeTab} onValueChange={(v:any)=> setActiveTab(v)}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="vitals">Record Vitals</TabsTrigger>
              <TabsTrigger value="notes">Add Note</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
              <TabsTrigger value="triage">Triage</TabsTrigger>
            </TabsList>

            <TabsContent value="vitals" className="space-y-4">
              <form onSubmit={handleSaveVitals} className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="bloodPressure">Blood Pressure *</Label>
                    <Input
                      id="bloodPressure"
                      placeholder="120/80"
                      value={vitalsForm.bloodPressure}
                      onChange={(e) => setVitalsForm({ ...vitalsForm, bloodPressure: e.target.value })}
                      onBlur={() => setVitalsForm((v) => ({ ...v, bloodPressure: fmtBP(v.bloodPressure) }))}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="temperature">Temperature *</Label>
                    <Input
                      id="temperature"
                      placeholder="98.6°F"
                      value={vitalsForm.temperature}
                      onChange={(e) => setVitalsForm({ ...vitalsForm, temperature: e.target.value })}
                      onBlur={() => setVitalsForm((v) => ({ ...v, temperature: fmtTemp(v.temperature) }))}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="heartRate">Heart Rate *</Label>
                    <Input
                      id="heartRate"
                      placeholder="72 bpm"
                      value={vitalsForm.heartRate}
                      onChange={(e) => setVitalsForm({ ...vitalsForm, heartRate: e.target.value })}
                      onBlur={() => setVitalsForm((v) => ({ ...v, heartRate: fmtBpm(v.heartRate) }))}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="respiratoryRate">Respiratory Rate *</Label>
                    <Input
                      id="respiratoryRate"
                      placeholder="16/min"
                      value={vitalsForm.respiratoryRate}
                      onChange={(e) => setVitalsForm({ ...vitalsForm, respiratoryRate: e.target.value })}
                      onBlur={() => setVitalsForm((v) => ({ ...v, respiratoryRate: fmtRR(v.respiratoryRate) }))}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="oxygenSaturation">Oxygen Saturation *</Label>
                    <Input
                      id="oxygenSaturation"
                      placeholder="98%"
                      value={vitalsForm.oxygenSaturation}
                      onChange={(e) => setVitalsForm({ ...vitalsForm, oxygenSaturation: e.target.value })}
                      onBlur={() => setVitalsForm((v) => ({ ...v, oxygenSaturation: fmtSpO2(v.oxygenSaturation) }))}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="weight">Weight</Label>
                    <Input
                      id="weight"
                      placeholder="70 kg"
                      value={vitalsForm.weight}
                      onChange={(e) => setVitalsForm({ ...vitalsForm, weight: e.target.value })}
                      onBlur={() => setVitalsForm((v) => ({ ...v, weight: v.weight ? fmtKg(v.weight) : '' }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="height">Height</Label>
                    <Input
                      id="height"
                      placeholder={"170 cm"}
                      value={vitalsForm.height}
                      onChange={(e) => setVitalsForm({ ...vitalsForm, height: e.target.value })}
                      onBlur={() => setVitalsForm((v) => ({ ...v, height: v.height ? fmtCm(v.height) : '' }))}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="vitalsNotes">Notes</Label>
                  <Textarea
                    id="vitalsNotes"
                    placeholder="Any observations or notes..."
                    value={vitalsForm.notes}
                    onChange={(e) => setVitalsForm({ ...vitalsForm, notes: e.target.value })}
                    rows={3}
                  />
                </div>

                <Button type="submit" className="w-full">
                  <Activity className="mr-2 h-4 w-4" />
                  Record Vital Signs
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="notes" className="space-y-4">
              <form onSubmit={handleSaveNote} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="category">Category *</Label>
                  <Select
                    value={noteForm.category}
                    onValueChange={(value: any) => setNoteForm({ ...noteForm, category: value })}
                  >
                    <SelectTrigger id="category">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="assessment">Assessment</SelectItem>
                      <SelectItem value="medication">Medication</SelectItem>
                      <SelectItem value="procedure">Procedure</SelectItem>
                      <SelectItem value="observation">Observation</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="note">Nursing Note *</Label>
                  <Textarea
                    id="note"
                    placeholder="Enter detailed nursing note..."
                    value={noteForm.note}
                    onChange={(e) => setNoteForm({ ...noteForm, note: e.target.value })}
                    rows={6}
                    required
                  />
                </div>

                <Button type="submit" className="w-full">
                  <FileText className="mr-2 h-4 w-4" />
                  Add Nursing Note
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="history" className="space-y-4">
              <div className="space-y-3">
                <h3 className="font-semibold text-foreground">Vital Signs History</h3>
                {vitalHistory.length === 0 ? (
                  <p className="text-center text-muted-foreground">No vital signs recorded</p>
                ) : (
                  vitalHistory
                    .slice()
                    .reverse()
                    .map((vitals) => (
                      <Card key={vitals.id}>
                        <CardHeader>
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-base">Vital Signs</CardTitle>
                            <Badge variant="outline">
                              {vitals.date} {vitals.time}
                            </Badge>
                          </div>
                          <CardDescription>Recorded by {vitals.nurseName}</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-2 text-sm">
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <span className="text-muted-foreground">BP:</span>{" "}
                              <span className="text-foreground">{fmtBP(vitals.bloodPressure)}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Temp:</span>{" "}
                              <span className="text-foreground">{fmtTemp(vitals.temperature)}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">HR:</span>{" "}
                              <span className="text-foreground">{fmtBpm(vitals.heartRate)}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">RR:</span>{" "}
                              <span className="text-foreground">{fmtRR(vitals.respiratoryRate)}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">SpO2:</span>{" "}
                              <span className="text-foreground">{fmtSpO2(vitals.oxygenSaturation)}</span>
                            </div>
                            {vitals.weight && (
                              <div>
                                <span className="text-muted-foreground">Weight:</span>{" "}
                                <span className="text-foreground">{fmtKg(vitals.weight)}</span>
                              </div>
                            )}
                            {vitals.height && (
                              <div>
                                <span className="text-muted-foreground">Height:</span>{" "}
                                <span className="text-foreground">{fmtCm(vitals.height)}</span>
                              </div>
                            )}
                          </div>
                          {vitals.notes && (
                            <div className="mt-2">
                              <span className="text-muted-foreground">Notes:</span>
                              <p className="text-foreground">{vitals.notes}</p>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))
                )}
              </div>

              <div className="space-y-3">
                <h3 className="font-semibold text-foreground">Nursing Notes</h3>
                {noteHistory.length === 0 ? (
                  <p className="text-center text-muted-foreground">No nursing notes</p>
                ) : (
                  noteHistory
                    .slice()
                    .reverse()
                    .map((note) => (
                      <Card key={note.id}>
                        <CardHeader>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <CardTitle className="text-base capitalize">{note.category}</CardTitle>
                            </div>
                            <Badge variant="outline">
                              {note.date} {note.time}
                            </Badge>
                          </div>
                          <CardDescription>By {note.nurseName}</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-foreground">{note.note}</p>
                        </CardContent>
                      </Card>
                    ))
                )}
              </div>
            </TabsContent>
            <TabsContent value="triage" className="space-y-4">
              <TriageForm patientId={patientId} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
