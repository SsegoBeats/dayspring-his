"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { usePatients, PatientProvider } from "@/lib/patient-context"
import { useAuth } from "@/lib/auth-context"
import { toast } from "sonner"
import { DashboardLayout } from "@/components/dashboard-layout"

type Doctor = { id: string; name: string; email: string; role: string }
type Slot = { time: string; capacity: number; available: number }

export default function BookAppointmentPage() {
  return (
    <DashboardLayout>
      <PatientProvider>
        <BookAppointmentInner />
      </PatientProvider>
    </DashboardLayout>
  )
}

function BookAppointmentInner() {
  const router = useRouter()
  const { user, isLoading } = useAuth()
  const { patients } = usePatients()
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [doctorId, setDoctorId] = useState("")
  const [patientId, setPatientId] = useState("")
  const [date, setDate] = useState("")
  const [department, setDepartment] = useState("General")
  const [slots, setSlots] = useState<Slot[]>([])
  const [loading, setLoading] = useState(false)
  const [booking, setBooking] = useState(false)

  useEffect(() => {
    if (isLoading) return
    if (!user) {
      router.push("/")
      return
    }
  }, [user, isLoading, router])

  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch("/api/users/clinicians")
        if (res.ok) {
          const data = await res.json()
          setDoctors(data.clinicians || data.doctors || [])
        }
      } catch {}
    })()
  }, [])

  const loadSlots = async () => {
    if (!doctorId || !date) return
    setLoading(true)
    try {
      const res = await fetch(`/api/appointments/slots?doctorId=${doctorId}&date=${date}`)
      const data = await res.json()
      setSlots(data.slots || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setSlots([])
    if (doctorId && date) void loadSlots()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doctorId, date])

  if (isLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  const bookSlot = async (time: string) => {
    if (!patientId || !doctorId || !date) return
    setBooking(true)
    try {
      const patient = patients.find((p) => p.id === patientId)
      const doctor = doctors.find((d) => d.id === doctorId)
      const body = {
        patientId,
        doctorId,
        date,
        time,
        department: "General",
        reason: null,
        notes: null,
      }
      const res = await fetch("/api/appointments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      if (res.ok) {
        toast.success(`Booked ${patient ? patient.firstName + " " + patient.lastName : patientId} with ${doctor?.name || "Clinician"} on ${date} at ${time}`)
        await loadSlots()
      } else {
        const err = await res.json().catch(() => ({}))
        toast.error(`Booking failed: ${err.error || res.status}`)
      }
    } finally {
      setBooking(false)
    }
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Book Appointment</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Patient</Label>
              <Select value={patientId} onValueChange={setPatientId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select patient" />
                </SelectTrigger>
                <SelectContent>
                  {patients.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.firstName} {p.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Clinician</Label>
              <Select value={doctorId} onValueChange={setDoctorId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select clinician" />
                </SelectTrigger>
                <SelectContent>
                  {doctors.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Date</Label>
              <Input id="book-date" name="appointmentDate" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Department</Label>
              <Select value={department} onValueChange={setDepartment}>
                <SelectTrigger>
                  <SelectValue placeholder="Department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="General">General</SelectItem>
                  <SelectItem value="Dental">Dental</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Available Slots</Label>
              <Button variant="outline" onClick={loadSlots} disabled={!doctorId || !date || loading}>
                {loading ? "Loading..." : "Refresh"}
              </Button>
            </div>
            {(!doctorId || !date) && <p className="text-sm text-muted-foreground">Select clinician and date to view slots</p>}
            {doctorId && date && (
              <div className="grid gap-2 md:grid-cols-4">
                {slots.length === 0 && !loading && <p className="text-sm text-muted-foreground">No slots available</p>}
                {slots.map((s) => (
                  <Button key={s.time} variant="outline" onClick={() => bookSlot(s.time)} disabled={booking}>
                    {s.time} ({s.available}/{s.capacity})
                  </Button>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}


