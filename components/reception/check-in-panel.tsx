"use client"

import { useEffect, useMemo, useState, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import AppointmentForm from "@/components/appointments/appointment-form"
import { RECEPTION_DEPARTMENTS } from "@/lib/constants/departments"
import { formatPatientNumber } from "@/lib/patients"

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
  const [lastCheckInTokenId, setLastCheckInTokenId] = useState<string | null>(null)
  const selectedPatient = useMemo(() => patients.find((p) => p.id === selectedPatientId), [patients, selectedPatientId])

  // Debounced search with AbortController to cancel in-flight requests
  useEffect(() => {
    if (!q || q.length < 2) {
      setPatients([])
      setLoading(false)
      return
    }
    const ac = new AbortController()
    const h = setTimeout(async () => {
      try {
        setLoading(true)
        const res = await fetch(`/api/patients?q=${encodeURIComponent(q)}&limit=25&compact=1`, {
          credentials: "include",
          signal: ac.signal,
        })
        if (res.ok) {
          const data = await res.json()
          setPatients((data.patients || []) as CompactPatient[])
        } else {
          const body = await res.json().catch(() => ({}))
          toast.error((body as { error?: string }).error || "Search failed")
          setPatients([])
        }
      } catch (err) {
        if ((err as { name?: string })?.name === "AbortError") return
        toast.error("Search failed. Please try again.")
        setPatients([])
      } finally {
        setLoading(false)
      }
    }, 250)
    return () => {
      clearTimeout(h)
      ac.abort()
    }
  }, [q])

  const canCreate = useMemo(() => !!selectedPatientId, [selectedPatientId])

  const createCheckIn = async () => {
    if (!selectedPatientId) return
    setCreating(true)
    setErrorMsg("")
    try {
      const res = await fetch("/api/checkins", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientId: selectedPatientId, department: department || undefined }),
      })
      const data = await res.json().catch(() => ({} as Record<string, unknown>))
      if (!res.ok) {
        const msg = (data as { error?: string }).error || "Failed to create check-in"
        toast.error(msg)
        setErrorMsg(msg)
        return
      }
      const tokenId = data?.id as string | undefined
      setLastCheckInTokenId(tokenId ?? null)
      toast.success(tokenId ? "Patient checked in. Print token below if the popup was blocked." : "Patient checked in successfully", { duration: 5000 })
      try {
        if (tokenId) window.open(`/api/queue/token/${tokenId}`, "_blank", "noopener,noreferrer")
      } catch {
        // Popup blocked; user can use the link below
      }
      setQ("")
      setPatients([])
      setSelectedPatientId("")
      setDepartment("")
    } catch {
      toast.error("Failed to create check-in")
      setErrorMsg("Network or unexpected error.")
    } finally {
      setCreating(false)
    }
  }

  const clearTokenLink = useCallback(() => setLastCheckInTokenId(null), [])

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
        {lastCheckInTokenId && (
          <div className="rounded-md border border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/30 px-3 py-2 text-sm flex items-center justify-between gap-2">
            <span className="text-green-800 dark:text-green-200">Token ready to print</span>
            <span className="flex items-center gap-2">
              <a
                href={`/api/queue/token/${lastCheckInTokenId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline font-medium"
              >
                Open / print token
              </a>
              <Button type="button" variant="ghost" size="sm" onClick={clearTokenLink} aria-label="Dismiss token link">
                Dismiss
              </Button>
            </span>
          </div>
        )}
        <div className="grid gap-3 md:grid-cols-3">
          <div className="md:col-span-2 space-y-2">
            <Input
              aria-label="Search patients by name, number, or phone"
              placeholder="Search by name, number, or phone (min 2 characters)"
              value={q}
              onChange={(e) => {
                setQ(e.target.value)
                setErrorMsg("")
              }}
              autoComplete="off"
            />
            {selectedPatientId && (
              <div className="text-xs text-muted-foreground flex items-center gap-2">
                <span>
                  Selected: {selectedPatient ? `${formatPatientNumber(selectedPatient.patient_number)} - ${selectedPatient.first_name} ${selectedPatient.last_name}` : selectedPatientId}
                </span>
                <button
                  type="button"
                  className="text-blue-600 hover:underline"
                  onClick={() => {
                    setSelectedPatientId("")
                    setErrorMsg("")
                  }}
                  aria-label="Clear selected patient"
                >
                  Clear
                </button>
              </div>
            )}
            <div
              className="max-h-48 overflow-auto border rounded"
              role="listbox"
              aria-label="Patient search results"
              aria-busy={loading}
            >
              {loading ? (
                <div className="p-2 text-sm text-muted-foreground" role="status">Searching…</div>
              ) : patients.length === 0 ? (
                <div className="p-2 text-sm text-muted-foreground">
                  {q.length >= 2 ? "No results" : "Type at least 2 characters to search"}
                </div>
              ) : (
                patients.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    role="option"
                    aria-selected={selectedPatientId === p.id}
                    onClick={() => {
                      setSelectedPatientId(p.id)
                      setErrorMsg("")
                    }}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-muted ${selectedPatientId === p.id ? "bg-muted" : ""}`}
                  >
                    {formatPatientNumber(p.patient_number)} - {p.first_name} {p.last_name}
                  </button>
                ))
              )}
            </div>
          </div>
          <div className="space-y-2">
            <label id="checkin-department-label" className="text-sm font-medium">
              Department (optional)
            </label>
            <Select value={department} onValueChange={setDepartment} aria-labelledby="checkin-department-label">
              <SelectTrigger aria-label="Department for queue">
                <SelectValue placeholder="Select department" />
              </SelectTrigger>
              <SelectContent>
                {RECEPTION_DEPARTMENTS.map((d) => (
                  <SelectItem key={d} value={d}>{d}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errorMsg && (
              <p className="text-xs text-red-600" role="alert">
                {errorMsg}
              </p>
            )}
            <Button
              className="w-full"
              disabled={!canCreate || creating}
              onClick={createCheckIn}
              aria-busy={creating}
              aria-disabled={!canCreate || creating}
            >
              {creating ? (
                <span className="inline-flex items-center">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                  Checking in…
                </span>
              ) : (
                "Check In"
              )}
            </Button>
          </div>
        </div>
      </CardContent>
      <Dialog open={appointmentsOpen} onOpenChange={setAppointmentsOpen}>
        <DialogContent size="xl" className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Appointments</DialogTitle>
            <DialogDescription>View and manage appointments for the selected patient.</DialogDescription>
          </DialogHeader>
          <AppointmentForm initialPatientId={selectedPatientId || undefined} onSubmitted={() => setAppointmentsOpen(false)} />
        </DialogContent>
      </Dialog>
    </Card>
  )
}
