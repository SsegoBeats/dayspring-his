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
import { ArrowLeft, Activity, FileText, AlertCircle, Loader2, AlertTriangle } from "lucide-react"
import { TriageForm } from "@/components/patient/triage-form"
import { toast } from "sonner"
import { validateVitalSigns, parseBloodPressure, extractNumericValue } from "@/lib/vital-signs-validation"
import { Alert, AlertDescription } from "@/components/ui/alert"

type CareTab = "vitals" | "notes" | "history" | "triage"

interface PatientCareViewProps {
  patientId: string
  onBack: () => void
  initialTab?: CareTab
  onUpdated?: (details: { patientId: string; activeTab: CareTab; category?: string }) => void
}

export function PatientCareView({
  patientId,
  onBack,
  initialTab = "vitals",
  onUpdated,
}: PatientCareViewProps) {
  const { getPatient } = usePatients()
  const { addVitalSigns, addNursingNote, getPatientVitals, getPatientNotes, prefetchPatient, refreshPatient } =
    useNursing()
  const { user } = useAuth()
  const patient = getPatient(patientId)

  const [activeTab, setActiveTab] = useState<CareTab>(initialTab)
  const [savingVitals, setSavingVitals] = useState(false)
  const [savingNote, setSavingNote] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [vitalAlerts, setVitalAlerts] = useState<
    Array<{ type: "critical" | "warning" | "normal"; message: string; field: string }>
  >([])

  const storageKey = `nurse-care-tab:${patientId}`
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

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab)
      return
    }

    try {
      const saved = typeof window !== "undefined" ? localStorage.getItem(storageKey) : null
      if (saved && ["vitals", "notes", "history", "triage"].includes(saved)) {
        setActiveTab(saved as CareTab)
      }
    } catch {}
  }, [initialTab, storageKey])

  useEffect(() => {
    try {
      if (typeof window !== "undefined") localStorage.setItem(storageKey, activeTab)
    } catch {}
  }, [activeTab, storageKey])

  const numInt = (s: string) => {
    const m = String(s || "").match(/-?\d+/)
    return m ? parseInt(m[0], 10) : null
  }

  const numFloat = (s: string) => {
    const m = String(s || "").replace(",", ".").match(/-?\d+(?:\.\d+)?/)
    return m ? parseFloat(m[0]) : null
  }

  const fmtBP = (s: string) => {
    const raw = String(s || "")
    const m = raw.match(/(\d+)\D+(\d+)/)
    if (m) return `${m[1]}/${m[2]}`
    const nums = raw.match(/\d+/g)
    if (nums && nums.length >= 2) return `${nums[0]}/${nums[1]}`
    const n = numInt(raw)
    return n == null ? "" : String(n)
  }

  const fmtTemp = (s: string) => {
    const n = numFloat(s)
    if (n == null) return ""
    const c = n > 45 ? (n - 32) * 5 / 9 : n
    return `${c.toFixed(1)} C`
  }

  const fmtBpm = (s: string) => (numInt(s) == null ? "" : `${numInt(s)} bpm`)
  const fmtRR = (s: string) => (numInt(s) == null ? "" : `${numInt(s)}/min`)
  const fmtSpO2 = (s: string) => (numInt(s) == null ? "" : `${numInt(s)}%`)

  const fmtKg = (s: string) => {
    const raw = String(s || "").toLowerCase()
    const n = numFloat(raw)
    if (n == null) return ""
    const kg = /lb/.test(raw) ? n * 0.453592 : n
    return `${kg.toFixed(1)} kg`
  }

  const fmtCm = (s: string) => {
    const raw = String(s || "")
    if (!raw) return ""
    if (/cm/i.test(raw)) {
      const n = numFloat(raw)
      return n == null ? "" : `${n.toFixed(0)} cm`
    }
    const m = raw.match(/(\d+)\s*'\s*(\d+)?/)
    if (m) {
      const ft = parseInt(m[1], 10) || 0
      const inches = parseInt(m[2] || "0", 10) || 0
      const cm = ft * 30.48 + inches * 2.54
      return `${Math.round(cm)} cm`
    }
    const n = numFloat(raw)
    return n == null ? "" : `${n.toFixed(0)} cm`
  }

  useEffect(() => {
    setLoadingHistory(true)
    prefetchPatient(patientId)
      .catch((error) => {
        console.error("Failed to prefetch patient:", error)
        toast.error("Failed to load patient history")
      })
      .finally(() => setLoadingHistory(false))
  }, [patientId, prefetchPatient])

  const patientAge = patient
    ? (() => {
        try {
          if (patient.ageYears) return patient.ageYears
          if (patient.dateOfBirth) {
            const dob = new Date(patient.dateOfBirth)
            const now = new Date()
            return (
              now.getFullYear() -
              dob.getFullYear() -
              (now.getMonth() < dob.getMonth() ||
              (now.getMonth() === dob.getMonth() && now.getDate() < dob.getDate())
                ? 1
                : 0)
            )
          }
          return null
        } catch {
          return null
        }
      })()
    : null

  useEffect(() => {
    if (!patient) return

    const bp = parseBloodPressure(vitalsForm.bloodPressure)
    const temp = extractNumericValue(vitalsForm.temperature)
    const hr = extractNumericValue(vitalsForm.heartRate)
    const rr = extractNumericValue(vitalsForm.respiratoryRate)
    const spo2 = extractNumericValue(vitalsForm.oxygenSaturation)

    if (temp !== null || bp.systolic !== null || hr !== null || rr !== null || spo2 !== null) {
      setVitalAlerts(
        validateVitalSigns(
          {
            temperature: temp,
            systolicBP: bp.systolic,
            diastolicBP: bp.diastolic,
            heartRate: hr,
            respiratoryRate: rr,
            oxygenSaturation: spo2,
          },
          patientAge
        )
      )
      return
    }

    setVitalAlerts([])
  }, [patient, patientAge, vitalsForm])

  useEffect(() => {
    if (!patient) return

    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        if (activeTab === "vitals") void commitVitals()
        if (activeTab === "notes") void commitNote()
      }
    }

    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [activeTab, patient, user]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!patient) return
    try {
      const last = vitalHistory[vitalHistory.length - 1]
      if (!last) return
      setVitalsForm((current) => ({
        bloodPressure: current.bloodPressure || last.bloodPressure || "",
        temperature: current.temperature || last.temperature || "",
        heartRate: current.heartRate || last.heartRate || "",
        respiratoryRate: current.respiratoryRate || last.respiratoryRate || "",
        oxygenSaturation: current.oxygenSaturation || last.oxygenSaturation || "",
        weight: current.weight || last.weight || "",
        height: current.height || last.height || "",
        notes: current.notes || "",
      }))
    } catch {}
  }, [patient, patientId, vitalHistory])

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

  const notifyUpdate = (tab: CareTab, category?: string) => {
    onUpdated?.({ patientId: patient.id, activeTab: tab, category })
  }

  const commitVitals = async () => {
    if (!user || !patient) return
    if (
      !vitalsForm.bloodPressure ||
      !vitalsForm.temperature ||
      !vitalsForm.heartRate ||
      !vitalsForm.respiratoryRate ||
      !vitalsForm.oxygenSaturation
    ) {
      toast.error("Please fill in all required vital sign fields")
      return
    }

    const criticalAlerts = vitalAlerts.filter((alert) => alert.type === "critical")
    if (criticalAlerts.length > 0) {
      const summary = criticalAlerts.map((alert) => `- ${alert.message}`).join("\n")
      const confirmed = window.confirm(
        `Warning: critical vital signs detected.\n\n${summary}\n\nDo you want to proceed with recording these values?`
      )
      if (!confirmed) return
    }

    setSavingVitals(true)
    const now = new Date()

    try {
      await addVitalSigns(
        {
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
        },
        () => {
          setVitalsForm({
            bloodPressure: "",
            temperature: "",
            heartRate: "",
            respiratoryRate: "",
            oxygenSaturation: "",
            weight: "",
            height: "",
            notes: "",
          })
          setVitalAlerts([])
          toast.success("Vital signs recorded successfully")
          refreshPatient(patient.id).catch(() => {})
          notifyUpdate("vitals")
        },
        (error) => {
          toast.error(error.message || "Failed to record vital signs. Please try again.")
        }
      )
    } catch (error: any) {
      toast.error(error?.message || "Failed to record vital signs. Please try again.")
    } finally {
      setSavingVitals(false)
    }
  }

  const commitNote = async () => {
    if (!user || !patient || !noteForm.note.trim()) {
      toast.error("Please enter a nursing note")
      return
    }

    setSavingNote(true)
    const now = new Date()

    try {
      await addNursingNote(
        {
          patientId: patient.id,
          patientName: `${patient.firstName} ${patient.lastName}`,
          nurseName: user.name,
          date: now.toISOString().split("T")[0],
          time: now.toTimeString().slice(0, 5),
          category: noteForm.category,
          note: noteForm.note,
        },
        () => {
          setNoteForm({ category: "observation", note: "" })
          toast.success("Nursing note added successfully")
          refreshPatient(patient.id).catch(() => {})
          notifyUpdate("notes")
        },
        (error) => {
          toast.error(error.message || "Failed to add nursing note. Please try again.")
        }
      )
    } catch (error: any) {
      toast.error(error?.message || "Failed to add nursing note. Please try again.")
    } finally {
      setSavingNote(false)
    }
  }

  const handleSaveVitals = (e: React.FormEvent) => {
    e.preventDefault()
    void commitVitals()
  }

  const handleSaveNote = (e: React.FormEvent) => {
    e.preventDefault()
    void commitNote()
  }

  return (
    <div className="space-y-4">
      <Button variant="outline" onClick={onBack}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to List
      </Button>

      <Card className="overflow-hidden border-border/60">
        <CardHeader className="bg-gradient-to-r from-sky-50 via-white to-emerald-50 dark:from-sky-950/30 dark:via-background dark:to-emerald-950/20">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <CardTitle>
                {patient.firstName} {patient.lastName}
              </CardTitle>
              <CardDescription>Patient ID: {formatPatientNumber(patient.patientNumber)}</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">Age: {patientAge ?? "--"}</Badge>
              {patient.bloodGroup && <Badge variant="outline">Blood: {patient.bloodGroup}</Badge>}
              {patient.triageCategory && <Badge variant="secondary">Triage: {patient.triageCategory}</Badge>}
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          {(() => {
            const allergyValue = patient.allergies?.trim()
            if (!allergyValue) return null

            const hasAllergy = allergyValue.toLowerCase() !== "none"
            if (hasAllergy) {
              return (
                <div className="mb-4 rounded-lg border border-destructive/50 bg-destructive/10 p-3">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="mt-0.5 h-4 w-4 text-destructive" />
                    <div>
                      <p className="font-semibold text-destructive">Allergies</p>
                      <p className="text-sm text-foreground">{allergyValue}</p>
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

          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as CareTab)}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="vitals">Record Vitals</TabsTrigger>
              <TabsTrigger value="notes">Add Note</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
              <TabsTrigger value="triage">Triage</TabsTrigger>
            </TabsList>

            <TabsContent value="vitals" className="space-y-4">
              <form onSubmit={handleSaveVitals} className="space-y-4">
                {vitalAlerts.length > 0 && (
                  <div className="space-y-2">
                    {vitalAlerts
                      .filter((alert) => alert.type === "critical")
                      .map((alert, idx) => (
                        <Alert key={`critical-${idx}`} variant="destructive">
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription>{alert.message}</AlertDescription>
                        </Alert>
                      ))}
                    {vitalAlerts
                      .filter((alert) => alert.type === "warning")
                      .map((alert, idx) => (
                        <Alert
                          key={`warning-${idx}`}
                          variant="default"
                          className="border-amber-500 bg-amber-50 dark:bg-amber-950/20"
                        >
                          <AlertTriangle className="h-4 w-4 text-amber-600" />
                          <AlertDescription className="text-amber-800 dark:text-amber-200">
                            {alert.message}
                          </AlertDescription>
                        </Alert>
                      ))}
                  </div>
                )}

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="bloodPressure">Blood Pressure *</Label>
                    <Input
                      id="bloodPressure"
                      placeholder="120/80"
                      value={vitalsForm.bloodPressure}
                      onChange={(e) => setVitalsForm({ ...vitalsForm, bloodPressure: e.target.value })}
                      onBlur={() => setVitalsForm((current) => ({ ...current, bloodPressure: fmtBP(current.bloodPressure) }))}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="temperature">Temperature *</Label>
                    <Input
                      id="temperature"
                      placeholder="37.0 C or 98.6 F"
                      value={vitalsForm.temperature}
                      onChange={(e) => setVitalsForm({ ...vitalsForm, temperature: e.target.value })}
                      onBlur={() => setVitalsForm((current) => ({ ...current, temperature: fmtTemp(current.temperature) }))}
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
                      onBlur={() => setVitalsForm((current) => ({ ...current, heartRate: fmtBpm(current.heartRate) }))}
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
                      onBlur={() =>
                        setVitalsForm((current) => ({ ...current, respiratoryRate: fmtRR(current.respiratoryRate) }))
                      }
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
                      onBlur={() =>
                        setVitalsForm((current) => ({
                          ...current,
                          oxygenSaturation: fmtSpO2(current.oxygenSaturation),
                        }))
                      }
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
                      onBlur={() => setVitalsForm((current) => ({ ...current, weight: current.weight ? fmtKg(current.weight) : "" }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="height">Height</Label>
                    <Input
                      id="height"
                      placeholder="170 cm"
                      value={vitalsForm.height}
                      onChange={(e) => setVitalsForm({ ...vitalsForm, height: e.target.value })}
                      onBlur={() => setVitalsForm((current) => ({ ...current, height: current.height ? fmtCm(current.height) : "" }))}
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

                <Button type="submit" className="w-full" disabled={savingVitals}>
                  {savingVitals ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Recording...
                    </>
                  ) : (
                    <>
                      <Activity className="mr-2 h-4 w-4" />
                      Record Vital Signs
                    </>
                  )}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="notes" className="space-y-4">
              <form onSubmit={handleSaveNote} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="category">Category *</Label>
                  <Select value={noteForm.category} onValueChange={(value: typeof noteForm.category) => setNoteForm({ ...noteForm, category: value })}>
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

                <Button type="submit" className="w-full" disabled={savingNote || !noteForm.note.trim()}>
                  {savingNote ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    <>
                      <FileText className="mr-2 h-4 w-4" />
                      Add Nursing Note
                    </>
                  )}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="history" className="space-y-4">
              {loadingHistory ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-muted-foreground">Loading history...</span>
                </div>
              ) : (
                <>
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
                                <CardTitle className="text-base capitalize">{note.category}</CardTitle>
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
                </>
              )}
            </TabsContent>

            <TabsContent value="triage" className="space-y-4">
              <TriageForm
                patientId={patientId}
                onSaved={(category) => {
                  refreshPatient(patientId).catch(() => {})
                  notifyUpdate("triage", category)
                }}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
