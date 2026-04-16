"use client"

import { useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Loader2, CheckCircle2, Clock, AlertCircle, Pill } from "lucide-react"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { toast } from "sonner"
import { parseDosesPerDay, calculateScheduledTimes, getDoseStatus, type DoseStatus } from "@/lib/mar-utils"

interface Prescription {
  id: string
  medication_name: string
  dosage: string
  frequency: string
  duration: string
  created_at: string
}

interface Administration {
  id: string
  prescription_id: string
  administered_at: string
  dose_given: string
  route: string | null
  nurse_name: string | null
  notes: string | null
}

interface MARRow {
  prescriptionId: string
  medication: string
  dosage: string
  frequency: string
  scheduledAt: Date | null
  status: DoseStatus
  administration?: Administration
}

interface MARViewProps {
  patientId: string
}

const STATUS_CONFIG: Record<string, { label: string; badge: string; icon: React.ElementType }> = {
  given:          { label: "Given",    badge: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: CheckCircle2 },
  due:            { label: "Due",      badge: "bg-blue-100 text-blue-700 border-blue-200",          icon: Clock },
  delayed:        { label: "Delayed",  badge: "bg-amber-100 text-amber-700 border-amber-200",       icon: AlertCircle },
  missed:         { label: "Missed",   badge: "bg-red-100 text-red-700 border-red-200",             icon: AlertCircle },
  "stat-pending": { label: "Due Now",  badge: "bg-violet-100 text-violet-700 border-violet-200",    icon: AlertCircle },
  "stat-given":   { label: "Given",    badge: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: CheckCircle2 },
}

export function MARView({ patientId }: MARViewProps) {
  const [loading, setLoading] = useState(true)
  const [marRows, setMarRows] = useState<MARRow[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedRow, setSelectedRow] = useState<MARRow | null>(null)
  const [doseGiven, setDoseGiven] = useState("")
  const [route, setRoute] = useState("")
  const [notes, setNotes] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const loadData = async () => {
    try {
      setLoading(true)
      const [rxRes, adminRes] = await Promise.all([
        fetch(`/api/medical/prescriptions?patientId=${patientId}`, { credentials: "include" }),
        fetch(`/api/prescription-administrations?patientId=${patientId}`, { credentials: "include" }),
      ])
      if (!rxRes.ok) throw new Error("Failed to load prescriptions")
      const rxData = await rxRes.json()
      const adminData = adminRes.ok ? await adminRes.json() : { administrations: [] }

      const rxList: Prescription[] = rxData.prescriptions ?? []
      const adminList: Administration[] = adminData.administrations ?? []
      buildMARRows(rxList, adminList)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load MAR data"
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  const buildMARRows = (rxList: Prescription[], adminList: Administration[]) => {
    const now = new Date()
    const rows: MARRow[] = []

    for (const rx of rxList) {
      const rxAdmins = adminList.filter((a) => a.prescription_id === rx.id)
      const dosesPerDay = parseDosesPerDay(rx.frequency)

      if (dosesPerDay === 0) {
        const given = rxAdmins[0]
        rows.push({
          prescriptionId: rx.id,
          medication: rx.medication_name,
          dosage: rx.dosage,
          frequency: rx.frequency,
          scheduledAt: null,
          status: given ? "stat-given" : "stat-pending",
          administration: given,
        })
        continue
      }

      const scheduledTimes = calculateScheduledTimes(rx.frequency, new Date(rx.created_at), 1)
      for (const t of scheduledTimes) {
        if (t > now && t.getTime() - now.getTime() > 60 * 60 * 1000) continue
        const status = getDoseStatus(t, rxAdmins, now)
        const matchAdmin = rxAdmins.find((a) =>
          Math.abs(new Date(a.administered_at).getTime() - t.getTime()) < 2 * 60 * 60 * 1000
        )
        rows.push({
          prescriptionId: rx.id,
          medication: rx.medication_name,
          dosage: rx.dosage,
          frequency: rx.frequency,
          scheduledAt: t,
          status,
          administration: matchAdmin,
        })
      }
    }
    setMarRows(rows)
  }

  useEffect(() => {
    if (patientId) void loadData()
  }, [patientId])

  const openGiveDialog = (row: MARRow) => {
    setSelectedRow(row)
    setDoseGiven(row.dosage)
    setRoute("")
    setNotes("")
    setDialogOpen(true)
  }

  const handleGiveDose = async () => {
    if (!selectedRow || !doseGiven.trim()) return
    try {
      setSubmitting(true)
      const res = await fetch("/api/prescription-administrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          prescriptionId: selectedRow.prescriptionId,
          doseGiven: doseGiven.trim(),
          route: route.trim() || undefined,
          notes: notes.trim() || undefined,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to record administration")
      }
      toast.success(`${selectedRow.medication} dose recorded`)
      setDialogOpen(false)
      await loadData()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to record dose"
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (marRows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-2">
        <Pill className="h-8 w-8" />
        <p className="text-sm">No medications scheduled for today.</p>
      </div>
    )
  }

  return (
    <>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Medication</TableHead>
              <TableHead>Due</TableHead>
              <TableHead>Given At</TableHead>
              <TableHead>Given By</TableHead>
              <TableHead>Dose</TableHead>
              <TableHead>Status</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {marRows.map((row, i) => {
              const cfg = STATUS_CONFIG[row.status]
              const Icon = cfg.icon
              const canGive = ["due", "delayed", "missed", "stat-pending"].includes(row.status)
              return (
                <TableRow key={`${row.prescriptionId}-${i}`}>
                  <TableCell className="font-medium">{row.medication}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {row.scheduledAt
                      ? row.scheduledAt.toLocaleTimeString("en-UG", { hour: "2-digit", minute: "2-digit" })
                      : <span className="text-violet-600 font-medium">Now (stat)</span>}
                  </TableCell>
                  <TableCell className="text-sm">
                    {row.administration
                      ? new Date(row.administration.administered_at).toLocaleTimeString("en-UG", { hour: "2-digit", minute: "2-digit" })
                      : "—"}
                  </TableCell>
                  <TableCell className="text-sm">{row.administration?.nurse_name ?? "—"}</TableCell>
                  <TableCell className="text-sm font-mono">{row.administration?.dose_given ?? row.dosage}</TableCell>
                  <TableCell>
                    <Badge className={`border text-xs flex items-center gap-1 w-fit ${cfg.badge}`}>
                      <Icon className="h-3 w-3" />
                      {cfg.label}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {canGive && (
                      <Button size="sm" variant="outline" onClick={() => openGiveDialog(row)}>
                        Give
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Dose — {selectedRow?.medication}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="mar-dose">Dose Given</Label>
              <Input
                id="mar-dose"
                name="mar-dose"
                autoComplete="off"
                value={doseGiven}
                onChange={(e) => setDoseGiven(e.target.value)}
                placeholder={selectedRow?.dosage}
              />
            </div>
            <div>
              <Label htmlFor="mar-route">Route (optional)</Label>
              <Input
                id="mar-route"
                name="mar-route"
                autoComplete="off"
                value={route}
                onChange={(e) => setRoute(e.target.value)}
                placeholder="e.g. IV, PO, IM"
              />
            </div>
            <div>
              <Label htmlFor="mar-notes">Notes (optional)</Label>
              <Textarea
                id="mar-notes"
                name="mar-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any observations"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleGiveDose} disabled={submitting || !doseGiven.trim()}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {submitting ? "Recording…" : "Record Dose"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
