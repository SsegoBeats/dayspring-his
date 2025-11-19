"use client"

import { useEffect, useMemo, useState } from "react"
import { usePatients } from "@/lib/patient-context"
import { useFormatDate } from "@/lib/date-utils"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import AppointmentForm from "@/components/appointments/appointment-form"

export function AppointmentCalendar() {
  const { appointments, getAppointmentsByDate } = usePatients()
  const { formatDate } = useFormatDate()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [view, setView] = useState<"day" | "week" | "month">("week")
  const [doctors, setDoctors] = useState<{ id: string; name: string }[]>([])
  const [doctorId, setDoctorId] = useState<string>("")
  const [slots, setSlots] = useState<{ time: string; capacity: number; available: number }[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [openForm, setOpenForm] = useState<null | { date: string; time?: string }>(null)

  const formatDateString = (date: Date) => {
    return date.toISOString().split("T")[0]
  }

  const navigateDate = (direction: "prev" | "next") => {
    const newDate = new Date(currentDate)
    if (view === "day") {
      newDate.setDate(newDate.getDate() + (direction === "next" ? 1 : -1))
    } else if (view === "week") {
      newDate.setDate(newDate.getDate() + (direction === "next" ? 7 : -7))
    } else {
      newDate.setMonth(newDate.getMonth() + (direction === "next" ? 1 : -1))
    }
    setCurrentDate(newDate)
  }

  const getWeekDates = () => {
    const dates: Date[] = []
    const startOfWeek = new Date(currentDate)
    startOfWeek.setDate(currentDate.getDate() - currentDate.getDay())

    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek)
      date.setDate(startOfWeek.getDate() + i)
      dates.push(date)
    }
    return dates
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "scheduled":
        return "bg-blue-500"
      case "completed":
        return "bg-green-500"
      case "cancelled":
        return "bg-red-500"
      case "no-show":
        return "bg-gray-500"
      default:
        return "bg-gray-500"
    }
  }

  const renderDayView = () => {
    const dateStr = formatDateString(currentDate)
    const dayAppointments = getAppointmentsByDate(dateStr).sort((a, b) => a.time.localeCompare(b.time))

    return (
      <div className="space-y-2">
        <h3 className="font-semibold text-foreground">
          {formatDate(currentDate, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
        </h3>
        {dayAppointments.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">No appointments scheduled</p>
        ) : (
          <div className="space-y-2">
            {dayAppointments.map((apt) => (
              <div key={apt.id} className="rounded-lg border border-border p-3 hover:bg-accent/50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">{apt.time}</span>
                      <Badge variant="outline" className={getStatusColor(apt.status)}>
                        {apt.status}
                      </Badge>
                    </div>
                    <p className="text-sm font-medium text-foreground mt-1">{apt.patientName}</p>
                    <p className="text-sm text-muted-foreground">{apt.doctorName}</p>
                    <p className="text-sm text-muted-foreground">{apt.type}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-foreground">Available Slots</h4>
            <div className="w-56">
              <Select value={doctorId} onValueChange={setDoctorId}>
                <SelectTrigger><SelectValue placeholder="Select clinician" /></SelectTrigger>
                <SelectContent>
                  {doctors.map((d)=> (
                    <SelectItem key={d.id} value={d.id}>{d.name || d.id}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {doctorId ? (
            loadingSlots ? (
              <div className="text-sm text-muted-foreground">Loading available slots…</div>
            ) : slots.length === 0 ? (
              <div className="text-sm text-muted-foreground">No available slots. You can still book manually.</div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {slots.map((s)=> (
                  <Button key={s.time} size="sm" variant="outline" onClick={()=> setOpenForm({ date: dateStr, time: s.time })}>
                    {s.time} ({s.available})
                  </Button>
                ))}
              </div>
            )
          ) : (
            <div className="text-sm text-muted-foreground">Select a clinician to view available slots.</div>
          )}
        </div>
      </div>
    )
  }

  const renderWeekView = () => {
    const weekDates = getWeekDates()

    return (
      <div className="grid grid-cols-7 gap-2">
        {weekDates.map((date, index) => {
          const dateStr = formatDate(date)
          const dayAppointments = getAppointmentsByDate(dateStr)
          const isToday = formatDate(new Date()) === dateStr

          return (
            <div
              key={index}
              className={`rounded-lg border border-border p-2 min-h-32 ${isToday ? "bg-accent/30" : ""}`}
            >
              <div className="text-center mb-2">
                <p className="text-xs text-muted-foreground">
                  {formatDate(date, { weekday: "short" })}
                </p>
                <p className={`text-sm font-semibold ${isToday ? "text-primary" : "text-foreground"}`}>
                  {date.getDate()}
                </p>
              </div>
              <div className="space-y-1">
                {dayAppointments.slice(0, 3).map((apt) => (
                  <div key={apt.id} className="text-xs rounded bg-primary/10 p-1 truncate">
                    <p className="font-medium text-foreground">{apt.time}</p>
                    <p className="text-muted-foreground truncate">{apt.patientName}</p>
                  </div>
                ))}
                {dayAppointments.length > 3 && (
                  <p className="text-xs text-muted-foreground text-center">+{dayAppointments.length - 3} more</p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Appointment Calendar</CardTitle>
            <CardDescription>View and manage appointments</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setView("day")} disabled={view === "day"}>
              Day
            </Button>
            <Button variant="outline" size="sm" onClick={() => setView("week")} disabled={view === "week"}>
              Week
            </Button>
            <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())}>
              Today
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Button variant="outline" size="icon" onClick={() => navigateDate("prev")}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h3 className="font-semibold text-foreground">
              {view === "week"
                ? `Week of ${formatDate(currentDate, { month: "long", day: "numeric", year: "numeric" })}`
                : formatDate(currentDate, { month: "long", year: "numeric" })}
            </h3>
            <Button variant="outline" size="icon" onClick={() => navigateDate("next")}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {view === "day" && renderDayView()}
          {view === "week" && renderWeekView()}
        </div>
      </CardContent>
      <Dialog open={!!openForm} onOpenChange={(v)=>{ if(!v) setOpenForm(null) }}>
        <DialogContent size="xl" className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Book Appointment</DialogTitle>
          </DialogHeader>
          <AppointmentForm
            initialDoctorId={doctorId || undefined}
            initialDate={openForm?.date}
            initialTime={openForm?.time}
            onSubmitted={() => setOpenForm(null)}
          />
        </DialogContent>
      </Dialog>
    </Card>
  )
}

