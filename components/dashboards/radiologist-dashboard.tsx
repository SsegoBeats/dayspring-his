"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  AlertCircle,
  ArrowUpRight,
  BarChart3,
  Clock3,
  Download,
  FileUp,
  FilterX,
  Loader2,
  Scan,
  Settings2,
  ShieldAlert,
  UserPlus2,
  Users2,
} from "lucide-react"
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { RadiologyTestDetails } from "@/components/radiology/radiology-test-details"
import { RadiologyTestQueue } from "@/components/radiology/radiology-test-queue"
import { useAuth } from "@/lib/auth-context"
import { useLab } from "@/lib/lab-context"
import { formatPatientNumber } from "@/lib/patients"
import { usePatients } from "@/lib/patient-context"
import {
  formatStudyPriority,
  normalizeRadiologyStudy,
  type RadiologyStudy,
} from "@/lib/radiology"
import { runExport } from "@/lib/reception-export-utils"
import { useSettings } from "@/lib/settings-context"

type WorklistTab = "active" | "completed" | "all"
type SortOption = "ordered-desc" | "ordered-asc" | "priority" | "age" | "patient"
type DatePreset = "today" | "last7" | "month" | "custom"

function formatDateInput(date: Date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}

function getRangeForPreset(preset: Exclude<DatePreset, "custom">) {
  const today = new Date()
  const end = formatDateInput(today)
  if (preset === "today") return { from: end, to: end }
  if (preset === "last7") {
    const start = new Date(today)
    start.setDate(today.getDate() - 6)
    return { from: formatDateInput(start), to: end }
  }
  const start = new Date(today.getFullYear(), today.getMonth(), 1)
  return { from: formatDateInput(start), to: end }
}

function toIsoStart(date: string) {
  return new Date(`${date}T00:00:00`).toISOString()
}

function toIsoEnd(date: string) {
  return new Date(`${date}T23:59:59.999`).toISOString()
}

function isToday(value?: string | null) {
  if (!value) return false
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return false
  const today = new Date()
  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  )
}

function isOver24Hours(value?: string | null) {
  if (!value) return false
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return false
  return Date.now() - date.getTime() >= 24 * 60 * 60 * 1000
}

