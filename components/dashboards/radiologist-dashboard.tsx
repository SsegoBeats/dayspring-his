"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { useMedical } from "@/lib/medical-context"
import { useAuth } from "@/lib/auth-context"
import { useLab } from "@/lib/lab-context"
import { RadiologyTestQueue } from "@/components/radiology/radiology-test-queue"
import { RadiologyTestDetails } from "@/components/radiology/radiology-test-details"
import { Scan, Clock, CheckCircle, XCircle, BarChart3, Info, Download } from "lucide-react"
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { toast } from "sonner"
import { runExport } from "@/lib/reception-export-utils"

export function RadiologistDashboard() {
  const { labResults, addMedicalDocument, refreshMedicalData } = useMedical()
  const { user } = useAuth()
  const { orderTest } = useLab()
  const [selectedTestId, setSelectedTestId] = useState<string | null>(null)
  const [modalityFilter, setModalityFilter] = useState<string>("all")
  const [priorityFilter, setPriorityFilter] = useState<string>("all")
  const [assignmentFilter, setAssignmentFilter] = useState<string>("all") // "all" | "my-cases" | "unassigned"
  const [sortBy, setSortBy] = useState<string>("date-desc") // "date-desc" | "date-asc" | "priority" | "age" | "patient"
  const [searchTerm, setSearchTerm] = useState<string>("")

  const [addScanOpen, setAddScanOpen] = useState(false)
  const [uploadInfoOpen, setUploadInfoOpen] = useState(false)
  const [assignInfoOpen, setAssignInfoOpen] = useState(false)
  const [assigning, setAssigning] = useState(false)
  const [assignStudyId, setAssignStudyId] = useState<string>("")
  const [assignStudyIds, setAssignStudyIds] = useState<string[]>([]) // For bulk assign
  const [assignRadiologistId, setAssignRadiologistId] = useState<string>("")
  const [radiologists, setRadiologists] = useState<{ id: string; name: string }[]>([])
  const [bulkStatusOpen, setBulkStatusOpen] = useState(false)
  const [bulkStatusValue, setBulkStatusValue] = useState<string>("Completed")
  const [bulkStatusTestIds, setBulkStatusTestIds] = useState<string[]>([])

  const [newScanPatientId, setNewScanPatientId] = useState("")
  const [newScanPatientName, setNewScanPatientName] = useState("")
  const [newScanModality, setNewScanModality] = useState("X-Ray")
  const [newScanPriority, setNewScanPriority] = useState<"routine" | "urgent" | "stat">("routine")
  const [newScanNotes, setNewScanNotes] = useState("")
  const [creatingScan, setCreatingScan] = useState(false)

  const [manualPatientId, setManualPatientId] = useState("")
  const [manualPatientName, setManualPatientName] = useState("")
  const [manualModality, setManualModality] = useState("X-Ray")
  const [manualNotes, setManualNotes] = useState("")
  const [manualFile, setManualFile] = useState<File | null>(null)
  const [manualUploading, setManualUploading] = useState(false)

  const radiologyTests = labResults.filter((lr) =>
    ["X-Ray", "CT Scan", "MRI", "Ultrasound", "Mammography"].includes(lr.testType),
  )

  const pendingTests = radiologyTests.filter((lr) => lr.status === "pending")
  const completedTests = radiologyTests.filter((lr) => lr.status === "completed")

  const today = new Date()

  const isSameDay = (dateString?: string) => {
    if (!dateString) return false
    const date = new Date(dateString)
    if (Number.isNaN(date.getTime())) return false
    return (
      date.getFullYear() === today.getFullYear() &&
      date.getMonth() === today.getMonth() &&
      date.getDate() === today.getDate()
    )
  }

  const scansOrderedToday = radiologyTests.filter((test) => isSameDay(test.orderedDate))
  const scansCompletedToday = completedTests.filter((test) => isSameDay(test.completedDate))

  const pendingOver24Hours = pendingTests.filter((test) => {
    if (!test.orderedDate) return false
    const ordered = new Date(test.orderedDate)
    if (Number.isNaN(ordered.getTime())) return false
    const diffMs = today.getTime() - ordered.getTime()
    return diffMs >= 24 * 60 * 60 * 1000
  })

  const completedLast7Days = completedTests.filter((test) => {
    if (!test.orderedDate || !test.completedDate) return false
    const completed = new Date(test.completedDate)
    if (Number.isNaN(completed.getTime())) return false
    const diffMs = today.getTime() - completed.getTime()
    const days = diffMs / (24 * 60 * 60 * 1000)
    return days <= 7
  })

  const averageTurnaroundHours = (() => {
    if (completedLast7Days.length === 0) return null
    const totalMs = completedLast7Days.reduce((sum, test) => {
      const ordered = new Date(test.orderedDate!)
      const completed = new Date(test.completedDate!)
      if (Number.isNaN(ordered.getTime()) || Number.isNaN(completed.getTime())) {
        return sum
      }
      return sum + (completed.getTime() - ordered.getTime())
    }, 0)
    if (totalMs <= 0) return null
    const avgHours = totalMs / completedLast7Days.length / (60 * 60 * 1000)
    return Math.round(avgHours * 10) / 10
  })()

  const myUserId = user?.id

  const assignableTests = radiologyTests.filter((t) => t.status === "pending")

  const ensureRadiologistsLoaded = async () => {
    if (radiologists.length > 0) return
    try {
      const res = await fetch("/api/users/radiologists", { credentials: "include" })
      if (!res.ok) return
      const data = await res.json()
      const rows: any[] = Array.isArray(data.radiologists) ? data.radiologists : []
      setRadiologists(rows.map((r) => ({ id: r.id, name: r.name })))
    } catch {
      setRadiologists([])
    }
  }

  const openAssignDialog = () => {
    if (assignableTests.length && !assignStudyId) {
      setAssignStudyId(assignableTests[0].id)
    }
    if (myUserId && !assignRadiologistId) {
      setAssignRadiologistId(myUserId)
    }
    void ensureRadiologistsLoaded()
    setAssignInfoOpen(true)
  }

  const handleAssign = async () => {
    const testIdsToAssign = assignStudyIds.length > 0 ? assignStudyIds : [assignStudyId]
    if (testIdsToAssign.length === 0 || !assignRadiologistId || assigning) return
    setAssigning(true)
    try {
      const results = await Promise.all(
        testIdsToAssign.map((id) =>
          fetch(`/api/lab-tests/${id}`, {
            method: "PATCH",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ assignedRadiologistId: assignRadiologistId }),
          }).then(async (res) => ({ id, ok: res.ok, error: res.ok ? null : (async () => {
            try { const data = await res.json(); return data.error } catch { return "Failed" }
          })() }))
        )
      )
      const errors = await Promise.all(results.map(async (r) => ({ id: r.id, error: await r.error })))
      const failed = errors.filter((e) => e.error)
      if (failed.length > 0) {
        toast.error(`Failed to assign ${failed.length} case(s)`)
      } else {
        toast.success(`Assigned ${testIdsToAssign.length} case(s)`)
      }
      setAssigning(false)
      setAssignInfoOpen(false)
      setAssignStudyIds([])
      setSelectedTests(new Set())
      await refreshMedicalData()
    } catch {
      toast.error("Failed to assign cases")
      setAssigning(false)
    }
  }

  const handleBulkStatusUpdate = async () => {
    if (bulkStatusTestIds.length === 0 || !bulkStatusValue) return
    try {
      const results = await Promise.all(
        bulkStatusTestIds.map((id) =>
          fetch(`/api/lab-tests/${id}`, {
            method: "PATCH",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: bulkStatusValue }),
          }).then((res) => ({ id, ok: res.ok }))
        )
      )
      const failed = results.filter((r) => !r.ok).length
      if (failed > 0) {
        toast.error(`Failed to update ${failed} case(s)`)
      } else {
        toast.success(`Updated ${bulkStatusTestIds.length} case(s)`)
      }
      setBulkStatusOpen(false)
      setBulkStatusTestIds([])
      setSelectedTests(new Set())
      await refreshMedicalData()
    } catch {
      toast.error("Failed to update cases")
    }
  }
  const applyFilters = (tests: typeof radiologyTests) => {
    return tests.filter((test) => {
      if (modalityFilter !== "all" && test.testType !== modalityFilter) return false
      if (priorityFilter !== "all" && test.priority !== priorityFilter) return false
      if (assignmentFilter === "my-cases" && test.assignedToId !== myUserId) return false
      if (assignmentFilter === "unassigned" && test.assignedToId) return false
      if (searchTerm.trim()) {
        const query = searchTerm.trim().toLowerCase()
        const haystack = `${test.patientName} ${test.patientId} ${test.id} ${test.testType}`.toLowerCase()
        if (!haystack.includes(query)) return false
      }
      return true
    })
  }

  const filteredPending = applyFilters(pendingTests)
  const filteredCompleted = applyFilters(completedTests)
  const filteredAll = applyFilters(radiologyTests)

  const modalityCounts: Record<string, number> = {}
  radiologyTests.forEach((test) => {
    modalityCounts[test.testType] = (modalityCounts[test.testType] || 0) + 1
  })
  const modalityData = Object.entries(modalityCounts).map(([modality, count]) => ({
    modality,
    count,
  }))

  const handleCreateScan = async () => {
    if (!newScanPatientId.trim() || !newScanPatientName.trim() || creatingScan) return
    setCreatingScan(true)
    const priorityForBackend =
      newScanPriority === "stat" ? "Stat" : newScanPriority === "urgent" ? "Urgent" : "Routine"
    try {
      const created = await orderTest({
        patientId: newScanPatientId.trim(),
        testName: newScanModality,
        testType: "Radiology",
        priority: priorityForBackend,
        specimenType: "Imaging",
        notes: newScanNotes.trim() || undefined,
      })
      if (!created) {
        toast.error("Failed to create scan request")
        setCreatingScan(false)
        return
      }
      setAddScanOpen(false)
      setNewScanPatientId("")
      setNewScanPatientName("")
      setNewScanNotes("")
      setNewScanModality("X-Ray")
      setNewScanPriority("routine")
      await refreshMedicalData()
      toast.success("Scan request created")
      setCreatingScan(false)
    } catch {
      toast.error("Failed to create scan request")
      setCreatingScan(false)
    }
  }

  const handleManualUpload = async () => {
    if (!manualPatientId.trim() || !manualPatientName.trim() || !manualFile || manualUploading) {
      return
    }
    setManualUploading(true)
    try {
      const form = new FormData()
      form.append("file", manualFile)
      const res = await fetch("/api/upload", {
        method: "POST",
        credentials: "include",
        body: form,
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast.error(err?.error || "Upload failed")
        setManualUploading(false)
        return
      }
      const data = await res.json()
      const url = typeof data?.url === "string" ? data.url : ""
      if (!url) {
        toast.error("No file URL returned")
        setManualUploading(false)
        return
      }

      const documentType = manualModality === "X-Ray" ? "xray" : "scan"
      addMedicalDocument({
        patientId: manualPatientId.trim(),
        patientName: manualPatientName.trim(),
        documentType,
        fileName: manualFile.name,
        fileUrl: url,
        uploadedBy: user?.name || "Radiologist",
        uploadedDate: new Date().toISOString().split("T")[0],
        notes: manualNotes.trim() || undefined,
      })

      // Persist to documents table when patientId is a valid UUID
      const pid = manualPatientId.trim()
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(pid)
      if (isUuid) {
        const docRes = await fetch("/api/documents", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ patientId: pid, type: "OTHER", fileUrl: url }),
        })
        if (!docRes.ok) {
          toast.warning("Study uploaded; could not link to patient record.")
        }
      }

      toast.success("Study uploaded successfully")
      setManualPatientId("")
      setManualPatientName("")
      setManualModality("X-Ray")
      setManualNotes("")
      setManualFile(null)
      setManualUploading(false)
      setUploadInfoOpen(false)
    } catch {
      toast.error("Upload failed")
      setManualUploading(false)
    }
  }

  const handleExport = async (format: "csv" | "xlsx" | "pdf") => {
    if (exporting) return
    setExporting(format)
    const fromDate = new Date(exportFrom)
    const toDate = new Date(exportTo)
    toDate.setHours(23, 59, 59, 999)

    const filters: any = {
      from: fromDate.toISOString(),
      to: toDate.toISOString(),
    }
    if (assignmentFilter === "my-cases" && myUserId) {
      filters.assignedRadiologistId = myUserId
    }
    if (modalityFilter !== "all") {
      filters.modality = modalityFilter
    }

    const filename = `radiology-workload-${exportFrom}-${exportTo}.${format}`
    await runExport(
      {
        dataset: "radiology_lab_tests",
        format,
        filters,
      },
      filename,
      {
        onError: (msg) => toast.error(`Export failed: ${msg}`),
        onSuccess: (fname) => toast.success(`Exported ${fname}`),
      }
    )
    setExporting(null)
  }

  if (selectedTestId) {
    return (
      <RadiologyTestDetails
        testId={selectedTestId}
        onBack={() => setSelectedTestId(null)}
        onSelectTest={(id) => setSelectedTestId(id)}
      />
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight text-sky-900">Radiologist Dashboard</h2>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Monitor imaging workload, prioritize urgent studies, and keep turnaround time within agreed SLAs.
            </p>
          </div>
          <div className="flex flex-col gap-2 items-end">
            <div className="flex gap-2">
              <Input
                type="date"
                value={exportFrom}
                onChange={(e) => setExportFrom(e.target.value)}
                className="w-40"
                size={10}
              />
              <Input
                type="date"
                value={exportTo}
                onChange={(e) => setExportTo(e.target.value)}
                className="w-40"
                size={10}
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExport("csv")}
                disabled={!!exporting}
              >
                <Download className="h-4 w-4 mr-2" />
                {exporting === "csv" ? "Exporting..." : "CSV"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExport("xlsx")}
                disabled={!!exporting}
              >
                <Download className="h-4 w-4 mr-2" />
                {exporting === "xlsx" ? "Exporting..." : "Excel"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExport("pdf")}
                disabled={!!exporting}
              >
                <Download className="h-4 w-4 mr-2" />
                {exporting === "pdf" ? "Exporting..." : "PDF"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-amber-100 bg-amber-50/40 transition-shadow hover:shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-amber-700">
              Pending Worklist
            </CardTitle>
            <Clock className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold text-slate-900">{pendingTests.length}</div>
            <p className="text-xs text-amber-800/80">Across all radiology modalities</p>
          </CardContent>
        </Card>
        <Card className="border-sky-100 bg-sky-50/40 transition-shadow hover:shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-sky-700">
              Scans Ordered Today
            </CardTitle>
            <Scan className="h-4 w-4 text-sky-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold text-slate-900">{scansOrderedToday.length}</div>
            <p className="text-xs text-slate-700/80">New studies added to queue</p>
          </CardContent>
        </Card>
        <Card className="border-emerald-100 bg-emerald-50/50 transition-shadow hover:shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-emerald-700">
              Completed Today
            </CardTitle>
            <CheckCircle className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold text-slate-900">{scansCompletedToday.length}</div>
            <p className="text-xs text-emerald-800/80">Final reports submitted</p>
          </CardContent>
        </Card>
        <Card className="border-rose-100 bg-rose-50/50 transition-shadow hover:shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-rose-700">
              Turnaround &amp; Aging
            </CardTitle>
            <XCircle className="h-4 w-4 text-rose-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold text-slate-900">
              {averageTurnaroundHours !== null ? `${averageTurnaroundHours}h` : "-"}
            </div>
            <p className="text-xs text-muted-foreground">
              Avg TAT (last 7 days) • Overdue &gt;24h: {pendingOver24Hours.length}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(260px,1fr)]">
        <Card className="border-slate-100 bg-white/60">
          <CardHeader className="flex flex-col gap-3 border-b md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <CardTitle className="text-sm font-semibold text-slate-900">Radiology Worklist</CardTitle>
              <CardDescription>Filter by modality, priority, or patient to focus your reading list.</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setBulkActionsEnabled(!bulkActionsEnabled)}>
                {bulkActionsEnabled ? "Disable" : "Enable"} Bulk Actions
              </Button>
              <Button variant="outline" size="sm" onClick={() => setAddScanOpen(true)}>
                + Add Scan
              </Button>
              <Button variant="outline" size="sm" onClick={() => setUploadInfoOpen(true)}>
                + Upload Study
              </Button>
              <Button variant="outline" size="sm" onClick={openAssignDialog}>
                Assign Case
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <Select value={modalityFilter} onValueChange={setModalityFilter}>
                  <SelectTrigger size="sm" className="min-w-[140px]">
                    <SelectValue placeholder="Modality" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All modalities</SelectItem>
                    <SelectItem value="X-Ray">X-Ray</SelectItem>
                    <SelectItem value="CT Scan">CT</SelectItem>
                    <SelectItem value="MRI">MRI</SelectItem>
                    <SelectItem value="Ultrasound">Ultrasound</SelectItem>
                    <SelectItem value="Mammography">Mammography</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                  <SelectTrigger size="sm" className="min-w-[140px]">
                    <SelectValue placeholder="Priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All priorities</SelectItem>
                    <SelectItem value="stat">STAT</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                    <SelectItem value="routine">Routine</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={assignmentFilter} onValueChange={setAssignmentFilter}>
                  <SelectTrigger size="sm" className="min-w-[140px]">
                    <SelectValue placeholder="Assignment" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All cases</SelectItem>
                    <SelectItem value="my-cases">My cases</SelectItem>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger size="sm" className="min-w-[140px]">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="date-desc">Newest first</SelectItem>
                    <SelectItem value="date-asc">Oldest first</SelectItem>
                    <SelectItem value="priority">Priority</SelectItem>
                    <SelectItem value="age">Age (oldest)</SelectItem>
                    <SelectItem value="patient">Patient name</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="w-full max-w-xs">
                <Input
                  placeholder="Search by patient, ID, or study"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            <Tabs defaultValue="pending">
              <TabsList className="bg-muted/60">
                <TabsTrigger value="pending">
                  Pending <Badge variant="secondary">{filteredPending.length}</Badge>
                </TabsTrigger>
                <TabsTrigger value="completed">
                  Completed <Badge variant="outline">{filteredCompleted.length}</Badge>
                </TabsTrigger>
                <TabsTrigger value="all">
                  All <Badge variant="outline">{filteredAll.length}</Badge>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="pending">
                <RadiologyTestQueue
                  tests={filteredPending}
                  onSelectTest={setSelectedTestId}
                  emptyMessage="No pending radiology requests for the current filters."
                  sortBy={sortBy}
                  selectedTests={selectedTests}
                  onToggleTest={(id) => {
                    setSelectedTests((prev) => {
                      const next = new Set(prev)
                      if (next.has(id)) next.delete(id)
                      else next.add(id)
                      return next
                    })
                  }}
                  onSelectAll={() => {
                    setSelectedTests(new Set(filteredPending.map((t) => t.id)))
                  }}
                  onDeselectAll={() => setSelectedTests(new Set())}
                  showBulkActions={bulkActionsEnabled}
                  onBulkAssign={(testIds) => {
                    if (testIds.length === 0) return
                    openAssignDialog(testIds)
                  }}
                  onBulkUpdateStatus={(testIds) => {
                    if (testIds.length === 0) return
                    setBulkStatusTestIds(testIds)
                    setBulkStatusOpen(true)
                  }}
                />
              </TabsContent>

              <TabsContent value="completed">
                <RadiologyTestQueue
                  tests={filteredCompleted}
                  onSelectTest={setSelectedTestId}
                  emptyMessage="No completed scans in this view."
                  sortBy={sortBy}
                  selectedTests={selectedTests}
                  onToggleTest={(id) => {
                    setSelectedTests((prev) => {
                      const next = new Set(prev)
                      if (next.has(id)) next.delete(id)
                      else next.add(id)
                      return next
                    })
                  }}
                  onSelectAll={() => {
                    setSelectedTests(new Set(filteredCompleted.map((t) => t.id)))
                  }}
                  onDeselectAll={() => setSelectedTests(new Set())}
                  showBulkActions={bulkActionsEnabled}
                />
              </TabsContent>

              <TabsContent value="all">
                <RadiologyTestQueue
                  tests={filteredAll}
                  onSelectTest={setSelectedTestId}
                  emptyMessage="No radiology scans match your filters."
                  sortBy={sortBy}
                  selectedTests={selectedTests}
                  onToggleTest={(id) => {
                    setSelectedTests((prev) => {
                      const next = new Set(prev)
                      if (next.has(id)) next.delete(id)
                      else next.add(id)
                      return next
                    })
                  }}
                  onSelectAll={() => {
                    setSelectedTests(new Set(filteredAll.map((t) => t.id)))
                  }}
                  onDeselectAll={() => setSelectedTests(new Set())}
                  showBulkActions={bulkActionsEnabled}
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <Card className="border-slate-100 bg-slate-50/60">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div>
              <CardTitle className="text-sm font-semibold text-slate-900">Workload by Modality</CardTitle>
              <CardDescription>Snapshot of studies currently on your list.</CardDescription>
            </div>
            <BarChart3 className="h-4 w-4 text-slate-500" />
          </CardHeader>
          <CardContent className="h-56 pt-0">
            {modalityData.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
                <p className="text-sm font-medium text-foreground">No radiology studies yet</p>
                <p className="text-xs text-muted-foreground">
                  Once orders are placed, you&apos;ll see volume by modality here.
                </p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={modalityData}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="modality" tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                  <Tooltip
                    cursor={{ fill: "rgba(148, 163, 184, 0.1)" }}
                    contentStyle={{
                      fontSize: 12,
                      borderRadius: 8,
                      borderColor: "rgba(148, 163, 184, 0.4)",
                    }}
                  />
                  <Bar dataKey="count" fill="hsl(var(--chart-1))" radius={4} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={addScanOpen} onOpenChange={setAddScanOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Radiology Scan</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="patient-id">Patient ID</Label>
                <Input
                  id="patient-id"
                  placeholder="e.g. PT-000123"
                  value={newScanPatientId}
                  onChange={(e) => setNewScanPatientId(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="patient-name">Patient name</Label>
                <Input
                  id="patient-name"
                  placeholder="First Last"
                  value={newScanPatientName}
                  onChange={(e) => setNewScanPatientName(e.target.value)}
                />
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <Label>Modality</Label>
                <Select value={newScanModality} onValueChange={setNewScanModality}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select modality" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="X-Ray">X-Ray</SelectItem>
                    <SelectItem value="CT Scan">CT</SelectItem>
                    <SelectItem value="MRI">MRI</SelectItem>
                    <SelectItem value="Ultrasound">Ultrasound</SelectItem>
                    <SelectItem value="Mammography">Mammography</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Priority</Label>
                <Select value={newScanPriority} onValueChange={(v) => setNewScanPriority(v as any)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="stat">STAT</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                    <SelectItem value="routine">Routine</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="scan-notes">Notes (optional)</Label>
              <Input
                id="scan-notes"
                placeholder="Clinical indication or comments"
                value={newScanNotes}
                onChange={(e) => setNewScanNotes(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAddScanOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleCreateScan}
                disabled={!newScanPatientId.trim() || !newScanPatientName.trim() || creatingScan}
              >
                {creatingScan ? "Creating..." : "Create scan request"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={uploadInfoOpen} onOpenChange={setUploadInfoOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Info className="h-4 w-4 text-sky-500" />
              Upload Study
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5 text-sm text-muted-foreground">
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                Manual upload (external images / CDs)
              </p>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="manual-patient-id">Patient ID</Label>
                  <Input
                    id="manual-patient-id"
                    value={manualPatientId}
                    onChange={(e) => setManualPatientId(e.target.value)}
                    placeholder="e.g. PT-000123"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="manual-patient-name">Patient name</Label>
                  <Input
                    id="manual-patient-name"
                    value={manualPatientName}
                    onChange={(e) => setManualPatientName(e.target.value)}
                    placeholder="First Last"
                  />
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <Label>Study type</Label>
                  <Select value={manualModality} onValueChange={setManualModality}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select modality" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="X-Ray">X-Ray</SelectItem>
                      <SelectItem value="CT Scan">CT</SelectItem>
                      <SelectItem value="MRI">MRI</SelectItem>
                      <SelectItem value="Ultrasound">Ultrasound</SelectItem>
                      <SelectItem value="Mammography">Mammography</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="manual-file">Image file</Label>
                  <Input
                    id="manual-file"
                    type="file"
                    accept="image/*"
                    onChange={(e) => setManualFile(e.target.files?.[0] || null)}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    JPEG/PNG only • Stored under secure uploads
                  </p>
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="manual-notes">Notes (optional)</Label>
                <Input
                  id="manual-notes"
                  value={manualNotes}
                  onChange={(e) => setManualNotes(e.target.value)}
                  placeholder="Clinical indication or comments"
                />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <Button
                  size="sm"
                  onClick={handleManualUpload}
                  disabled={
                    !manualPatientId.trim() || !manualPatientName.trim() || !manualFile || manualUploading
                  }
                >
                  {manualUploading ? "Uploading..." : "Upload manually"}
                </Button>
              </div>
            </div>

            <div className="space-y-2 border-t pt-4 text-xs">
              <p className="font-semibold text-slate-700">PACS / imaging system</p>
              <p>
                For routine clinical workflow, continue pushing studies from your DICOM workstation into the PACS /
                archive. Once indexed, those studies will be available for reporting here without any manual upload.
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={assignInfoOpen} onOpenChange={setAssignInfoOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Info className="h-4 w-4 text-sky-500" />
              Assign Case
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm text-muted-foreground">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="assign-study">Study</Label>
                <Select
                  value={assignStudyId}
                  onValueChange={setAssignStudyId}
                  disabled={!assignableTests.length}
                >
                  <SelectTrigger id="assign-study">
                    <SelectValue placeholder={assignableTests.length ? "Select study" : "No pending studies"} />
                  </SelectTrigger>
                  <SelectContent>
                    {assignableTests.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.testType} • {t.patientName || t.patientId || t.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="assign-radiologist">Assign to</Label>
                <Select
                  value={assignRadiologistId}
                  onValueChange={setAssignRadiologistId}
                  disabled={!radiologists.length}
                >
                  <SelectTrigger id="assign-radiologist">
                    <SelectValue placeholder="Select radiologist" />
                  </SelectTrigger>
                  <SelectContent>
                    {myUserId && (
                      <SelectItem value={myUserId}>
                        Me ({user?.name || "Current user"})
                      </SelectItem>
                    )}
                    {radiologists
                      .filter((r) => r.id !== myUserId)
                      .map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <p className="text-xs">
              Assigning {assignStudyIds.length > 1 ? "cases" : "a case"} updates the underlying lab test record and lets dashboards show per-radiologist workload
              and ownership. You can reassign at any time.
            </p>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={() => {
                setAssignInfoOpen(false)
                setAssignStudyIds([])
              }}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleAssign}
                disabled={(!assignStudyId && assignStudyIds.length === 0) || !assignRadiologistId || assigning}
              >
                {assigning ? "Assigning..." : assignStudyIds.length > 1 ? `Assign ${assignStudyIds.length} cases` : "Assign case"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkStatusOpen} onOpenChange={setBulkStatusOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Info className="h-4 w-4 text-sky-500" />
              Update Status for {bulkStatusTestIds.length} Case{bulkStatusTestIds.length > 1 ? "s" : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>New Status</Label>
              <Select value={bulkStatusValue} onValueChange={setBulkStatusValue}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Completed">Completed</SelectItem>
                  <SelectItem value="Cancelled">Cancelled</SelectItem>
                  <SelectItem value="Pending">Pending</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => {
                setBulkStatusOpen(false)
                setBulkStatusTestIds([])
              }}>
                Cancel
              </Button>
              <Button onClick={handleBulkStatusUpdate}>
                Update {bulkStatusTestIds.length} Case{bulkStatusTestIds.length > 1 ? "s" : ""}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
