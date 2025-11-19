"use client"

import { createContext, useContext, useRef, useState, type ReactNode } from "react"

export interface VitalSigns {
  id: string
  patientId: string
  patientName: string
  nurseName: string
  date: string
  time: string
  bloodPressure: string
  temperature: string
  heartRate: string
  respiratoryRate: string
  oxygenSaturation: string
  weight?: string
  height?: string
  notes?: string
}

export interface NursingNote {
  id: string
  patientId: string
  patientName: string
  nurseName: string
  date: string
  time: string
  category: "assessment" | "medication" | "procedure" | "observation" | "other"
  note: string
}

interface NursingContextType {
  vitalSigns: VitalSigns[]
  nursingNotes: NursingNote[]
  addVitalSigns: (vitals: Omit<VitalSigns, "id">) => void
  addNursingNote: (note: Omit<NursingNote, "id">) => void
  getPatientVitals: (patientId: string) => VitalSigns[]
  getPatientNotes: (patientId: string) => NursingNote[]
  getLatestVitals: (patientId: string) => VitalSigns | undefined
  prefetchPatient: (patientId: string) => Promise<void>
}

const NursingContext = createContext<NursingContextType | undefined>(undefined)

export function NursingProvider({ children }: { children: ReactNode }) {
  const [vitalSigns, setVitalSigns] = useState<VitalSigns[]>([])
  const [nursingNotes, setNursingNotes] = useState<NursingNote[]>([])
  const fetchedVitals = useRef<Set<string>>(new Set())
  const fetchedNotes = useRef<Set<string>>(new Set())
  const fetchingVitals = useRef<Set<string>>(new Set())
  const fetchingNotes = useRef<Set<string>>(new Set())

  function dedupeById<T extends { id: string }>(items: T[]): T[] {
    const map = new Map<string, T>()
    for (const it of items) map.set(it.id, it)
    return Array.from(map.values())
  }

  async function loadVitals(patientId: string) {
    if (fetchedVitals.current.has(patientId) || fetchingVitals.current.has(patientId)) return
    fetchingVitals.current.add(patientId)
    try {
      const res = await fetch(`/api/vitals?patientId=${encodeURIComponent(patientId)}`, { credentials: "include" })
      if (!res.ok) return
      const data = await res.json().catch(() => ({}))
      const rows = Array.isArray(data?.vitals) ? (data.vitals as VitalSigns[]) : []
      setVitalSigns((prev) => dedupeById([...prev, ...rows]))
      fetchedVitals.current.add(patientId)
    } finally {
      fetchingVitals.current.delete(patientId)
    }
  }

  async function loadNotes(patientId: string) {
    if (fetchedNotes.current.has(patientId) || fetchingNotes.current.has(patientId)) return
    fetchingNotes.current.add(patientId)
    try {
      const res = await fetch(`/api/nursing-notes?patientId=${encodeURIComponent(patientId)}`, { credentials: "include" })
      if (!res.ok) return
      const data = await res.json().catch(() => ({}))
      const rows = Array.isArray(data?.notes) ? (data.notes as NursingNote[]) : []
      setNursingNotes((prev) => dedupeById([...prev, ...rows]))
      fetchedNotes.current.add(patientId)
    } finally {
      fetchingNotes.current.delete(patientId)
    }
  }

  const prefetchPatient = async (patientId: string) => {
    await Promise.all([loadVitals(patientId), loadNotes(patientId)])
  }

  const addVitalSigns = (vitals: Omit<VitalSigns, "id">) => {
    ;(async () => {
      try {
        const res = await fetch("/api/vitals", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            patientId: vitals.patientId,
            bloodPressure: vitals.bloodPressure,
            temperature: vitals.temperature,
            heartRate: vitals.heartRate,
            respiratoryRate: vitals.respiratoryRate,
            oxygenSaturation: vitals.oxygenSaturation,
            weight: vitals.weight,
            height: vitals.height,
            notes: vitals.notes,
          }),
        })
        if (!res.ok) throw new Error("Failed to record vitals")
        const { id, recordedAt } = await res.json()
        const d = new Date(recordedAt || Date.now())
        const newVitals: VitalSigns = {
          id,
          patientId: vitals.patientId,
          patientName: vitals.patientName,
          nurseName: vitals.nurseName,
          date: d.toISOString().slice(0, 10),
          time: d.toTimeString().slice(0, 5),
          bloodPressure: vitals.bloodPressure,
          temperature: vitals.temperature,
          heartRate: vitals.heartRate,
          respiratoryRate: vitals.respiratoryRate,
          oxygenSaturation: vitals.oxygenSaturation,
          weight: vitals.weight,
          height: vitals.height,
          notes: vitals.notes,
        }
        setVitalSigns((prev) => [newVitals, ...prev])
      } catch (e) {
        console.error("Failed to save vitals:", e)
      }
    })()
  }

  const addNursingNote = (note: Omit<NursingNote, "id">) => {
    ;(async () => {
      try {
        const res = await fetch("/api/nursing-notes", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            patientId: note.patientId,
            category: note.category,
            note: note.note,
          }),
        })
        if (!res.ok) throw new Error("Failed to add nursing note")
        const { id, createdAt } = await res.json()
        const d = new Date(createdAt || Date.now())
        const newNote: NursingNote = {
          id,
          patientId: note.patientId,
          patientName: note.patientName,
          nurseName: note.nurseName,
          date: d.toISOString().slice(0, 10),
          time: d.toTimeString().slice(0, 5),
          category: note.category,
          note: note.note,
        }
        setNursingNotes((prev) => [newNote, ...prev])
      } catch (e) {
        console.error("Failed to save nursing note:", e)
      }
    })()
  }

  const getPatientVitals = (patientId: string) => {
    return vitalSigns.filter((vs) => vs.patientId === patientId)
  }

  const getPatientNotes = (patientId: string) => {
    return nursingNotes.filter((nn) => nn.patientId === patientId)
  }

  const getLatestVitals = (patientId: string) => {
    const patientVitals = getPatientVitals(patientId)
    return patientVitals[0] || patientVitals[patientVitals.length - 1]
  }

  return (
    <NursingContext.Provider
      value={{
        vitalSigns,
        nursingNotes,
        addVitalSigns,
        addNursingNote,
        getPatientVitals,
        getPatientNotes,
        getLatestVitals,
        prefetchPatient,
      }}
    >
      {children}
    </NursingContext.Provider>
  )
}

export function useNursing() {
  const context = useContext(NursingContext)
  if (context === undefined) {
    throw new Error("useNursing must be used within a NursingProvider")
  }
  return context
}

