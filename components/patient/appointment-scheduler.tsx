"use client"

import type React from "react"
import { useState } from "react"
import { usePatients } from "@/lib/patient-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Search, Loader2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

export function AppointmentScheduler() {
  const { patients, addAppointment, appointments } = usePatients()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    patientId: "",
    doctorName: "",
    date: "",
    time: "",
    type: "",
    notes: "",
  })
  const [q, setQ] = useState("")
  const [options, setOptions] = useState<{ id: string; patient_number: string; first_name: string; last_name: string }[]>([])
  const [searching, setSearching] = useState(false)

  // Patient typeahead to avoid huge dropdowns
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
      if (patient) {
        // Try server-side booking first (secured endpoint). Falls back to local state on error.
        try {
          const res = await fetch("/api/appointments", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              patientId: patient.id,
              doctorId: null,
              date: formData.date,
              time: formData.time,
              department: formData.type || "General",
              reason: formData.notes || null,
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
        // Reset form
        setFormData({
          patientId: "",
          doctorName: "",
          date: "",
          time: "",
          type: "",
          notes: "",
        })
      }
    } catch (error) {
      console.error("Error scheduling appointment:", error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
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
                <Label htmlFor="doctorName">Clinician Name *</Label>
                <Input
                  id="doctorName"
                  value={formData.doctorName}
                  onChange={(e) => setFormData({ ...formData, doctorName: e.target.value })}
                  placeholder="Dr. Smith"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="type">Appointment Type *</Label>
                <Select value={formData.type} onValueChange={(value) => setFormData({ ...formData, type: value })}>
                  <SelectTrigger id="type">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="General Checkup">General Checkup</SelectItem>
                    <SelectItem value="Follow-up">Follow-up</SelectItem>
                    <SelectItem value="Consultation">Consultation</SelectItem>
                    <SelectItem value="Emergency">Emergency</SelectItem>
                    <SelectItem value="Vaccination">Vaccination</SelectItem>
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
                <Input
                  id="time"
                  type="time"
                  value={formData.time}
                  onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Additional notes or instructions"
              />
            </div>

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? (
                <span className="inline-flex items-center"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Scheduling...</span>
              ) : (
                "Schedule Appointment"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>All Appointments</CardTitle>
              <CardDescription>View all scheduled appointments</CardDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={async () => {
                try {
                  const res = await fetch('/api/appointments/send-reminders', { method: 'POST' })
                  if (res.ok) {
                    const data = await res.json();
                    console.log('Reminders sent:', data)
                  }
                } catch (e) { console.error(e) }
              }}
            >
              Send Reminders (24h)
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {appointments.length === 0 ? (
            <p className="text-center text-muted-foreground">No appointments scheduled</p>
          ) : (
            <div className="space-y-2">
              {appointments.map((apt) => (
                <div key={apt.id} className="rounded-lg border border-border p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-foreground">{apt.patientName}</p>
                      <p className="text-sm text-muted-foreground">
                        {apt.date} at {apt.time} - {apt.type}
                      </p>
                      <p className="text-sm text-muted-foreground">Clinician: {apt.doctorName}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-foreground">{apt.status}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}


