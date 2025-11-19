"use client"

import type React from "react"
import { useEffect, useMemo, useState } from "react"
import { usePatients } from "@/lib/patient-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Search, Loader2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

type AppointmentFormProps = {
  onSubmitted?: () => void
  initialPatientId?: string
  initialDoctorId?: string
  initialDate?: string
  initialTime?: string
  initialDepartment?: string
}

// Compact form-only version of the appointment scheduler for dialog usage
export function AppointmentForm({ onSubmitted, initialPatientId, initialDoctorId, initialDate, initialTime, initialDepartment }: AppointmentFormProps) {
  const { patients, refreshAppointments } = usePatients()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    patientId: initialPatientId || "",
    doctorId: initialDoctorId || "",
    department: initialDepartment || "",
    date: initialDate || "",
    time: initialTime || "",
    reason: "",
    notes: "",
  })
  const [q, setQ] = useState("")
  const [options, setOptions] = useState<{ id: string; patient_number: string; first_name: string; last_name: string }[]>([])
  const [searching, setSearching] = useState(false)
  const [doctors, setDoctors] = useState<{ id: string; name: string }[]>([])
  const [slots, setSlots] = useState<{ time: string; capacity: number; available: number }[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)

  // Load doctors list for assignment (optional)
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/users/clinicians', { credentials: 'include' })
        if (res.ok) {
          const data = await res.json()
          const list = Array.isArray(data?.doctors) ? data.doctors : (Array.isArray(data?.users) ? data.users : [])
          setDoctors(list.map((u: any) => ({ id: u.id, name: u.name || `${u.first_name || ''} ${u.last_name || ''}`.trim() })))
        }
      } catch {}
    })()
  }, [])

  const canSubmit = useMemo(() => {
    return !!(formData.patientId && formData.department && formData.date && formData.time)
  }, [formData.patientId, formData.department, formData.date, formData.time])

  // Load available slots when doctor and date are set
  useEffect(() => {
    (async () => {
      if (!formData.doctorId || !formData.date) { setSlots([]); return }
      try {
        setLoadingSlots(true)
        const url = new URL('/api/appointments/slots', window.location.origin)
        url.searchParams.set('doctorId', formData.doctorId)
        url.searchParams.set('date', formData.date)
        const res = await fetch(url.toString(), { credentials: 'include' })
        if (res.ok) {
          const data = await res.json(); setSlots(data.slots || [])
        } else { setSlots([]) }
      } catch { setSlots([]) }
      finally { setLoadingSlots(false) }
    })()
  }, [formData.doctorId, formData.date])

  async function searchPatients(query: string) {
    if (!query || query.length < 2) { setOptions([]); return }
    try {
      setSearching(true)
      const res = await fetch(`/api/patients?q=${encodeURIComponent(query)}&compact=1&limit=25`, { credentials: 'include' })
      if (res.ok) setOptions((await res.json()).patients || [])
    } finally { setSearching(false) }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const patient = patients.find((p) => p.id === formData.patientId)
      if (!patient) return
      try {
        const res = await fetch("/api/appointments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            patientId: patient.id,
            doctorId: formData.doctorId || null,
            date: formData.date,
            time: formData.time,
            department: formData.department || "General",
            reason: formData.reason || null,
            notes: formData.notes || null,
          }),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err.error || "Failed to schedule appointment")
        }
      } catch (e) {
        console.error(e)
        return
      }

      setFormData({ patientId: "", doctorId: "", department: "", date: "", time: "", reason: "", notes: "" })
      try { await refreshAppointments?.() } catch {}
      if (onSubmitted) onSubmitted()
    } catch (error) {
      console.error("Error scheduling appointment:", error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Schedule Appointment</CardTitle>
        <CardDescription>Book a new appointment for a patient</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="patientId">Patient *</Label>
            <div className="space-y-2">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input placeholder="Search patient" value={q} onChange={(e)=>{ setQ(e.target.value); searchPatients(e.target.value) }} />
                  <Search className="absolute right-2 top-2.5 h-4 w-4 text-muted-foreground" />
                </div>
                <Input className="w-64" placeholder="Selected ID" value={formData.patientId} readOnly />
              </div>
              {formData.patientId && (
                <div className="text-xs text-muted-foreground">
                  Selected: {(() => {
                    const o = options.find((p) => p.id === formData.patientId)
                    if (o) return `${o.patient_number} - ${o.first_name} ${o.last_name}`
                    const p = patients.find((pp) => pp.id === formData.patientId)
                    return p ? `${p.firstName} ${p.lastName}` : formData.patientId
                  })()}
                </div>
              )}
              <div className="max-h-40 overflow-auto border rounded">
                {searching ? (
                  <div className="p-2 text-sm text-muted-foreground">Searching...</div>
                ) : options.length === 0 ? (
                  <div className="p-2 text-sm text-muted-foreground">No results</div>
                ) : options.map((p) => (
                  <button key={p.id} type="button" onClick={() => setFormData({ ...formData, patientId: p.id })} className={`w-full text-left px-3 py-2 text-sm hover:bg-muted ${formData.patientId===p.id?'bg-muted':''}`}>
                    {p.patient_number} - {p.first_name} {p.last_name}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="department">Department *</Label>
              <Select value={formData.department} onValueChange={(value) => setFormData({ ...formData, department: value })}>
                <SelectTrigger id="department">
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="General">General</SelectItem>
                  <SelectItem value="Emergency">Emergency</SelectItem>
                  <SelectItem value="Pediatrics">Pediatrics</SelectItem>
                  <SelectItem value="Surgery">Surgery</SelectItem>
                  <SelectItem value="Radiology">Radiology</SelectItem>
                  <SelectItem value="Laboratory">Laboratory</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="doctor">Clinician (optional)</Label>
              <Select value={formData.doctorId} onValueChange={(value) => setFormData({ ...formData, doctorId: value })}>
                <SelectTrigger id="doctor">
                  <SelectValue placeholder="Assign a doctor" />
                </SelectTrigger>
                <SelectContent>
                  {doctors.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.name || d.id}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="date">Date *</Label>
              <Input
                id="date"
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="time">Time *</Label>
              {formData.doctorId && formData.date ? (
                slots.length > 0 ? (
                  <Select value={formData.time} onValueChange={(value) => setFormData({ ...formData, time: value })}>
                    <SelectTrigger id="time">
                      <SelectValue placeholder={loadingSlots ? 'Loading slots...' : 'Select available time'} />
                    </SelectTrigger>
                    <SelectContent>
                      {slots.map((s) => (
                        <SelectItem key={s.time} value={s.time}>{s.time} (avail {s.available}/{s.capacity})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input id="time" type="time" value={formData.time} onChange={(e) => setFormData({ ...formData, time: e.target.value })} required />
                )
              ) : (
                <Input id="time" type="time" value={formData.time} onChange={(e) => setFormData({ ...formData, time: e.target.value })} required />
              )}
              {formData.doctorId && formData.date && slots.length === 0 && !loadingSlots && (
                <div className="text-xs text-muted-foreground">No predefined slots available; you can still enter a time.</div>
              )}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="reason">Reason</Label>
              <Input id="reason" value={formData.reason} onChange={(e) => setFormData({ ...formData, reason: e.target.value })} placeholder="e.g., Consultation, Follow-up" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} placeholder="Additional notes or instructions" />
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={isSubmitting || !canSubmit}>
            {isSubmitting ? (
              <span className="inline-flex items-center"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Scheduling...</span>
            ) : (
              "Schedule Appointment"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

export default AppointmentForm

