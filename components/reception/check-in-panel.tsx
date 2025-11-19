"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import AppointmentForm from "@/components/appointments/appointment-form"

type CompactPatient = { id: string; patient_number: string; first_name: string; last_name: string }

export function CheckInPanel() {
  const [q, setQ] = useState("")
  const [loading, setLoading] = useState(false)
  const [patients, setPatients] = useState<CompactPatient[]>([])
  const [selectedPatientId, setSelectedPatientId] = useState<string>("")
  const [department, setDepartment] = useState<string>("")
  const [creating, setCreating] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string>("")
  const [appointmentsOpen, setAppointmentsOpen] = useState(false)
  const selectedPatient = useMemo(() => patients.find((p) => p.id === selectedPatientId), [patients, selectedPatientId])

  // Debounced search
  useEffect(() => {
    const h = setTimeout(async () => {
      if (!q || q.length < 2) { setPatients([]); return }
      try {
        setLoading(true)
        const res = await fetch(`/api/patients?q=${encodeURIComponent(q)}&limit=25&compact=1`, { credentials: 'include' })
        if (res.ok) {
          const data = await res.json()
          setPatients((data.patients || []) as CompactPatient[])
        }
      } catch {}
      finally { setLoading(false) }
    }, 250)
    return () => clearTimeout(h)
  }, [q])

  const canCreate = useMemo(() => !!selectedPatientId, [selectedPatientId])

  const createCheckIn = async () => {
    if (!selectedPatientId) return
    setCreating(true)
    try {
      const res = await fetch('/api/checkins', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId: selectedPatientId, department: department || undefined })
      })
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        toast.error(e.error || 'Failed to create check-in')
        setErrorMsg(typeof e?.error === 'string' ? e.error : 'Failed to create check-in')
      } else {
        const data = await res.json().catch(() => ({} as any))
        const tokenId = data?.id
        toast.success(tokenId ? `Patient checked in. Token: ${tokenId}` : 'Patient checked in successfully', { duration: 4500 })
        try { if (tokenId) window.open(`/api/queue/token/${tokenId}`, '_blank') } catch {}
        // Reset selection
        setQ(""); setPatients([]); setSelectedPatientId(""); setDepartment("")
        setErrorMsg("")
      }
    } catch {
      toast.error('Failed to create check-in')
    } finally { setCreating(false) }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <div>
            <CardTitle>Quick Check-In</CardTitle>
            <CardDescription>Find a patient and check them in (optionally send to a department queue).</CardDescription>
          </div>
          <Button variant="secondary" onClick={() => setAppointmentsOpen(true)}>Appointments</Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="md:col-span-2 space-y-2">
            <Input placeholder="Search by name, number, or phone" value={q} onChange={(e) => setQ(e.target.value)} />
            {selectedPatientId && (
              <div className="text-xs text-muted-foreground">
                Selected: {selectedPatient ? `${selectedPatient.patient_number} - ${selectedPatient.first_name} ${selectedPatient.last_name}` : selectedPatientId}
                <button type="button" className="ml-2 text-blue-600 hover:underline" onClick={() => setSelectedPatientId("")}>Clear</button>
              </div>
            )}
            <div className="max-h-48 overflow-auto border rounded">
              {loading ? (
                <div className="p-2 text-sm text-muted-foreground">Searching...</div>
              ) : patients.length === 0 ? (
                <div className="p-2 text-sm text-muted-foreground">No results</div>
              ) : (
                patients.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedPatientId(p.id)}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-muted ${selectedPatientId === p.id ? 'bg-muted' : ''}`}
                  >
                    {p.patient_number} - {p.first_name} {p.last_name}
                  </button>
                ))
              )}
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Department (optional)</label>
            <Select value={department} onValueChange={setDepartment}>
              <SelectTrigger>
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
            {errorMsg && (
              <div className="text-xs text-red-600">{errorMsg}</div>
            )}
            <Button className="w-full" disabled={!canCreate || creating} onClick={createCheckIn}>
              {creating ? (
                <span className="inline-flex items-center"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Checking in...</span>
              ) : (
                'Check In'
              )}
            </Button>
          </div>
        </div>
      </CardContent>
      <Dialog open={appointmentsOpen} onOpenChange={setAppointmentsOpen}>
        <DialogContent size="xl" className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Appointments</DialogTitle>
          </DialogHeader>
          <AppointmentForm initialPatientId={selectedPatientId || undefined} onSubmitted={() => setAppointmentsOpen(false)} />
        </DialogContent>
      </Dialog>
    </Card>
  )
}
