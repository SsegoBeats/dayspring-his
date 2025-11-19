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
import { Scan, Clock, CheckCircle, XCircle, BarChart3, Info } from "lucide-react"
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

export function RadiologistDashboard() {
  const { labResults, addMedicalDocument } = useMedical()
  const { user } = useAuth()
  const { orderTest } = useLab()
  const [selectedTestId, setSelectedTestId] = useState<string | null>(null)
  const [modalityFilter, setModalityFilter] = useState<string>("all")
  const [priorityFilter, setPriorityFilter] = useState<string>("all")
  const [searchTerm, setSearchTerm] = useState<string>("")

  const [addScanOpen, setAddScanOpen] = useState(false)
  const [uploadInfoOpen, setUploadInfoOpen] = useState(false)
  const [assignInfoOpen, setAssignInfoOpen] = useState(false)
  const [assigning, setAssigning] = useState(false)
  const [assignStudyId, setAssignStudyId] = useState<string>("")
  const [assignRadiologistId, setAssignRadiologistId] = useState<string>("")
  const [radiologists, setRadiologists] = useState<{ id: string; name: string }[]>([])

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
    if (!assignStudyId || !assignRadiologistId || assigning) return
    setAssigning(true)
    try {
      await fetch(`/api/lab-tests/${assignStudyId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignedRadiologistId: assignRadiologistId }),
      })
      setAssigning(false)
      setAssignInfoOpen(false)
      if (typeof window !== "undefined") {
        window.location.reload()
      }
    } catch {
      setAssigning(false)
    }
  }
  const applyFilters = (tests: typeof radiologyTests) => {
    return tests.filter((test) => {
      if (modalityFilter !== "all" && test.testType !== modalityFilter) return false
      if (priorityFilter !== "all" && test.priority !== priorityFilter) return false
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
      await orderTest({
        patientId: newScanPatientId.trim(),
        testName: newScanModality,
        testType: "Radiology",
        priority: priorityForBackend,
        specimenType: "Imaging",
        notes: newScanNotes.trim() || undefined,
      })
      setAddScanOpen(false)
      setNewScanPatientId("")
      setNewScanPatientName("")
      setNewScanNotes("")
      setNewScanModality("X-Ray")
      setNewScanPriority("routine")
      // The radiologist dashboard pulls from /api/medical.
      // For now, prompt the user to refresh to see the newly created scan reflected there.
      if (typeof window !== "undefined") {
        window.location.reload()
      }
    } catch {
      // Silently fail for now; in future we can surface a toast.
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
        body: form,
      })
      if (!res.ok) {
        setManualUploading(false)
        return
      }
      const data = await res.json()
      const url = typeof data?.url === "string" ? data.url : ""
      if (!url) {
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

      setManualPatientId("")
      setManualPatientName("")
      setManualModality("X-Ray")
      setManualNotes("")
      setManualFile(null)
      setManualUploading(false)
      setUploadInfoOpen(false)
    } catch {
      setManualUploading(false)
    }
  }

  if (selectedTestId) {
    return <RadiologyTestDetails testId={selectedTestId} onBack={() => setSelectedTestId(null)} />
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h2 className="text-3xl font-semibold tracking-tight text-sky-900">Radiologist Dashboard</h2>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Monitor imaging workload, prioritize urgent studies, and keep turnaround time within agreed SLAs.
        </p>
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
                />
              </TabsContent>

              <TabsContent value="completed">
                <RadiologyTestQueue
                  tests={filteredCompleted}
                  onSelectTest={setSelectedTestId}
                  emptyMessage="No completed scans in this view."
                />
              </TabsContent>

              <TabsContent value="all">
                <RadiologyTestQueue
                  tests={filteredAll}
                  onSelectTest={setSelectedTestId}
                  emptyMessage="No radiology scans match your filters."
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
                    {radiologists.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <p className="text-xs">
              Assigning a case updates the underlying lab test record and lets dashboards show per-radiologist workload
              and ownership. You can reassign at any time.
            </p>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={() => setAssignInfoOpen(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleAssign}
                disabled={!assignStudyId || !assignRadiologistId || assigning}
              >
                {assigning ? "Assigning..." : "Assign case"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
