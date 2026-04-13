"use client"

import { useCallback, useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import AppointmentForm from "@/components/appointments/appointment-form"
import { RECEPTION_DEPARTMENTS } from "@/lib/constants/departments"
import { formatPatientNumber } from "@/lib/patients"
import { isQzEnabled, printUrlViaQz } from "@/lib/printing"

type CompactPatient = { id: string; patient_number: string; first_name: string; last_name: string }

export function CheckInPanel() {
  const [q, setQ] = useState("")
  const [loading, setLoading] = useState(false)
  const [patients, setPatients] = useState<CompactPatient[]>([])
  const [selectedPatientId, setSelectedPatientId] = useState("")
  const [selectedPatient, setSelectedPatient] = useState<CompactPatient | null>(null)
  const [department, setDepartment] = useState("")
  const [creating, setCreating] = useState(false)
  const [errorMsg, setErrorMsg] = useState("")
  const [appointmentsOpen, setAppointmentsOpen] = useState(false)
  const [lastCheckInTokenId, setLastCheckInTokenId] = useState<string | null>(null)
  const [lastCheckInPrintMode, setLastCheckInPrintMode] = useState<"qz" | "popup" | "blocked" | null>(null)

  useEffect(() => {
    if (!q || q.length < 2) {
      setPatients([])
      setLoading(false)
      return
    }
    const ac = new AbortController()
    const h = setTimeout(() => {
      void (async () => {
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
      })()
    }, 250)
    return () => {
      clearTimeout(h)
      ac.abort()
    }
  }, [q])

  const clearSelectedPatient = useCallback(() => {
    setSelectedPatientId("")
    setSelectedPatient(null)
    setErrorMsg("")
  }, [])

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
      let tokenPrinted = false
      let printMode: "qz" | "popup" | "blocked" | null = null
      if (tokenId) {
        const tokenUrl = `/api/queue/token/${tokenId}`
        const qzTokenUrl = `${tokenUrl}?render=qz`
        if (isQzEnabled()) {
          try {
            await printUrlViaQz(qzTokenUrl, { widthMm: 80 })
            printMode = "qz"
            setLastCheckInPrintMode("qz")
            tokenPrinted = true
          } catch {
            try {
              const popup = window.open(tokenUrl, "_blank", "noopener,noreferrer")
              printMode = popup ? "popup" : "blocked"
              setLastCheckInPrintMode(printMode)
              tokenPrinted = !!popup
            } catch {
              printMode = "blocked"
              setLastCheckInPrintMode("blocked")
            }
          }
        } else {
          try {
            const popup = window.open(tokenUrl, "_blank", "noopener,noreferrer")
            printMode = popup ? "popup" : "blocked"
            setLastCheckInPrintMode(printMode)
            tokenPrinted = !!popup
          } catch {
            printMode = "blocked"
            setLastCheckInPrintMode("blocked")
          }
        }
      }
      toast.success(
        tokenId
          ? tokenPrinted || printMode === "qz"
            ? "Patient checked in and queue token sent for printing."
            : "Patient checked in. Print token below if the popup was blocked."
          : "Patient checked in successfully",
        { duration: 5000 },
      )
      setQ("")
      setPatients([])
      clearSelectedPatient()
      setDepartment("")
    } catch {
      toast.error("Failed to create check-in")
      setErrorMsg("Network or unexpected error.")
    } finally {
      setCreating(false)
    }
  }

  return (
    <Card className="border-sky-100 bg-[linear-gradient(180deg,_rgba(248,250,252,0.98),_rgba(255,255,255,1))] shadow-sm">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <div>
            <CardTitle>Quick Check-In</CardTitle>
            <CardDescription>Find a patient, create the arrival record, and place them on the right department queue.</CardDescription>
          </div>
          <Button variant="secondary" onClick={() => setAppointmentsOpen(true)}>Appointments</Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {lastCheckInTokenId && (
          <div className="flex items-center justify-between gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm dark:border-emerald-800 dark:bg-emerald-950/30">
            <span className="text-emerald-800 dark:text-emerald-200">
              Token ready to print
              <span className="ml-2 text-xs text-emerald-700 dark:text-emerald-300">
                {lastCheckInPrintMode === "qz"
                  ? "Sent to thermal printer"
                  : lastCheckInPrintMode === "blocked"
                    ? "Print window blocked"
                    : "Browser print available"}
              </span>
            </span>
            <span className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="font-medium text-blue-600 hover:text-blue-700"
                onClick={async () => {
                  const tokenUrl = `/api/queue/token/${lastCheckInTokenId}`
                  const qzTokenUrl = `${tokenUrl}?render=qz`
                  if (isQzEnabled()) {
                    try {
                      await printUrlViaQz(qzTokenUrl, { widthMm: 80 })
                      setLastCheckInPrintMode("qz")
                      return
                    } catch {}
                  }
                  try {
                    const popup = window.open(tokenUrl, "_blank", "noopener,noreferrer")
                    setLastCheckInPrintMode(popup ? "popup" : "blocked")
                  } catch {
                    setLastCheckInPrintMode("blocked")
                  }
                }}
              >
                Open / print token
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => { setLastCheckInTokenId(null); setLastCheckInPrintMode(null) }}
                aria-label="Dismiss token link"
              >
                Dismiss
              </Button>
            </span>
          </div>
        )}
        <div className="grid gap-3 md:grid-cols-3">
          <div className="space-y-2 md:col-span-2">
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
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>
                  Selected: {selectedPatient ? `${formatPatientNumber(selectedPatient.patient_number)} - ${selectedPatient.first_name} ${selectedPatient.last_name}` : selectedPatientId}
                </span>
                <button
                  type="button"
                  className="text-blue-600 hover:underline"
                  onClick={clearSelectedPatient}
                  aria-label="Clear selected patient"
                >
                  Clear
                </button>
              </div>
            )}
            <div
              className="max-h-48 overflow-auto rounded border"
              role="listbox"
              aria-label="Patient search results"
              aria-busy={loading}
            >
              {loading ? (
                <div className="p-2 text-sm text-muted-foreground" role="status">Searching...</div>
              ) : patients.length === 0 ? (
                <div className="p-2 text-sm text-muted-foreground">
                  {q.length >= 2 ? "No results" : "Type at least 2 characters to search"}
                </div>
              ) : (
                patients.map((patient) => (
                  <button
                    key={patient.id}
                    type="button"
                    role="option"
                    aria-selected={selectedPatientId === patient.id}
                    onClick={() => {
                      setSelectedPatientId(patient.id)
                      setSelectedPatient(patient)
                      setErrorMsg("")
                    }}
                    className={`w-full px-3 py-2 text-left text-sm hover:bg-muted ${selectedPatientId === patient.id ? "bg-muted" : ""}`}
                  >
                    {formatPatientNumber(patient.patient_number)} - {patient.first_name} {patient.last_name}
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
                {RECEPTION_DEPARTMENTS.map((dept) => (
                  <SelectItem key={dept} value={dept}>{dept}</SelectItem>
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
              disabled={!selectedPatientId || creating}
              onClick={createCheckIn}
              aria-busy={creating}
              aria-disabled={!selectedPatientId || creating}
            >
              {creating ? (
                <span className="inline-flex items-center">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                  Checking in...
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
