"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"

export interface Patient {
  id: string
  patientNumber?: string
  firstName: string
  lastName: string
  dateOfBirth?: string | null
  ageYears?: number | null
  gender: string
  phone: string
  address?: string
  bloodGroup?: string
  allergies?: string
  emergencyContact?: string
  emergencyPhone?: string
  registrationDate: string
  status: "active" | "inactive" | "deceased" | string
  triageCategory?: string | null
  nextOfKinName?: string | null
  nextOfKinPhone?: string | null
  nextOfKinRelation?: string | null
  nextOfKinResidence?: string | null
}

export interface Appointment {
  id: string
  patientId: string
  patientName: string
  doctorName: string
  date: string
  time: string
  type: string
  status: "scheduled" | "completed" | "cancelled" | "no-show"
  notes?: string
  reminderSent?: boolean
  cancelledBy?: string
  cancelledReason?: string
  rescheduledFrom?: string
}

export interface DoctorSchedule {
  id: string
  doctorName: string
  dayOfWeek: number // 0-6 (Sunday-Saturday)
  startTime: string
  endTime: string
  slotDuration: number // in minutes
  maxPatientsPerSlot: number
}

interface PatientContextType {
  patients: Patient[]
  appointments: Appointment[]
  doctorSchedules: DoctorSchedule[]
  loadingPatients: boolean
  loadingAppointments: boolean
  refreshAppointments?: () => Promise<void>
  refreshPatients: () => Promise<void>
  addPatient: (patient: Omit<Patient, "id" | "registrationDate" | "status">) => void
  updatePatient: (id: string, patient: Partial<Patient>) => void
  getPatient: (id: string) => Patient | undefined
  searchPatients: (query: string) => Patient[]
  addAppointment: (appointment: Omit<Appointment, "id">) => void
  updateAppointment: (id: string, appointment: Partial<Appointment>) => void
  getPatientAppointments: (patientId: string) => Appointment[]
  cancelAppointment: (id: string, reason: string, cancelledBy: string) => void
  rescheduleAppointment: (id: string, newDate: string, newTime: string) => void
  getAppointmentsByDate: (date: string) => Appointment[]
  getAppointmentsByDoctor: (doctorName: string, date: string) => Appointment[]
  addDoctorSchedule: (schedule: Omit<DoctorSchedule, "id">) => void
  getDoctorSchedule: (doctorName: string, dayOfWeek: number) => DoctorSchedule | undefined
  getAvailableSlots: (doctorName: string, date: string) => string[]
}

const PatientContext = createContext<PatientContextType | undefined>(undefined)