function PatientPicker({
  query,
  onQueryChange,
  selectedPatientId,
  onSelectPatient,
  results,
}: {
  query: string
  onQueryChange: (value: string) => void
  selectedPatientId: string
  onSelectPatient: (id: string) => void
  results: Array<{
    id: string
    firstName: string
    lastName: string
    patientNumber?: string
    gender: string
  }>
}) {
  return (
    <div className="space-y-3">
      <Input
        id="rad-patient-search"
        name="patientSearch"
        autoComplete="off"
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        placeholder="Search by patient name, P.ID, or phone"
      />
      <ScrollArea className="h-56 rounded-2xl border border-border/70 bg-muted/20">
        <div className="space-y-2 p-2">
          {results.length > 0 ? (
            results.map((patient) => (
              <button
                key={patient.id}
                type="button"
                onClick={() => onSelectPatient(patient.id)}
                className={`w-full rounded-xl border px-3 py-3 text-left transition ${
                  selectedPatientId === patient.id
                    ? "border-sky-500 bg-sky-50"
                    : "border-border/70 bg-background hover:bg-muted/20"
                }`}
              >
                <div className="font-medium text-foreground">
                  {patient.firstName} {patient.lastName}
                </div>
                <div className="text-xs text-muted-foreground">
                  {formatPatientNumber(patient.patientNumber)} - {patient.gender}
                </div>
              </button>
            ))
          ) : (
            <div className="px-3 py-8 text-center text-sm text-muted-foreground">No matching patients found.</div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}

export function RadiologistDashboard() {
  const { user } = useAuth()
  const { settings, loading: settingsLoading } = useSettings()
  const { tests, loading, refresh, orderTest } = useLab()
  const { patients, refreshPatients, searchPatients } = usePatients()

  const [selectedTestId, setSelectedTestId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<WorklistTab>("active")
  const [modalityFilter, setModalityFilter] = useState<string>("all")
  const [priorityFilter, setPriorityFilter] = useState<string>("all")
  const [assignmentFilter, setAssignmentFilter] = useState<string>("all")
  const [sortBy, setSortBy] = useState<SortOption>("ordered-desc")
  const [searchTerm, setSearchTerm] = useState("")
  const [bulkActionsEnabled, setBulkActionsEnabled] = useState(true)
  const [selectedStudyIds, setSelectedStudyIds] = useState<Set<string>>(new Set())

  const [assignDialogOpen, setAssignDialogOpen] = useState(false)
  const [assignStudyIds, setAssignStudyIds] = useState<string[]>([])
  const [assignRadiologistId, setAssignRadiologistId] = useState("")
  const [assigning, setAssigning] = useState(false)
  const [radiologists, setRadiologists] = useState<Array<{ id: string; name: string }>>([])

  const [bulkStatusOpen, setBulkStatusOpen] = useState(false)
  const [bulkStatusValue, setBulkStatusValue] = useState("In Progress")
  const [bulkStatusStudyIds, setBulkStatusStudyIds] = useState<string[]>([])

  const [addScanOpen, setAddScanOpen] = useState(false)
  const [newStudyPatientQuery, setNewStudyPatientQuery] = useState("")
  const [newStudyPatientId, setNewStudyPatientId] = useState("")
  const [newStudyModality, setNewStudyModality] = useState("X-Ray")
  const [newStudyPriority, setNewStudyPriority] = useState("routine")
  const [newStudyNotes, setNewStudyNotes] = useState("")
  const [creatingStudy, setCreatingStudy] = useState(false)

  const [uploadDialogOpen, setUploadDialogOpen] = useState(false)
  const [uploadPatientQuery, setUploadPatientQuery] = useState("")
  const [uploadPatientId, setUploadPatientId] = useState("")
  const [uploadModality, setUploadModality] = useState("X-Ray")
  const [uploadNotes, setUploadNotes] = useState("")
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)

  const [datePreset, setDatePreset] = useState<DatePreset>("last7")
  const initialRange = getRangeForPreset("last7")
  const [exportFrom, setExportFrom] = useState(initialRange.from)
  const [exportTo, setExportTo] = useState(initialRange.to)
  const [exporting, setExporting] = useState<null | "csv" | "xlsx" | "pdf">(null)

  const worklistRef = useRef<HTMLDivElement | null>(null)
  const analyticsRef = useRef<HTMLDivElement | null>(null)
  const exportRef = useRef<HTMLDivElement | null>(null)
  const studiesRef = useRef<RadiologyStudy[]>([])

  const studies = useMemo(
    () =>
      tests
        .map((test) => normalizeRadiologyStudy(test))
        .filter((study): study is RadiologyStudy => Boolean(study)),
    [tests],
  )

  useEffect(() => {
    studiesRef.current = studies
  }, [studies])

  useEffect(() => {
    if (datePreset === "custom") return
    const nextRange = getRangeForPreset(datePreset)
    setExportFrom(nextRange.from)
    setExportTo(nextRange.to)
  }, [datePreset])

  useEffect(() => {
    void refreshPatients().catch(() => {})
  }, [refreshPatients])

  const selectedPatient = useMemo(
    () => patients.find((patient) => patient.id === newStudyPatientId) || null,
    [newStudyPatientId, patients],
  )
  const uploadPatient = useMemo(
    () => patients.find((patient) => patient.id === uploadPatientId) || null,
    [uploadPatientId, patients],
  )

  const patientResults = useMemo(() => {
    const query = newStudyPatientQuery.trim()
    if (!query) return patients.slice(0, 12)
    return searchPatients(query).slice(0, 12)
  }, [newStudyPatientQuery, patients, searchPatients])

  const uploadPatientResults = useMemo(() => {
    const query = uploadPatientQuery.trim()
    if (!query) return patients.slice(0, 12)
    return searchPatients(query).slice(0, 12)
  }, [uploadPatientQuery, patients, searchPatients])

  const activeStudies = useMemo(
    () => studies.filter((study) => study.status === "pending" || study.status === "in-progress"),
    [studies],
  )
  const completedStudies = useMemo(
    () => studies.filter((study) => study.status === "completed"),
    [studies],
  )
  const overdueStudies = useMemo(() => {
    const thresholdHours = settings?.radiologistWorkflow?.overdueThresholdHours ?? 24
    const thresholdMs = thresholdHours * 60 * 60 * 1000
    return activeStudies.filter((study) => {
      if (!study.orderedAt) return false
      const d = new Date(study.orderedAt)
      return !Number.isNaN(d.getTime()) && Date.now() - d.getTime() >= thresholdMs
    })
  }, [activeStudies, settings?.radiologistWorkflow?.overdueThresholdHours])
  const myAssignedStudies = useMemo(
    () => activeStudies.filter((study) => study.assignedToId === user?.id),
    [activeStudies, user?.id],
  )
  const orderedToday = useMemo(() => studies.filter((study) => isToday(study.orderedAt)).length, [studies])
  const completedToday = useMemo(
    () => completedStudies.filter((study) => isToday(study.completedAt)).length,
    [completedStudies],
  )

  const completionRate = useMemo(() => {
    if (studies.length === 0) return null
    return Math.round((completedStudies.length / studies.length) * 100)
  }, [studies.length, completedStudies.length])

  const avgTurnaroundHours = useMemo(() => {
    const withTat = completedStudies.filter(
      (study) => study.completedAt && study.orderedAt,
    )
    if (withTat.length === 0) return null
    const total = withTat.reduce((sum, study) => {
      const diff = new Date(study.completedAt!).getTime() - new Date(study.orderedAt).getTime()
      return sum + diff / (1000 * 60 * 60)
    }, 0)
    return Math.round((total / withTat.length) * 10) / 10
  }, [completedStudies])

  const baseFilteredStudies = useMemo(() => {
    return studies.filter((study) => {
      if (modalityFilter !== "all" && study.testName !== modalityFilter) return false
      if (priorityFilter !== "all" && study.priority !== priorityFilter) return false
      if (assignmentFilter === "mine" && study.assignedToId !== user?.id) return false
      if (assignmentFilter === "unassigned" && study.assignedToId) return false
      if (searchTerm.trim()) {
        const query = searchTerm.trim().toLowerCase()
        const haystack = [
          study.patientName,
          study.patientNumber,
          study.patientId,
          study.testName,
          study.accessionNumber,
          study.id,
          study.orderedBy,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
        if (!haystack.includes(query)) return false
      }
      return true
    })
  }, [assignmentFilter, modalityFilter, priorityFilter, searchTerm, studies, user?.id])

  const filteredStudies = useMemo(() => {
    if (activeTab === "active") {
      return baseFilteredStudies.filter((study) => study.status === "pending" || study.status === "in-progress")
    }
    if (activeTab === "completed") {
      return baseFilteredStudies.filter((study) => study.status === "completed")
    }
    return baseFilteredStudies
  }, [activeTab, baseFilteredStudies])

  const modalityData = useMemo(() => {
    const counts = new Map<string, number>()
    studies.forEach((study) => counts.set(study.testName, (counts.get(study.testName) || 0) + 1))
    return Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
  }, [studies])

  const assigneeData = useMemo(() => {
    const counts = new Map<string, number>()
    activeStudies.forEach((study) => {
      const key = study.assignedToName || "Unassigned"
      counts.set(key, (counts.get(key) || 0) + 1)
    })
    return Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
  }, [activeStudies])

  useEffect(() => {
    setSelectedStudyIds(new Set())
  }, [activeTab, assignmentFilter, modalityFilter, priorityFilter, searchTerm, sortBy])

  const ensureRadiologistsLoaded = useCallback(async () => {
    if (radiologists.length > 0) return
    try {
      const res = await fetch("/api/users/radiologists", { credentials: "include" })
      if (!res.ok) return
      const data = await res.json().catch(() => ({}))
      const rows = Array.isArray(data.radiologists) ? data.radiologists : []
      setRadiologists(rows.map((row: any) => ({ id: row.id, name: row.name })))
    } catch {
      setRadiologists([])
    }
  }, [radiologists.length])

  const openAssignDialog = useCallback(
    (studyIds?: string[]) => {
      const ids = studyIds && studyIds.length > 0 ? studyIds : Array.from(selectedStudyIds)
      const fallbackIds = ids.length > 0 ? ids : activeStudies.slice(0, 1).map((study) => study.id)
      setAssignStudyIds(fallbackIds)
      if (user?.id) setAssignRadiologistId(user.id)
      void ensureRadiologistsLoaded()
      setAssignDialogOpen(true)
    },
    [activeStudies, ensureRadiologistsLoaded, selectedStudyIds, user?.id],
  )

  const patchStudy = useCallback(async (studyId: string, payload: Record<string, unknown>) => {
    const res = await fetch(`/api/lab-tests/${studyId}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    const data = await res.json().catch(() => ({}))
    return { ok: res.ok, error: data?.error || "Failed to update study" }
  }, [])

  const handleAssign = async () => {
    if (assignStudyIds.length === 0 || !assignRadiologistId || assigning) return
    setAssigning(true)
    try {
      const results = await Promise.all(
        assignStudyIds.map((studyId) => patchStudy(studyId, { assignedRadiologistId: assignRadiologistId })),
      )
      const failed = results.filter((result) => !result.ok)
      if (failed.length > 0) {
        toast.error(`Failed to assign ${failed.length} case(s)`)
      } else {
        toast.success(`Assigned ${assignStudyIds.length} case(s)`)
      }
      await refresh()
      setAssignDialogOpen(false)
      setAssignStudyIds([])
      setSelectedStudyIds(new Set())
    } finally {
      setAssigning(false)
    }
  }

  const handleBulkStatusUpdate = async () => {
    if (bulkStatusStudyIds.length === 0) return
    setAssigning(true)
    try {
      const results = await Promise.all(
        bulkStatusStudyIds.map((studyId) => patchStudy(studyId, { status: bulkStatusValue })),
      )
      const failed = results.filter((result) => !result.ok)
      if (failed.length > 0) {
        toast.error(`Failed to update ${failed.length} case(s)`)
      } else {
        toast.success(`Updated ${bulkStatusStudyIds.length} case(s)`)
      }
      await refresh()
      setBulkStatusOpen(false)
      setBulkStatusStudyIds([])
      setSelectedStudyIds(new Set())
    } finally {
      setAssigning(false)
    }
  }

  const handleCreateStudy = async () => {
    if (!newStudyPatientId || creatingStudy) return
    setCreatingStudy(true)
    try {
      const priority =
        newStudyPriority === "stat" ? "Stat" : newStudyPriority === "urgent" ? "Urgent" : "Routine"
      const created = await orderTest({
        patientId: newStudyPatientId,
        testName: newStudyModality,
        testType: "Radiology",
        priority,
        specimenType: "Imaging",
        notes: newStudyNotes.trim() || undefined,
      })
      if (!created || created.ids.length === 0) {
        toast.error("Failed to create scan request")
        return
      }
      await refresh()
      setAddScanOpen(false)
      setNewStudyPatientQuery("")
      setNewStudyPatientId("")
      setNewStudyModality("X-Ray")
      setNewStudyPriority("routine")
      setNewStudyNotes("")
      setSelectedTestId(created.ids[0])
      toast.success("Radiology study created")
    } catch {
      toast.error("Failed to create scan request")
    } finally {
      setCreatingStudy(false)
    }
  }

  const handleManualUpload = async () => {
    if (!uploadPatientId || !uploadFile || uploading) return
    setUploading(true)
    try {
      const form = new FormData()
      form.append("file", uploadFile)
      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        credentials: "include",
        body: form,
      })
      const uploadData = await uploadRes.json().catch(() => ({}))
      if (!uploadRes.ok || !uploadData?.url) {
        throw new Error(uploadData?.error || "Upload failed")
      }
      const attachmentNotes = [`Study Type: ${uploadModality}`, uploadNotes.trim()].filter(Boolean).join("\n")

      const docRes = await fetch("/api/documents", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: uploadPatientId,
          type: "OTHER",
          fileUrl: uploadData.url,
          notes: attachmentNotes || undefined,
          fileName: `${uploadModality} - ${uploadData.originalName || uploadFile.name}`,
          mimeType: uploadData.mimeType || uploadFile.type || undefined,
        }),
      })
      const docData = await docRes.json().catch(() => ({}))
      if (!docRes.ok) {
        throw new Error(docData?.error || "Failed to link upload to patient")
      }

      setUploadDialogOpen(false)
      setUploadPatientQuery("")
      setUploadPatientId("")
      setUploadModality("X-Ray")
      setUploadNotes("")
      setUploadFile(null)
      toast.success(`${uploadModality} attachment uploaded and linked to ${uploadPatient?.firstName || "patient"} ${uploadPatient?.lastName || ""}`.trim())
    } catch (error: any) {
      toast.error(error?.message || "Upload failed")
    } finally {
      setUploading(false)
    }
  }

  const handleExport = async (format: "csv" | "xlsx" | "pdf") => {
    if (exporting || !exportFrom || !exportTo) return
    setExporting(format)
    try {
      const statuses =
        activeTab === "active"
          ? ["pending", "in-progress"]
          : activeTab === "completed"
            ? ["completed"]
            : undefined
      const filters: Record<string, unknown> = {
        from: toIsoStart(exportFrom),
        to: toIsoEnd(exportTo),
      }
      if (statuses) filters.statuses = statuses
      if (modalityFilter !== "all") filters.modality = modalityFilter
      if (assignmentFilter === "mine" && user?.id) filters.assignedRadiologistId = user.id
      if (assignmentFilter === "unassigned") filters.assignmentScope = "unassigned"
      if (searchTerm.trim()) filters.q = searchTerm.trim()

      const filename = `radiology-worklist-${exportFrom}-to-${exportTo}.${format}`
      await runExport(
        {
          dataset: "radiology_lab_tests",
          format,
          filters,
        },
        filename,
        {
          onError: (message) => toast.error(message),
          onSuccess: (name) => toast.success(`Exported ${name}`),
        },
      )
    } finally {
      setExporting(null)
    }
  }

  const handleOpenRadiologyStudy = useCallback(async (detail: any) => {
    if (!detail) return
    if (detail.notificationId) {
      try {
        await fetch("/api/notifications", {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: [detail.notificationId] }),
        })
      } catch {}
    }

    if (detail.testId) {
      setSelectedTestId(String(detail.testId))
      return
    }

    if (detail.patientId) {
      const match = studiesRef.current.find((study) => study.patientId === detail.patientId)
      if (match) {
        setSelectedTestId(match.id)
      } else {
        worklistRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
      }
    }
  }, [])

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail || {}
      void handleOpenRadiologyStudy(detail)
    }
    window.addEventListener("openRadiologyStudy", handler as EventListener)
    return () => window.removeEventListener("openRadiologyStudy", handler as EventListener)
  }, [handleOpenRadiologyStudy])

  useEffect(() => {
    if (settingsLoading || selectedTestId) return
    if (settings?.defaultDashboard === "radiology-worklist") {
      worklistRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
      return
    }
    if (settings?.defaultDashboard === "radiology-analytics") {
      analyticsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
      return
    }
    if (settings?.defaultDashboard === "radiology-exports") {
      exportRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  }, [selectedTestId, settings?.defaultDashboard, settingsLoading])

  if (selectedTestId) {
    return (
      <RadiologyTestDetails
        testId={selectedTestId}
        onBack={() => setSelectedTestId(null)}
        onSelectTest={setSelectedTestId}
      />
    )
  }

  const quickActions = [
    {
      label: "Open worklist",
      description: "Jump straight into the active reporting queue.",
      onClick: () => worklistRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
      icon: Scan,
    },
    {
      label: "Review analytics",
      description: "Check modality mix, assignment load, and overdue pressure.",
      onClick: () => analyticsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
      icon: BarChart3,
    },
    {
      label: "Portal settings",
      description: "Adjust radiologist-specific defaults and alerts.",
      href: "/radiologist/settings",
      icon: Settings2,
    },
  ] as const

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[28px] border border-sky-200/40 bg-[linear-gradient(145deg,#062032_0%,#0a4a5e_35%,#0f766e_70%,#0d4f4a_100%)] px-6 py-8 text-white shadow-[0_32px_90px_-28px_rgba(6,32,50,0.9)] md:px-10">
        <div className="pointer-events-none absolute -left-16 top-8 h-52 w-52 rounded-full bg-teal-400/15 blur-3xl" />
        <div className="pointer-events-none absolute -right-8 -top-8 h-64 w-64 rounded-full bg-sky-300/10 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 left-1/3 h-32 w-96 rounded-full bg-emerald-500/10 blur-2xl" />
        <div className="relative grid gap-6 lg:grid-cols-[1.7fr_1fr]">
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.28em] text-sky-100">
                <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                Radiology Command Desk
              </div>
              {overdueStudies.length > 0 && (
                <div className="inline-flex items-center gap-1.5 rounded-full border border-red-400/40 bg-red-500/20 px-2.5 py-1 text-xs font-semibold text-red-200">
                  <ShieldAlert className="h-3 w-3" />
                  {overdueStudies.length} overdue
                </div>
              )}
            </div>
            <div className="space-y-3">
              <h2 className="max-w-3xl text-3xl font-semibold tracking-tight md:text-4xl">
                Read faster. Report cleanly. Close every study before the queue backs up.
              </h2>
              <p className="max-w-2xl text-sm text-sky-100/80 md:text-base">
                Live worklist, real assignment ownership, structured report templates, notification handoff to ordering clinicians, and one-click workload exports.
              </p>
            </div>
            <div className="flex flex-wrap gap-4 rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm">
              <span className="text-sky-200/70">Today:</span>
              <span className="font-semibold text-white">{orderedToday} ordered</span>
              <span className="text-white/30">·</span>
              <span className="font-semibold text-emerald-300">{completedToday} completed</span>
              {completionRate !== null && (
                <>
                  <span className="text-white/30">·</span>
                  <span className="font-semibold text-teal-300">{completionRate}% overall completion</span>
                </>
              )}
              {avgTurnaroundHours !== null && (
                <>
                  <span className="text-white/30">·</span>
                  <span className="font-semibold text-indigo-300">{avgTurnaroundHours}h avg TAT</span>
                </>
              )}
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {quickActions.map((action) => {
                const Icon = action.icon
                if ("href" in action) {
                  return (
                    <Link
                      key={action.label}
                      href={action.href}
                      className="group rounded-2xl border border-white/15 bg-white/10 p-4 transition hover:bg-white/15"
                    >
                      <div className="mb-3 flex items-center justify-between">
                        <Icon className="h-5 w-5 text-sky-100" />
                        <ArrowUpRight className="h-4 w-4 text-sky-50/80 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                      </div>
                      <div className="text-sm font-medium">{action.label}</div>
                      <p className="mt-1 text-xs text-sky-100/80">{action.description}</p>
                    </Link>
                  )
                }

                return (
                  <button
                    key={action.label}
                    type="button"
                    onClick={action.onClick}
                    className="group rounded-2xl border border-white/15 bg-white/10 p-4 text-left transition hover:bg-white/15"
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <Icon className="h-5 w-5 text-sky-100" />
                      <ArrowUpRight className="h-4 w-4 text-sky-50/80 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                    </div>
                    <div className="text-sm font-medium">{action.label}</div>
                    <p className="mt-1 text-xs text-sky-100/80">{action.description}</p>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <button
              type="button"
              onClick={() => setAddScanOpen(true)}
              className="rounded-2xl border border-white/15 bg-white/10 p-4 text-left transition hover:bg-white/15"
            >
              <div className="mb-3 inline-flex rounded-full bg-white/15 p-2">
                <UserPlus2 className="h-5 w-5 text-white" />
              </div>
              <div className="text-sm font-semibold">Create Study</div>
              <p className="mt-1 text-xs text-sky-100/80">Order a new radiology study for a known patient using the real patient record.</p>
            </button>
            <button
              type="button"
              onClick={() => setUploadDialogOpen(true)}
              className="rounded-2xl border border-white/15 bg-white/10 p-4 text-left transition hover:bg-white/15"
            >
              <div className="mb-3 inline-flex rounded-full bg-white/15 p-2">
                <FileUp className="h-5 w-5 text-white" />
              </div>
              <div className="text-sm font-semibold">Upload External Imaging</div>
              <p className="mt-1 text-xs text-sky-100/80">Attach outside images to the shared patient document record.</p>
            </button>
            <button
              type="button"
              onClick={() => openAssignDialog()}
              className="rounded-2xl border border-white/15 bg-white/10 p-4 text-left transition hover:bg-white/15"
            >
              <div className="mb-3 inline-flex rounded-full bg-white/15 p-2">
                <Users2 className="h-5 w-5 text-white" />
              </div>
              <div className="text-sm font-semibold">Assign Cases</div>
              <p className="mt-1 text-xs text-sky-100/80">Push selected studies to the right radiologist and sync workload ownership.</p>
            </button>
            <button
              type="button"
              onClick={() => exportRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
              className="rounded-2xl border border-white/15 bg-white/10 p-4 text-left transition hover:bg-white/15"
            >
              <div className="mb-3 inline-flex rounded-full bg-white/15 p-2">
                <Download className="h-5 w-5 text-white" />
              </div>
              <div className="text-sm font-semibold">Export Worklist</div>
              <p className="mt-1 text-xs text-sky-100/80">Download the current workload slice as CSV, Excel, or PDF.</p>
            </button>
          </div>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4 xl:grid-cols-7">
        <Card className="border-amber-100 bg-amber-50/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-[0.18em] text-amber-700">Active Queue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{activeStudies.length}</div>
            <p className="text-xs text-amber-900/80">Pending and in-progress studies needing action.</p>
          </CardContent>
        </Card>
        <Card className="border-sky-100 bg-sky-50/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-[0.18em] text-sky-700">Ordered Today</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{orderedToday}</div>
            <p className="text-xs text-sky-900/80">New studies entering the queue today.</p>
          </CardContent>
        </Card>
        <Card className="border-emerald-100 bg-emerald-50/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-[0.18em] text-emerald-700">Completed Today</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{completedToday}</div>
            <p className="text-xs text-emerald-900/80">Reports submitted back to ordering teams today.</p>
          </CardContent>
        </Card>
        <Card className="border-rose-100 bg-rose-50/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-[0.18em] text-rose-700">Over {settings?.radiologistWorkflow?.overdueThresholdHours ?? 24}h</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{overdueStudies.length}</div>
            <p className="text-xs text-rose-900/80">Studies breaching the {settings?.radiologistWorkflow?.overdueThresholdHours ?? 24}-hour turnaround threshold.</p>
          </CardContent>
        </Card>
        <Card className="border-violet-100 bg-violet-50/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-[0.18em] text-violet-700">My Queue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{myAssignedStudies.length}</div>
            <p className="text-xs text-violet-900/80">Active studies currently assigned to you.</p>
          </CardContent>
        </Card>
        <Card className="border-teal-100 bg-teal-50/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-[0.18em] text-teal-700">Completion Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">
              {completionRate !== null ? `${completionRate}%` : "—"}
            </div>
            <p className="text-xs text-teal-900/80">Share of all studies with a submitted report.</p>
          </CardContent>
        </Card>
        <Card className="border-indigo-100 bg-indigo-50/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-[0.18em] text-indigo-700">Avg Turnaround</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">
              {avgTurnaroundHours !== null ? `${avgTurnaroundHours}h` : "—"}
            </div>
            <p className="text-xs text-indigo-900/80">Mean hours from order to completed report.</p>
          </CardContent>
        </Card>
      </div>

      <div ref={worklistRef} className="grid gap-4 xl:grid-cols-[1.65fr_0.95fr]">
        <Card className="border-border/70 shadow-sm">
          <CardHeader className="border-b border-border/60">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <CardTitle className="text-xl">Radiology Worklist</CardTitle>
                  <CardDescription>Buttons and notifications now open the exact study instead of dropping you into a broken state.</CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant={bulkActionsEnabled ? "default" : "outline"} size="sm" onClick={() => setBulkActionsEnabled((value) => !value)}>
                    {bulkActionsEnabled ? "Bulk actions on" : "Bulk actions off"}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => void refresh()}>
                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Clock3 className="mr-2 h-4 w-4" />}
                    Refresh
                  </Button>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                <Select value={modalityFilter} onValueChange={setModalityFilter}>
                  <SelectTrigger><SelectValue placeholder="Modality" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All modalities</SelectItem>
                    <SelectItem value="X-Ray">X-Ray</SelectItem>
                    <SelectItem value="CT Scan">CT Scan</SelectItem>
                    <SelectItem value="MRI">MRI</SelectItem>
                    <SelectItem value="Ultrasound">Ultrasound</SelectItem>
                    <SelectItem value="Mammography">Mammography</SelectItem>
                    <SelectItem value="Fluoroscopy">Fluoroscopy</SelectItem>
                    <SelectItem value="Nuclear Medicine">Nuclear Medicine</SelectItem>
                    <SelectItem value="PET Scan">PET Scan</SelectItem>
                    <SelectItem value="Angiography">Angiography</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                  <SelectTrigger><SelectValue placeholder="Priority" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All priorities</SelectItem>
                    <SelectItem value="stat">STAT</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                    <SelectItem value="routine">Routine</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={assignmentFilter} onValueChange={setAssignmentFilter}>
                  <SelectTrigger><SelectValue placeholder="Assignment" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All ownership</SelectItem>
                    <SelectItem value="mine">Assigned to me</SelectItem>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortOption)}>
                  <SelectTrigger><SelectValue placeholder="Sort" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ordered-desc">Newest first</SelectItem>
                    <SelectItem value="ordered-asc">Oldest first</SelectItem>
                    <SelectItem value="priority">Priority</SelectItem>
                    <SelectItem value="age">Oldest age first</SelectItem>
                    <SelectItem value="patient">Patient name</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  id="rad-study-search"
                  name="studySearch"
                  autoComplete="off"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search patient, P.ID, study, accession"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setModalityFilter("all")
                    setPriorityFilter("all")
                    setAssignmentFilter("all")
                    setSortBy("ordered-desc")
                    setSearchTerm("")
                  }}
                >
                  <FilterX className="mr-2 h-4 w-4" />
                  Clear Filters
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const ids = Array.from(selectedStudyIds)
                    if (ids.length === 0) {
                      toast.error("Select at least one study first")
                      return
                    }
                    openAssignDialog(ids)
                  }}
                >
                  Assign Selected
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const ids = Array.from(selectedStudyIds)
                    if (ids.length === 0) {
                      toast.error("Select at least one study first")
                      return
                    }
                    setBulkStatusStudyIds(ids)
                    setBulkStatusOpen(true)
                  }}
                >
                  Update Selected Status
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <Tabs
              value={activeTab}
              onValueChange={(value) => setActiveTab(value as WorklistTab)}
              className="space-y-4"
            >
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="active">Active ({baseFilteredStudies.filter((study) => study.status === "pending" || study.status === "in-progress").length})</TabsTrigger>
                <TabsTrigger value="completed">Completed ({baseFilteredStudies.filter((study) => study.status === "completed").length})</TabsTrigger>
                <TabsTrigger value="all">All ({baseFilteredStudies.length})</TabsTrigger>
              </TabsList>

              <TabsContent value="active">
                <RadiologyTestQueue
                  tests={filteredStudies}
                  onSelectTest={setSelectedTestId}
                  emptyMessage="No active radiology studies match the current filters."
                  sortBy={sortBy}
                  selectedTests={selectedStudyIds}
                  onToggleTest={(id) => {
                    setSelectedStudyIds((prev) => {
                      const next = new Set(prev)
                      if (next.has(id)) next.delete(id)
                      else next.add(id)
                      return next
                    })
                  }}
                  onSelectAll={() => setSelectedStudyIds(new Set(filteredStudies.map((study) => study.id)))}
                  onDeselectAll={() => setSelectedStudyIds(new Set())}
                  showBulkActions={bulkActionsEnabled}
                  onBulkAssign={(ids) => openAssignDialog(ids)}
                  onBulkUpdateStatus={(ids) => {
                    setBulkStatusStudyIds(ids)
                    setBulkStatusOpen(true)
                  }}
                />
              </TabsContent>

              <TabsContent value="completed">
                <RadiologyTestQueue
                  tests={filteredStudies}
                  onSelectTest={setSelectedTestId}
                  emptyMessage="No completed radiology studies are visible in this slice."
                  sortBy={sortBy}
                  selectedTests={selectedStudyIds}
                  onToggleTest={(id) => {
                    setSelectedStudyIds((prev) => {
                      const next = new Set(prev)
                      if (next.has(id)) next.delete(id)
                      else next.add(id)
                      return next
                    })
                  }}
                  onSelectAll={() => setSelectedStudyIds(new Set(filteredStudies.map((study) => study.id)))}
                  onDeselectAll={() => setSelectedStudyIds(new Set())}
                  showBulkActions={bulkActionsEnabled}
                />
              </TabsContent>

              <TabsContent value="all">
                <RadiologyTestQueue
                  tests={filteredStudies}
                  onSelectTest={setSelectedTestId}
                  emptyMessage="No radiology studies match your current filters."
                  sortBy={sortBy}
                  selectedTests={selectedStudyIds}
                  onToggleTest={(id) => {
                    setSelectedStudyIds((prev) => {
                      const next = new Set(prev)
                      if (next.has(id)) next.delete(id)
                      else next.add(id)
                      return next
                    })
                  }}
                  onSelectAll={() => setSelectedStudyIds(new Set(filteredStudies.map((study) => study.id)))}
                  onDeselectAll={() => setSelectedStudyIds(new Set())}
                  showBulkActions={bulkActionsEnabled}
                  onBulkAssign={(ids) => openAssignDialog(ids)}
                  onBulkUpdateStatus={(ids) => {
                    setBulkStatusStudyIds(ids)
                    setBulkStatusOpen(true)
                  }}
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <div ref={analyticsRef} className="space-y-4">
          <Card className="border-border/70 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Studies by Modality</CardTitle>
              <CardDescription>Volume split across current radiology modalities.</CardDescription>
            </CardHeader>
            <CardContent className="h-64 pt-0">
              {modalityData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={modalityData}>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis dataKey="name" tickLine={false} axisLine={false} />
                    <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                    <Tooltip cursor={{ fill: "rgba(148,163,184,0.08)" }} />
                    <Bar dataKey="count" fill="#0f766e" radius={6} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No radiology studies available yet.</div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/70 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Assignment Load</CardTitle>
              <CardDescription>Who currently owns active studies in the queue.</CardDescription>
            </CardHeader>
            <CardContent className="h-64 pt-0">
              {assigneeData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={assigneeData} layout="vertical" margin={{ left: 12 }}>
                    <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                    <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} />
                    <YAxis type="category" dataKey="name" width={90} tickLine={false} axisLine={false} />
                    <Tooltip cursor={{ fill: "rgba(148,163,184,0.08)" }} />
                    <Bar dataKey="count" fill="#0369a1" radius={6} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No active assignment data yet.</div>
              )}
            </CardContent>
          </Card>

          <div ref={exportRef}>
            <Card className="border-border/70 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">Exports</CardTitle>
                <CardDescription>Exports use the real radiology worklist dataset and current queue filters.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <Select value={datePreset} onValueChange={(value) => setDatePreset(value as DatePreset)}>
                    <SelectTrigger><SelectValue placeholder="Range" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="today">Today</SelectItem>
                      <SelectItem value="last7">Last 7 days</SelectItem>
                      <SelectItem value="month">This month</SelectItem>
                      <SelectItem value="custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input id="rad-export-from" name="exportFrom" type="date" aria-label="Export from date" value={exportFrom} onChange={(event) => { setDatePreset("custom"); setExportFrom(event.target.value) }} />
                  <Input id="rad-export-to" name="exportTo" type="date" aria-label="Export to date" value={exportTo} onChange={(event) => { setDatePreset("custom"); setExportTo(event.target.value) }} />
                </div>
                <p className="text-xs text-muted-foreground">
                  Current filters included: {modalityFilter !== "all" ? modalityFilter : "all modalities"} /{" "}
                  {priorityFilter !== "all" ? formatStudyPriority(priorityFilter as any) : "all priorities"} /{" "}
                  {assignmentFilter === "mine" ? "assigned to me" : assignmentFilter === "unassigned" ? "unassigned only" : "all ownership"}.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" disabled={!!exporting} onClick={() => void handleExport("csv")}>
                    {exporting === "csv" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                    CSV
                  </Button>
                  <Button variant="outline" size="sm" disabled={!!exporting} onClick={() => void handleExport("xlsx")}>
                    {exporting === "xlsx" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                    Excel
                  </Button>
                  <Button variant="outline" size="sm" disabled={!!exporting} onClick={() => void handleExport("pdf")}>
                    {exporting === "pdf" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                    PDF
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="border-border/70 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Cross-Portal Integrity</CardTitle>
              <CardDescription>What is now flowing correctly with the rest of the system.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <div className="flex items-start gap-3">
                <ShieldAlert className="mt-0.5 h-4 w-4 text-sky-600" />
                <p>Radiology study orders from clinicians, dentists, and midwives now land in the live worklist and notification flow.</p>
              </div>
              <div className="flex items-start gap-3">
                <Users2 className="mt-0.5 h-4 w-4 text-sky-600" />
                <p>Assignments update the shared study record so workload reflects consistently for radiologists and ordering teams.</p>
              </div>
              <div className="flex items-start gap-3">
                <AlertCircle className="mt-0.5 h-4 w-4 text-sky-600" />
                <p>Settings remain user-scoped. Radiologist home defaults can be personalized without changing the portal for everyone else.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={addScanOpen} onOpenChange={setAddScanOpen}>
        <DialogContent size="xl">
          <DialogHeader>
            <DialogTitle>Create Radiology Study</DialogTitle>
            <DialogDescription>
              Order a new study against the actual patient record so it appears immediately across connected portals.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
            <PatientPicker
              query={newStudyPatientQuery}
              onQueryChange={setNewStudyPatientQuery}
              selectedPatientId={newStudyPatientId}
              onSelectPatient={setNewStudyPatientId}
              results={patientResults}
            />
            <div className="space-y-4">
              <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Selected Patient</p>
                <p className="mt-2 text-base font-semibold text-foreground">
                  {selectedPatient ? `${selectedPatient.firstName} ${selectedPatient.lastName}` : "No patient selected"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {selectedPatient ? formatPatientNumber(selectedPatient.patientNumber) : "Choose a patient from the list"}
                </p>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="new-study-modality">Modality</Label>
                  <Select value={newStudyModality} onValueChange={setNewStudyModality}>
                    <SelectTrigger id="new-study-modality"><SelectValue placeholder="Select modality" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="X-Ray">X-Ray</SelectItem>
                      <SelectItem value="CT Scan">CT Scan</SelectItem>
                      <SelectItem value="MRI">MRI</SelectItem>
                      <SelectItem value="Ultrasound">Ultrasound</SelectItem>
                      <SelectItem value="Mammography">Mammography</SelectItem>
                      <SelectItem value="Fluoroscopy">Fluoroscopy</SelectItem>
                      <SelectItem value="Nuclear Medicine">Nuclear Medicine</SelectItem>
                      <SelectItem value="PET Scan">PET Scan</SelectItem>
                      <SelectItem value="Angiography">Angiography</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-study-priority">Priority</Label>
                  <Select value={newStudyPriority} onValueChange={setNewStudyPriority}>
                    <SelectTrigger id="new-study-priority"><SelectValue placeholder="Select priority" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="routine">Routine</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                      <SelectItem value="stat">STAT</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-study-notes">Clinical Notes</Label>
                <Textarea
                  id="new-study-notes"
                  value={newStudyNotes}
                  onChange={(event) => setNewStudyNotes(event.target.value)}
                  placeholder="Clinical indication, relevant findings, or reason for imaging."
                  rows={5}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setAddScanOpen(false)}>Cancel</Button>
                <Button onClick={() => void handleCreateStudy()} disabled={!newStudyPatientId || creatingStudy}>
                  {creatingStudy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus2 className="mr-2 h-4 w-4" />}
                  Create Study
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent size="xl">
          <DialogHeader>
            <DialogTitle>Upload External Imaging</DialogTitle>
            <DialogDescription>
              Attach outside images to the patient document record. These uploads can then be reviewed from the study detail view and other document-aware portals.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
            <PatientPicker
              query={uploadPatientQuery}
              onQueryChange={setUploadPatientQuery}
              selectedPatientId={uploadPatientId}
              onSelectPatient={setUploadPatientId}
              results={uploadPatientResults}
            />
            <div className="space-y-4">
              <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Selected Patient</p>
                <p className="mt-2 text-base font-semibold text-foreground">
                  {uploadPatient ? `${uploadPatient.firstName} ${uploadPatient.lastName}` : "No patient selected"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {uploadPatient ? formatPatientNumber(uploadPatient.patientNumber) : "Choose a patient from the list"}
                </p>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="upload-study-type">Study Type</Label>
                  <Select value={uploadModality} onValueChange={setUploadModality}>
                    <SelectTrigger id="upload-study-type"><SelectValue placeholder="Select study type" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="X-Ray">X-Ray</SelectItem>
                      <SelectItem value="CT Scan">CT Scan</SelectItem>
                      <SelectItem value="MRI">MRI</SelectItem>
                      <SelectItem value="Ultrasound">Ultrasound</SelectItem>
                      <SelectItem value="Mammography">Mammography</SelectItem>
                      <SelectItem value="Fluoroscopy">Fluoroscopy</SelectItem>
                      <SelectItem value="Nuclear Medicine">Nuclear Medicine</SelectItem>
                      <SelectItem value="PET Scan">PET Scan</SelectItem>
                      <SelectItem value="Angiography">Angiography</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="upload-study-file">Attachment File</Label>
                  <Input
                    id="upload-study-file"
                    type="file"
                    accept="image/*,.pdf,.dcm,.dicom,.zip,application/pdf,application/dicom,application/dicom+json,application/zip"
                    onChange={(event) => setUploadFile(event.target.files?.[0] || null)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="upload-notes">Notes</Label>
                <Textarea
                  id="upload-notes"
                  value={uploadNotes}
                  onChange={(event) => setUploadNotes(event.target.value)}
                  placeholder="Optional context for the uploaded imaging study."
                  rows={5}
                />
              </div>
              <div className="rounded-2xl border border-dashed border-border/70 bg-muted/10 p-3 text-xs text-muted-foreground">
                Manual uploads attach to the shared patient document record. Images preview in the study view, while PDFs and DICOM-style files stay available for open and download.
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setUploadDialogOpen(false)}>Cancel</Button>
                <Button onClick={() => void handleManualUpload()} disabled={!uploadPatientId || !uploadFile || uploading}>
                  {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileUp className="mr-2 h-4 w-4" />}
                  Upload Imaging
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Study</DialogTitle>
            <DialogDescription>
              Assign one or more studies to a radiologist. This updates the shared study record and workload cards immediately.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-2xl border border-border/70 bg-muted/20 p-4 text-sm text-muted-foreground">
              {assignStudyIds.length} selected case{assignStudyIds.length === 1 ? "" : "s"}
            </div>
            <div className="space-y-2">
              <Label htmlFor="assign-radiologist">Assign To</Label>
              <Select value={assignRadiologistId} onValueChange={setAssignRadiologistId}>
                <SelectTrigger id="assign-radiologist"><SelectValue placeholder="Select radiologist" /></SelectTrigger>
                <SelectContent>
                  {user?.id ? <SelectItem value={user.id}>Me ({user.name})</SelectItem> : null}
                  {radiologists
                    .filter((radiologist) => radiologist.id !== user?.id)
                    .map((radiologist) => (
                      <SelectItem key={radiologist.id} value={radiologist.id}>
                        {radiologist.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>Cancel</Button>
              <Button onClick={() => void handleAssign()} disabled={!assignRadiologistId || assignStudyIds.length === 0 || assigning}>
                {assigning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Assign Cases
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkStatusOpen} onOpenChange={setBulkStatusOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bulk Status Update</DialogTitle>
            <DialogDescription>Update the selected studies to the new workflow state.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-2xl border border-border/70 bg-muted/20 p-4 text-sm text-muted-foreground">
              {bulkStatusStudyIds.length} selected case{bulkStatusStudyIds.length === 1 ? "" : "s"}
            </div>
            <div className="space-y-2">
              <Label htmlFor="bulk-status-value">New Status</Label>
              <Select value={bulkStatusValue} onValueChange={setBulkStatusValue}>
                <SelectTrigger id="bulk-status-value"><SelectValue placeholder="Select status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Pending">Pending</SelectItem>
                  <SelectItem value="In Progress">In Progress</SelectItem>
                  <SelectItem value="Completed">Completed</SelectItem>
                  <SelectItem value="Cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setBulkStatusOpen(false)}>Cancel</Button>
              <Button onClick={() => void handleBulkStatusUpdate()} disabled={bulkStatusStudyIds.length === 0 || assigning}>
                {assigning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Apply Status
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

