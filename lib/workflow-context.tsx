"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"

export type TriageLevel = "emergency" | "very-urgent" | "urgent" | "standard" | "non-urgent"
export type Department =
  | "reception"
  | "triage"
  | "nurse"
  | "doctor"
  | "lab"
  | "radiology"
  | "pharmacy"
  | "cashier"
  | "discharged"

export interface TriageData {
  level: TriageLevel
  chiefComplaint: string
  vitalSigns: {
    temperature?: string
    bloodPressure?: string
    heartRate?: string
    respiratoryRate?: string
    oxygenSaturation?: string
  }
  consciousness: "alert" | "verbal" | "pain" | "unresponsive"
  mobility: "ambulatory" | "wheelchair" | "stretcher"
  painLevel: number // 0-10
  symptoms: string[]
  triageNotes: string
  triageBy: string
  triageTime: string
}

export interface PatientJourney {
  patientId: string
  patientName: string
  currentDepartment: Department
  nextDepartment?: Department
  triage?: TriageData
  visitId: string
  visitDate: string
  status: "in-progress" | "completed"
  timeline: {
    department: Department
    arrivedAt: string
    completedAt?: string
    handledBy?: string
    notes?: string
  }[]
}

export interface Notification {
  id: string
  type: "patient-arrival" | "prescription-ready" | "payment-made" | "test-ordered" | "test-completed" | "low-stock"
  department: Department
  message: string
  patientId?: string
  patientName?: string
  timestamp: string
  read: boolean
  priority: "high" | "medium" | "low"
}

interface WorkflowContextType {
  journeys: PatientJourney[]
  notifications: Notification[]
  startPatientJourney: (patientId: string, patientName: string, triage: TriageData) => string
  routePatient: (
    visitId: string,
    fromDepartment: Department,
    toDepartment: Department,
    handledBy: string,
    notes?: string,
  ) => void
  getPatientsByDepartment: (department: Department) => PatientJourney[]
  getPatientJourney: (visitId: string) => PatientJourney | undefined
  addNotification: (notification: Omit<Notification, "id" | "timestamp" | "read">) => void
  markNotificationRead: (id: string) => void
  getUnreadNotifications: (department: Department) => Notification[]
  clearNotifications: (department: Department) => void
}

const WorkflowContext = createContext<WorkflowContextType | undefined>(undefined)

export function WorkflowProvider({ children }: { children: ReactNode }) {
  const [journeys, setJourneys] = useState<PatientJourney[]>([])
  const [notifications, setNotifications] = useState<Notification[]>([])

  useEffect(() => {
    const storedJourneys = localStorage.getItem("his-journeys")
    const storedNotifications = localStorage.getItem("his-notifications")

    if (storedJourneys) {
      setJourneys(JSON.parse(storedJourneys))
    }
    if (storedNotifications) {
      setNotifications(JSON.parse(storedNotifications))
    }
  }, [])

  useEffect(() => {
    if (journeys.length > 0) {
      localStorage.setItem("his-journeys", JSON.stringify(journeys))
    }
  }, [journeys])

  useEffect(() => {
    if (notifications.length > 0) {
      localStorage.setItem("his-notifications", JSON.stringify(notifications))
    }
  }, [notifications])

  const startPatientJourney = (patientId: string, patientName: string, triage: TriageData): string => {
    const visitId = `V${Date.now()}`
    const now = new Date().toISOString()

    // Determine initial department based on triage level
    let nextDepartment: Department = "nurse"
    if (triage.level === "emergency") {
      nextDepartment = "doctor" // Emergency goes straight to doctor
    }

    const journey: PatientJourney = {
      patientId,
      patientName,
      currentDepartment: "triage",
      nextDepartment,
      triage,
      visitId,
      visitDate: now.split("T")[0],
      status: "in-progress",
      timeline: [
        {
          department: "reception",
          arrivedAt: now,
          completedAt: now,
          handledBy: "Receptionist",
        },
        {
          department: "triage",
          arrivedAt: now,
          handledBy: triage.triageBy,
        },
      ],
    }

    setJourneys([...journeys, journey])

    // Notify next department
    addNotification({
      type: "patient-arrival",
      department: nextDepartment,
      message: `New ${triage.level} patient: ${patientName}`,
      patientId,
      patientName,
      priority: triage.level === "emergency" || triage.level === "very-urgent" ? "high" : "medium",
    })

    return visitId
  }

  const routePatient = (
    visitId: string,
    fromDepartment: Department,
    toDepartment: Department,
    handledBy: string,
    notes?: string,
  ) => {
    const now = new Date().toISOString()

    setJourneys(
      journeys.map((j) => {
        if (j.visitId === visitId) {
          // Update timeline
          const updatedTimeline = j.timeline.map((t) =>
            t.department === fromDepartment && !t.completedAt ? { ...t, completedAt: now, handledBy, notes } : t,
          )

          // Add new department to timeline if not discharged
          if (toDepartment !== "discharged") {
            updatedTimeline.push({
              department: toDepartment,
              arrivedAt: now,
            })
          }

          return {
            ...j,
            currentDepartment: toDepartment,
            nextDepartment: toDepartment === "discharged" ? undefined : j.nextDepartment,
            status: toDepartment === "discharged" ? "completed" : "in-progress",
            timeline: updatedTimeline,
          }
        }
        return j
      }),
    )

    // Notify next department
    if (toDepartment !== "discharged") {
      const journey = journeys.find((j) => j.visitId === visitId)
      if (journey) {
        addNotification({
          type: "patient-arrival",
          department: toDepartment,
          message: `Patient ${journey.patientName} routed from ${fromDepartment}`,
          patientId: journey.patientId,
          patientName: journey.patientName,
          priority: journey.triage?.level === "emergency" ? "high" : "medium",
        })
      }
    }
  }

  const getPatientsByDepartment = (department: Department) => {
    return journeys.filter((j) => j.currentDepartment === department && j.status === "in-progress")
  }

  const getPatientJourney = (visitId: string) => {
    return journeys.find((j) => j.visitId === visitId)
  }

  const addNotification = (notification: Omit<Notification, "id" | "timestamp" | "read">) => {
    const newNotification: Notification = {
      ...notification,
      id: `N${Date.now()}`,
      timestamp: new Date().toISOString(),
      read: false,
    }
    setNotifications([newNotification, ...notifications])
  }

  const markNotificationRead = (id: string) => {
    setNotifications(notifications.map((n) => (n.id === id ? { ...n, read: true } : n)))
  }

  const getUnreadNotifications = (department: Department) => {
    return notifications.filter((n) => n.department === department && !n.read)
  }

  const clearNotifications = (department: Department) => {
    setNotifications(notifications.map((n) => (n.department === department ? { ...n, read: true } : n)))
  }

  return (
    <WorkflowContext.Provider
      value={{
        journeys,
        notifications,
        startPatientJourney,
        routePatient,
        getPatientsByDepartment,
        getPatientJourney,
        addNotification,
        markNotificationRead,
        getUnreadNotifications,
        clearNotifications,
      }}
    >
      {children}
    </WorkflowContext.Provider>
  )
}

export function useWorkflow() {
  const context = useContext(WorkflowContext)
  if (context === undefined) {
    throw new Error("useWorkflow must be used within a WorkflowProvider")
  }
  return context
}