export function PatientProvider({ children }: { children: ReactNode }) {
  const [patients, setPatients] = useState<Patient[]>([])
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [doctorSchedules, setDoctorSchedules] = useState<DoctorSchedule[]>([])
  const [loadingPatients, setLoadingPatients] = useState<boolean>(true)
  const [loadingAppointments, setLoadingAppointments] = useState<boolean>(true)

  useEffect(() => {
    // Fetch patients from backend
    ;(async () => {
      try {
        const res = await fetch("/api/patients", { credentials: 'include' })
        if (res.ok) {
          const data = await res.json()
          const mapped: Patient[] = (data.patients || []).map((p: any) => ({
            id: p.id,
            patientNumber: p.patient_number,
            firstName: p.first_name,
            lastName: p.last_name,
            dateOfBirth: p.date_of_birth,
            ageYears: typeof p.age_years === 'number' ? p.age_years : undefined,
            gender: (p.gender || "Other").toString().toLowerCase(),
            phone: p.phone || "",
            address: p.address || "",
            bloodGroup: p.blood_group || undefined,
            allergies: p.allergies || undefined,
            emergencyContact: p.emergency_contact_name || "",
            emergencyPhone: p.emergency_contact_phone || "",
            registrationDate: p.created_at?.slice(0,10) || "",
            status: (p.current_status || 'active').toString().toLowerCase() as any,
            triageCategory: p.latest_triage_category || null,
            nextOfKinName: (p.next_of_kin_name ? p.next_of_kin_name : [p.next_of_kin_first_name, p.next_of_kin_last_name].filter(Boolean).join(' ').trim()) || null,
            nextOfKinPhone: p.next_of_kin_phone || null,
            nextOfKinRelation: p.next_of_kin_relation || null,
            nextOfKinResidence: p.next_of_kin_residence || null,
          }))
          setPatients(mapped)
        } else { setPatients([]) }
      } catch { setPatients([]) }
      finally { setLoadingPatients(false) }
    })()

    // Initial fetch appointments from backend
    ;(async () => { try { await doRefreshAppointments() } finally { /* flag handled in helper */ } })()

    // Keep local schedules temporarily (no backend for schedules yet)
    setDoctorSchedules([])
  }, [])

  const refreshPatients = async () => {
    try {
      const list = await fetch('/api/patients?limit=100', { credentials: 'include' }).then((r) => r.json())
      const mapped: Patient[] = (list.patients || []).map((p: any) => ({
        id: p.id,
        patientNumber: p.patient_number,
        firstName: p.first_name,
        lastName: p.last_name,
        dateOfBirth: p.date_of_birth || '',
        ageYears: typeof p.age_years === 'number' ? p.age_years : undefined,
        gender: (p.gender || 'Other').toString().toLowerCase(),
        phone: p.phone || '',
        address: p.address || '',
        bloodGroup: p.blood_group || undefined,
        registrationDate: p.created_at?.slice(0,10) || new Date().toISOString().slice(0,10),
        status: (p.current_status || 'active').toString().toLowerCase() as any,
        triageCategory: p.latest_triage_category || null,
        emergencyContact: p.emergency_contact_name || "",
        emergencyPhone: p.emergency_contact_phone || "",
        nextOfKinName: (p.next_of_kin_name ? p.next_of_kin_name : [p.next_of_kin_first_name, p.next_of_kin_last_name].filter(Boolean).join(' ').trim()) || null,
        nextOfKinPhone: p.next_of_kin_phone || null,
        nextOfKinRelation: p.next_of_kin_relation || null,
        nextOfKinResidence: p.next_of_kin_residence || null,
      }))
      setPatients(mapped)
    } catch {}
  }

  // Helper to refresh appointments
  const doRefreshAppointments = async () => {
    try {
      setLoadingAppointments(true)
      const res = await fetch("/api/appointments/list", { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        const mapped: Appointment[] = (data.appointments || []).map((a: any) => ({
          id: a.id,
          patientId: a.patient_id,
          patientName: `${a.first_name || ''} ${a.last_name || ''}`.trim(),
          doctorName: a.doctor_name || "",
          date: a.appointment_date,
          time: a.appointment_time,
          type: a.reason || "General",
          status: (a.status || "Scheduled").toString().toLowerCase() as any,
          notes: a.notes || undefined,
        }))
        setAppointments(mapped)
      } else { setAppointments([]) }
    } catch { setAppointments([]) }
    finally { setLoadingAppointments(false) }
  }

  // Removed localStorage persistence: backend is source of truth

  const addPatient = async (patient: Omit<Patient, "id" | "registrationDate" | "status">) => {
    try {
      const payload = {
        firstName: patient.firstName,
        lastName: patient.lastName,
        dateOfBirth: null,
        ageYears: patient.ageYears ?? null,
        gender: (patient.gender || 'other').toString().replace(/\b\w/g, (c) => c.toUpperCase()),
        phone: patient.phone,
        address: patient.address || null,
        nin: null,
      }
      const res = await fetch('/api/patients', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(payload) })
      if (!res.ok) throw new Error('Failed to create patient')
      await refreshPatients()
    } catch (e) {
      console.error('addPatient failed', e)
    }
  }

  const updatePatient = (id: string, updatedData: Partial<Patient>) => {
    setPatients(patients.map((p) => (p.id === id ? { ...p, ...updatedData } : p)))
  }

  const getPatient = (id: string) => {
    return patients.find((p) => p.id === id)
  }

  const searchPatients = (query: string) => {
    const lowerQuery = query.toLowerCase()
    return patients.filter(
      (p) =>
        p.firstName.toLowerCase().includes(lowerQuery) ||
        p.lastName.toLowerCase().includes(lowerQuery) ||
        (p.patientNumber || '').toLowerCase().includes(lowerQuery) ||
        p.phone.includes(query),
    )
  }

  const addAppointment = (appointment: Omit<Appointment, "id">) => {
    const newAppointment: Appointment = {
      ...appointment,
      id: `APT${String(appointments.length + 1).padStart(3, "0")}`,
    }
    setAppointments([...appointments, newAppointment])
  }

  const updateAppointment = (id: string, updatedData: Partial<Appointment>) => {
    setAppointments(appointments.map((a) => (a.id === id ? { ...a, ...updatedData } : a)))
  }

  const getPatientAppointments = (patientId: string) => {
    return appointments.filter((a) => a.patientId === patientId)
  }

  const cancelAppointment = (id: string, reason: string, cancelledBy: string) => {
    setAppointments(
      appointments.map((a) =>
        a.id === id
          ? {
              ...a,
              status: "cancelled",
              cancelledReason: reason,
              cancelledBy: cancelledBy,
            }
          : a,
      ),
    )
  }

  const rescheduleAppointment = (id: string, newDate: string, newTime: string) => {
    setAppointments(
      appointments.map((a) =>
        a.id === id
          ? {
              ...a,
              rescheduledFrom: `${a.date} ${a.time}`,
              date: newDate,
              time: newTime,
            }
          : a,
      ),
    )
  }

  const getAppointmentsByDate = (date: string) => {
    return appointments.filter((a) => a.date === date && a.status !== "cancelled")
  }

  const getAppointmentsByDoctor = (doctorName: string, date: string) => {
    return appointments.filter((a) => a.doctorName === doctorName && a.date === date && a.status !== "cancelled")
  }

  const addDoctorSchedule = (schedule: Omit<DoctorSchedule, "id">) => {
    const newSchedule: DoctorSchedule = {
      ...schedule,
      id: `DS${String(doctorSchedules.length + 1).padStart(3, "0")}`,
    }
    setDoctorSchedules([...doctorSchedules, newSchedule])
  }

  const getDoctorSchedule = (doctorName: string, dayOfWeek: number) => {
    return doctorSchedules.find((s) => s.doctorName === doctorName && s.dayOfWeek === dayOfWeek)
  }

  const getAvailableSlots = (doctorName: string, date: string) => {
    const dayOfWeek = new Date(date).getDay()
    const schedule = getDoctorSchedule(doctorName, dayOfWeek)

    if (!schedule) return []

    const slots: string[] = []
    const [startHour, startMin] = schedule.startTime.split(":").map(Number)
    const [endHour, endMin] = schedule.endTime.split(":").map(Number)

    let currentTime = startHour * 60 + startMin
    const endTime = endHour * 60 + endMin

    while (currentTime < endTime) {
      const hour = Math.floor(currentTime / 60)
      const min = currentTime % 60
      const timeSlot = `${String(hour).padStart(2, "0")}:${String(min).padStart(2, "0")}`

      const bookedAppointments = getAppointmentsByDoctor(doctorName, date).filter((a) => a.time === timeSlot)

      if (bookedAppointments.length < schedule.maxPatientsPerSlot) {
        slots.push(timeSlot)
      }

      currentTime += schedule.slotDuration
    }

    return slots
  }

  return (
    <PatientContext.Provider
      value={{
        patients,
        appointments,
        doctorSchedules,
        loadingPatients,
        loadingAppointments,
        refreshAppointments: doRefreshAppointments,
        refreshPatients,
        addPatient,
        updatePatient,
        getPatient,
        searchPatients,
        addAppointment,
        updateAppointment,
        getPatientAppointments,
        cancelAppointment,
        rescheduleAppointment,
        getAppointmentsByDate,
        getAppointmentsByDoctor,
        addDoctorSchedule,
        getDoctorSchedule,
        getAvailableSlots,
      }}
    >
      {children}
    </PatientContext.Provider>
  )
}

export function usePatients() {
  const context = useContext(PatientContext)
  if (context === undefined) {
    throw new Error("usePatients must be used within a PatientProvider")
  }
  return context
}
