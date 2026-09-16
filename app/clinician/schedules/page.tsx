"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/lib/auth-context"
import { DashboardLayout } from "@/components/dashboard-layout"
import { toast } from "sonner"
import { Pencil, Trash2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"

type Clinician = { id: string; name: string }
type Schedule = {
  id: string
  doctor_id: string
  doctor_name: string
  day_of_week: number
  start_time: string
  end_time: string
  slot_duration: number
  max_patients_per_slot: number
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

export default function ClinicianSchedulesPage() {
  const router = useRouter()
  const { user, isLoading } = useAuth()
  const [clinicians, setClinicians] = useState<Clinician[]>([])
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [clinicianId, setClinicianId] = useState("")
  const [day, setDay] = useState<number | undefined>(undefined)
  const [start, setStart] = useState("")
  const [end, setEnd] = useState("")
  const [duration, setDuration] = useState(30)
  const [capacity, setCapacity] = useState(1)
  const [saving, setSaving] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null)
  const [editStart, setEditStart] = useState("")
  const [editEnd, setEditEnd] = useState("")
  const [editDuration, setEditDuration] = useState(30)
  const [editCapacity, setEditCapacity] = useState(1)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const loadData = async () => {
    const [clinRes, schedRes] = await Promise.all([
      fetch("/api/users/clinicians").then((r) => r.json()),
      fetch("/api/clinician-schedules").then((r) => r.json()),
    ])
    const list = (clinRes.clinicians || []) as { id: string; name: string }[]
    setClinicians(list.map((d) => ({ id: d.id, name: d.name })))
    setSchedules(schedRes.schedules || [])
  }

  useEffect(() => {
    if (isLoading) return
    if (!user) {
      router.push("/")
      return
    }
  }, [user, isLoading, router])

  useEffect(() => {
    void loadData()
  }, [])

  if (isLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  const save = async () => {
    if (!clinicianId || day === undefined || !start || !end) return
    setSaving(true)
    try {
      const body = {
        doctorId: clinicianId,
        dayOfWeek: day,
        startTime: start,
        endTime: end,
        slotDuration: duration,
        maxPatientsPerSlot: capacity,
      }
      const res = await fetch("/api/clinician-schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        toast.success("Schedule saved successfully")
        await loadData()
      } else {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error || "Failed to save schedule")
      }
    } catch {
      toast.error("Failed to save schedule")
    } finally {
      setSaving(false)
    }
  }

  const openEdit = (s: Schedule) => {
    setEditingSchedule(s)
    setEditStart(String(s.start_time).slice(0, 5))
    setEditEnd(String(s.end_time).slice(0, 5))
    setEditDuration(s.slot_duration)
    setEditCapacity(s.max_patients_per_slot)
    setEditOpen(true)
  }

  const saveEdit = async () => {
    if (!editingSchedule) return
    setSaving(true)
    try {
      const res = await fetch("/api/clinician-schedules", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingSchedule.id,
          startTime: editStart,
          endTime: editEnd,
          slotDuration: editDuration,
          maxPatientsPerSlot: editCapacity,
        }),
      })
      if (res.ok) {
        toast.success("Schedule updated")
        setEditOpen(false)
        setEditingSchedule(null)
        await loadData()
      } else {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error || "Failed to update schedule")
      }
    } catch {
      toast.error("Failed to update schedule")
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleteId) return
    try {
      const res = await fetch(`/api/clinician-schedules?id=${encodeURIComponent(deleteId)}`, {
        method: "DELETE",
      })
      if (res.ok) {
        toast.success("Schedule removed")
        setDeleteId(null)
        await loadData()
      } else {
        toast.error("Failed to remove schedule")
      }
    } catch {
      toast.error("Failed to remove schedule")
    }
  }

  return (
    <DashboardLayout>
    <div className="container mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Clinician Schedules</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-5">
            <div className="space-y-2">
              <Label>Clinician</Label>
              <Select value={clinicianId} onValueChange={setClinicianId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select clinician" />
                </SelectTrigger>
                <SelectContent>
                  {clinicians.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Day</Label>
              <Select value={day?.toString() ?? ""} onValueChange={(v) => setDay(parseInt(v))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select day" />
                </SelectTrigger>
                <SelectContent>
                  {DAYS.map((name, idx) => (
                    <SelectItem key={idx} value={String(idx)}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Start</Label>
              <Input id="schedule-start" name="startTime" type="time" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>End</Label>
              <Input id="schedule-end" name="endTime" type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Slot / Capacity</Label>
              <div className="grid grid-cols-2 gap-2">
                <Select value={duration.toString()} onValueChange={(v) => setDuration(parseInt(v))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10m</SelectItem>
                    <SelectItem value="15">15m</SelectItem>
                    <SelectItem value="20">20m</SelectItem>
                    <SelectItem value="30">30m</SelectItem>
                    <SelectItem value="60">60m</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={capacity.toString()} onValueChange={(v) => setCapacity(parseInt(v))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5].map((c) => (
                      <SelectItem key={c} value={c.toString()}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <Button
            onClick={save}
            disabled={saving || !clinicianId || day === undefined || !start || !end}
          >
            {saving ? "Saving..." : "Save Schedule"}
          </Button>

          <div className="space-y-3">
            <h3 className="font-semibold">Existing Schedules</h3>
            <div className="grid gap-2 md:grid-cols-2">
              {schedules.map((s) => (
                <Card key={s.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="font-medium">{s.doctor_name}</div>
                        <div className="text-sm text-muted-foreground">
                          {DAYS[s.day_of_week]} {String(s.start_time).slice(0, 5)} -{" "}
                          {String(s.end_time).slice(0, 5)}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-sm text-muted-foreground">
                          {s.slot_duration}m · cap {s.max_patients_per_slot}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openEdit(s)}
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => setDeleteId(s.id)}
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Schedule</DialogTitle>
          </DialogHeader>
          {editingSchedule && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {editingSchedule.doctor_name} · {DAYS[editingSchedule.day_of_week]}
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start</Label>
                  <Input
                    type="time"
                    value={editStart}
                    onChange={(e) => setEditStart(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>End</Label>
                  <Input id="schedule-edit-end" name="editEndTime" type="time" value={editEnd} onChange={(e) => setEditEnd(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Slot (min)</Label>
                  <Select
                    value={editDuration.toString()}
                    onValueChange={(v) => setEditDuration(parseInt(v))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[10, 15, 20, 30, 60].map((m) => (
                        <SelectItem key={m} value={String(m)}>
                          {m}m
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Capacity</Label>
                  <Select
                    value={editCapacity.toString()}
                    onValueChange={(v) => setEditCapacity(parseInt(v))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5].map((c) => (
                        <SelectItem key={c} value={String(c)}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveEdit} disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove schedule?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will remove the selected schedule. You can add it again later.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </DashboardLayout>
  )
}
