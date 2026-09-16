"use client"
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  AlertCircle,
  ArrowLeft,
  Download,
  Edit2,
  ExternalLink,
  FileText,
  History,
  Image as ImageIcon,
  Loader2,
  Paperclip,
  Save,
  Scan,
  Send,
  UserCheck,
  XCircle,
} from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/lib/auth-context"
import { useLab } from "@/lib/lab-context"
import { usePatients } from "@/lib/patient-context"
import { useSettings } from "@/lib/settings-context"
import {
  buildStructuredRadiologyReport,
  calculateAgeFromDob,
  formatRadiologyAttachmentName,
  formatStudyPriority,
  formatStudyStatus,
  getMissingStructuredSections,
  getRadiologyStructuredTemplate,
  isRadiologyDicomAsset,
  isRadiologyImageAsset,
  isRadiologyPdfAsset,
  normalizeRadiologyStudy,
  type RadiologyStudy,
} from "@/lib/radiology"
import { formatPatientNumber } from "@/lib/patients"
import { ImageViewer } from "./image-viewer"

interface RadiologyTestDetailsProps {
  testId: string
  onBack: () => void
  onSelectTest?: (id: string) => void
}

type RadiologyAttachment = {
  id: string
  url: string
  name: string
  notes?: string
  uploadedAt?: string
  mimeType?: string | null
  isImage: boolean
  isPdf: boolean
  isDicom: boolean
}

export function RadiologyTestDetails({ testId, onBack, onSelectTest }: RadiologyTestDetailsProps) {
  const { user } = useAuth()
  const { tests, refresh } = useLab()
  const { getPatient } = usePatients()
  const { settings } = useSettings()
  const workflowPrefs = (settings as any)?.radiologistWorkflow as {
    enforceStructuredReports?: boolean
    showPreviousStudiesDefault?: boolean
  } | undefined

  const [study, setStudy] = useState<RadiologyStudy | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [claiming, setClaiming] = useState(false)
  const [results, setResults] = useState("")
  const [notes, setNotes] = useState("")
  const [isEditing, setIsEditing] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)
  const [showPreviousStudies, setShowPreviousStudies] = useState(false)
  const [attachments, setAttachments] = useState<RadiologyAttachment[]>([])
  const [imagesLoading, setImagesLoading] = useState(false)
  const [imageViewerOpen, setImageViewerOpen] = useState(false)
  const [imageViewerIndex, setImageViewerIndex] = useState(0)

  const loadStudy = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/lab-tests/${testId}`, { credentials: "include" })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data?.error || "Failed to load study")
      }

      const nextStudy = normalizeRadiologyStudy(data.test)
      if (!nextStudy) {
        throw new Error("Study is not a radiology case")
      }

      setStudy(nextStudy)
      setResults(nextStudy.results || "")
      setNotes(nextStudy.notes || "")
      setIsEditing(false)
      setShowTemplates(false)
    } catch (error: any) {
      toast.error(error?.message || "Failed to load study")
      setStudy(null)
    } finally {
      setLoading(false)
    }
  }, [testId])

  useEffect(() => {
    void loadStudy()
  }, [loadStudy])

  useEffect(() => {
    if (!study?.patientId) {
      setAttachments([])
      return
    }

    let cancelled = false
    setImagesLoading(true)
    fetch(`/api/documents?patientId=${encodeURIComponent(study.patientId)}`, { credentials: "include" })
      .then((res) => (res.ok ? res.json() : { documents: [] }))
      .then((data) => {
        if (cancelled) return
        const docs = Array.isArray(data.documents) ? data.documents : []
        const mapped = docs
          .filter((doc: any) => doc?.type === "OTHER")
          .map((doc: any) => ({
            id: String(doc.id),
            url: doc.file_url.startsWith("http") ? doc.file_url : `${window.location.origin}${doc.file_url}`,
            name: formatRadiologyAttachmentName(doc.original_name, doc.file_url, doc.type),
            notes: doc.notes || "",
            uploadedAt: doc.uploaded_at || "",
            mimeType: doc.mime_type || null,
            isImage: isRadiologyImageAsset(doc.file_url, doc.mime_type),
            isPdf: isRadiologyPdfAsset(doc.file_url, doc.mime_type),
            isDicom: isRadiologyDicomAsset(doc.file_url, doc.mime_type, doc.original_name),
          }))
          .sort((a: RadiologyAttachment, b: RadiologyAttachment) => {
            const first = new Date(b.uploadedAt || 0).getTime()
            const second = new Date(a.uploadedAt || 0).getTime()
            return first - second
          })
        setAttachments(mapped)
      })
      .catch(() => {
        if (!cancelled) setAttachments([])
      })
      .finally(() => {
        if (!cancelled) setImagesLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [study?.patientId])

  useEffect(() => {
    if (workflowPrefs?.showPreviousStudiesDefault && study?.id) {
      setShowPreviousStudies(true)
    }
  }, [study?.id, workflowPrefs?.showPreviousStudiesDefault])

  const patient = study ? getPatient(study.patientId) : undefined
  const age =
    patient?.ageYears ??
    calculateAgeFromDob(patient?.dateOfBirth ?? study?.patientDob ?? null)
  const structuredTemplate = useMemo(
    () => getRadiologyStructuredTemplate(study?.testName || study?.testType),
    [study],
  )
  const activeTemplates = structuredTemplate?.quickPhrases || []
  const imageAttachments = useMemo(
    () => attachments.filter((attachment) => attachment.isImage),
    [attachments],
  )
  const fileAttachments = useMemo(
    () => attachments.filter((attachment) => !attachment.isImage),
    [attachments],
  )
  const missingRequiredSections = useMemo(
    () =>
      structuredTemplate
        ? getMissingStructuredSections(results, structuredTemplate.requiredSections)
        : [],
    [results, structuredTemplate],
  )
  const enforceStructuredSections = Boolean(
    structuredTemplate &&
      (workflowPrefs?.enforceStructuredReports === true ||
        ["CT Scan", "MRI", "Mammography"].includes(structuredTemplate.modality)),
  )

  const previousStudies = useMemo(() => {
    if (!study?.patientId) return []
    return tests
      .map((test) => normalizeRadiologyStudy(test))
      .filter((item): item is RadiologyStudy => Boolean(item))
      .filter((item) => item.patientId === study.patientId && item.id !== study.id)
      .sort((a, b) => new Date(b.orderedAt).getTime() - new Date(a.orderedAt).getTime())
      .slice(0, 8)
  }, [study?.id, study?.patientId, tests])

  const currentUserIsAssignee = Boolean(study?.assignedToId && study.assignedToId === user?.id)
  const canClaimStudy = Boolean(user?.id && study && study.status !== "completed" && study.status !== "cancelled")

  const updateStudy = async (payload: Record<string, unknown>, successMessage: string) => {
    if (!study) return false

    setSaving(true)
    try {
      const res = await fetch(`/api/lab-tests/${study.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data?.error || "Failed to update study")
      }

      await refresh()
      await loadStudy()
      toast.success(successMessage)
      return true
    } catch (error: any) {
      toast.error(error?.message || "Failed to update study")
      return false
    } finally {
      setSaving(false)
    }
  }

  const handleClaimStudy = async () => {
    if (!study || !user?.id || !canClaimStudy) return
    setClaiming(true)
    try {
      const status = study.status === "pending" ? "In Progress" : undefined
      const payload: Record<string, unknown> = { assignedRadiologistId: user.id }
      if (status) payload.status = status
      const ok = await updateStudy(payload, "Study assigned to you")
      if (ok) setIsEditing(true)
    } finally {
      setClaiming(false)
    }
  }

  const applyStructuredTemplate = () => {
    if (!study) return
    const template = buildStructuredRadiologyReport(study.testName || study.testType)
    if (!template) return
    if (results.trim() && !window.confirm("Replace the current report with the structured template?")) return
    setResults(template)
    setIsEditing(true)
  }

  const insertMissingSections = () => {
    if (missingRequiredSections.length === 0) return
    setResults((current) => {
      const trimmed = current.trim()
      const additions = missingRequiredSections.map((section) => `${section}:\n`).join("\n")
      return trimmed ? `${trimmed}\n\n${additions}` : additions
    })
    setIsEditing(true)
  }

  const validateStructuredSubmission = () => {
    if (!enforceStructuredSections || missingRequiredSections.length === 0) return true
    toast.error(`Complete the required sections before submission: ${missingRequiredSections.join(", ")}`)
    return false
  }

  const handleSaveDraft = async () => {
    if (!study || !results.trim()) {
      toast.error("Findings are required before saving")
      return
    }

    const payload: Record<string, unknown> = {
      results,
      notes,
    }
    if (user?.id) payload.assignedRadiologistId = user.id
    if (study.status === "pending") payload.status = "In Progress"

    const ok = await updateStudy(payload, "Draft saved")
    if (ok) setIsEditing(false)
  }

  const handleSubmitReport = async () => {
    if (!study || !results.trim()) {
      toast.error("Findings are required before submission")
      return
    }
    if (!validateStructuredSubmission()) return

    const payload: Record<string, unknown> = {
      status: "Completed",
      results,
      notes,
    }
    if (user?.id) payload.assignedRadiologistId = user.id

    const ok = await updateStudy(payload, "Report submitted")
    if (ok) {
      setIsEditing(false)
    }
  }

  const handleCancelStudy = async () => {
    if (!study) return
    if (!window.confirm("Cancel this study? This will remove it from the active reporting queue.")) return
    const ok = await updateStudy({ status: "Cancelled", notes }, "Study cancelled")
    if (ok) setIsEditing(false)
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center gap-3 py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading study...
        </CardContent>
      </Card>
    )
  }

  if (!study) {
    return (
      <Card>
        <CardContent className="space-y-4 py-16 text-center">
          <p className="text-muted-foreground">Study not found.</p>
          <Button onClick={onBack}>Back to Worklist</Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Worklist
        </Button>
        <div className="flex flex-wrap gap-2">
          {canClaimStudy && !currentUserIsAssignee ? (
            <Button variant="outline" onClick={() => void handleClaimStudy()} disabled={claiming || saving}>
              {claiming ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserCheck className="mr-2 h-4 w-4" />}
              Assign to Me
            </Button>
          ) : null}
          {study.results ? (
            <Button variant="outline" onClick={() => window.open(`/api/lab-tests/${study.id}/pdf`, "_blank")}>
              <FileText className="mr-2 h-4 w-4" />
              Download PDF
            </Button>
          ) : null}
          {study.status !== "completed" && study.status !== "cancelled" ? (
            <Button onClick={() => setIsEditing(true)} disabled={saving}>
              <Edit2 className="mr-2 h-4 w-4" />
              {study.results ? "Continue Report" : "Start Report"}
            </Button>
          ) : (
            <Button variant="outline" onClick={() => setIsEditing(true)} disabled={saving}>
              <Edit2 className="mr-2 h-4 w-4" />
              Edit Report
            </Button>
          )}
        </div>
      </div>

      {!currentUserIsAssignee && study.assignedToName ? (
        <Card className="border-amber-200 bg-amber-50/70">
          <CardContent className="flex items-start gap-3 py-4 text-sm text-amber-900">
            <AlertCircle className="mt-0.5 h-4 w-4" />
            <div>
              <p className="font-medium">This case is currently assigned to {study.assignedToName}.</p>
              <p className="text-amber-900/80">You can still review it, or use &quot;Assign to Me&quot; to take ownership.</p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[1.3fr_0.7fr]">
        <Card className="overflow-hidden border-border/70 shadow-sm">
          <CardHeader className={`border-b border-border/60 ${
            study.priority === "stat"
              ? "bg-[linear-gradient(135deg,#1e0a0a_0%,#3b0d0d_50%,#1c1c1c_100%)] text-white"
              : study.priority === "urgent"
                ? "bg-[linear-gradient(135deg,#1a1400_0%,#3b2800_50%,#1c1a0a_100%)] text-white"
                : "bg-[linear-gradient(135deg,#062032_0%,#0a3d52_60%,#062032_100%)] text-white"
          }`}>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-1">
                <CardTitle className="flex items-center gap-2 text-white">
                  <Scan className={`h-5 w-5 ${study.priority === "stat" ? "text-red-400" : study.priority === "urgent" ? "text-amber-400" : "text-sky-400"}`} />
                  {study.testName}
                </CardTitle>
                <CardDescription className="text-white/60">
                  Accession: {study.accessionNumber || study.id}
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={study.status === "completed" ? "default" : study.status === "cancelled" ? "destructive" : "secondary"}>
                  {formatStudyStatus(study.status)}
                </Badge>
                <Badge variant={study.priority === "stat" ? "destructive" : study.priority === "urgent" ? "default" : "outline"}>
                  {formatStudyPriority(study.priority)}
                </Badge>
                {study.assignedToName && (
                  <span className="rounded-full border border-white/20 bg-white/10 px-2.5 py-0.5 text-xs text-white/80">
                    {study.assignedToName}
                  </span>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6 p-6">
            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-3 rounded-2xl border border-border/70 bg-background p-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Patient</p>
                  <h3 className="mt-2 text-lg font-semibold text-foreground">{study.patientName}</h3>
                  <p className="text-sm text-muted-foreground">
                    {formatPatientNumber(patient?.patientNumber || study.patientNumber)} {age != null ? `- ${age} yrs` : ""}{" "}
                    {patient?.gender || study.patientGender ? `- ${(patient?.gender || study.patientGender || "").toString()}` : ""}
                  </p>
                </div>
                <div className="grid gap-2 text-sm">
                  <div><span className="text-muted-foreground">Patient UUID:</span> <span className="text-foreground">{study.patientId}</span></div>
                  <div><span className="text-muted-foreground">Phone:</span> <span className="text-foreground">{patient?.phone || "-"}</span></div>
                  <div><span className="text-muted-foreground">Blood Group:</span> <span className="text-foreground">{patient?.bloodGroup || "-"}</span></div>
                </div>
              </div>

              <div className="space-y-3 rounded-2xl border border-border/70 bg-background p-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Study</p>
                  <h3 className="mt-2 text-lg font-semibold text-foreground">{study.testName}</h3>
                  <p className="text-sm text-muted-foreground">{study.testType}</p>
                </div>
                <div className="grid gap-2 text-sm">
                  <div><span className="text-muted-foreground">Ordered By:</span> <span className="text-foreground">{study.orderedBy || "-"}</span></div>
                  <div><span className="text-muted-foreground">Ordered At:</span> <span className="text-foreground">{new Date(study.orderedAt).toLocaleString()}</span></div>
                  <div><span className="text-muted-foreground">Assigned To:</span> <span className="text-foreground">{study.assignedToName || "Unassigned"}</span></div>
                  {study.completedAt ? (
                    <div><span className="text-muted-foreground">Completed At:</span> <span className="text-foreground">{new Date(study.completedAt).toLocaleString()}</span></div>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="flex items-center gap-2 text-base font-semibold text-foreground">
                    <Paperclip className="h-4 w-4" />
                    Patient Attachments
                  </Label>
                  <p className="text-xs text-muted-foreground">Images, PDFs, and packaged external study files linked to this patient record.</p>
                </div>
                {imagesLoading ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
              </div>

              {imageAttachments.length > 0 ? (
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  {imageAttachments.map((image, index) => (
                    <button
                      key={image.id}
                      type="button"
                      className="group relative aspect-square overflow-hidden rounded-2xl border border-border bg-muted"
                      onClick={() => {
                        setImageViewerIndex(index)
                        setImageViewerOpen(true)
                      }}
                    >
                      <img src={image.url} alt={image.name || `Study image ${index + 1}`} className="h-full w-full object-cover transition duration-200 group-hover:scale-105" />
                      <div className="absolute inset-0 bg-black/0 transition group-hover:bg-black/10" />
                    </button>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
                  No linked study images were found for this patient yet.
                </div>
              )}

              <div className="space-y-3">
                <Label className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <FileText className="h-4 w-4" />
                  Other Study Files
                </Label>
                {fileAttachments.length > 0 ? (
                  <div className="space-y-3">
                    {fileAttachments.map((attachment) => (
                      <div key={attachment.id} className="rounded-2xl border border-border/70 bg-background p-4">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-medium text-foreground">{attachment.name}</span>
                              <Badge variant="outline">
                                {attachment.isPdf ? "PDF" : attachment.isDicom ? "DICOM / package" : "Attachment"}
                              </Badge>
                            </div>
                            {attachment.notes ? (
                              <p className="text-sm text-muted-foreground whitespace-pre-line">{attachment.notes}</p>
                            ) : null}
                            {attachment.uploadedAt ? (
                              <p className="text-xs text-muted-foreground">
                                Uploaded {new Date(attachment.uploadedAt).toLocaleString()}
                              </p>
                            ) : null}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button variant="outline" size="sm" asChild>
                              <a href={attachment.url} target="_blank" rel="noreferrer">
                                <ExternalLink className="mr-2 h-4 w-4" />
                                Open
                              </a>
                            </Button>
                            <Button variant="outline" size="sm" asChild>
                              <a href={attachment.url} download>
                                <Download className="mr-2 h-4 w-4" />
                                Download
                              </a>
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground">
                    No PDF, DICOM, or packaged study attachments have been linked yet.
                  </div>
                )}
              </div>
            </div>

            {structuredTemplate ? (
              <div className="space-y-3 rounded-2xl border border-border/70 bg-muted/20 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <Label className="text-base font-semibold text-foreground">Structured Report Template</Label>
                    <p className="text-xs text-muted-foreground">{structuredTemplate.description}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={applyStructuredTemplate} disabled={!isEditing}>
                      Apply Template
                    </Button>
                    {missingRequiredSections.length > 0 ? (
                      <Button variant="outline" size="sm" onClick={insertMissingSections} disabled={!isEditing}>
                        Insert Missing Sections
                      </Button>
                    ) : null}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {structuredTemplate.sectionOrder.map((section) => (
                    <Badge key={section} variant="outline">
                      {section}
                      {structuredTemplate.requiredSections.includes(section) ? " *" : ""}
                    </Badge>
                  ))}
                </div>
                <div className={`rounded-2xl px-4 py-3 text-sm ${missingRequiredSections.length > 0 ? "border border-amber-200 bg-amber-50/80 text-amber-900" : "border border-emerald-200 bg-emerald-50/70 text-emerald-900"}`}>
                  {missingRequiredSections.length > 0 ? (
                    <>
                      Missing structured sections: {missingRequiredSections.join(", ")}
                      {enforceStructuredSections ? " These sections are required before final submission." : ""}
                    </>
                  ) : (
                    <>Structured section headings are in place for this report.</>
                  )}
                </div>
              </div>
            ) : null}

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="radiology-results" className="text-base font-semibold text-foreground">
                  Radiologist Findings
                </Label>
                {activeTemplates.length > 0 ? (
                  <Button variant="ghost" size="sm" onClick={() => setShowTemplates((value) => !value)}>
                    <FileText className="mr-2 h-4 w-4" />
                    {showTemplates ? "Hide Templates" : "Show Templates"}
                  </Button>
                ) : null}
              </div>
              {showTemplates && activeTemplates.length > 0 ? (
                <div className="flex flex-wrap gap-2 rounded-2xl border border-border/70 bg-muted/20 p-3">
                  {activeTemplates.map((template) => (
                    <Button
                      key={template}
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-auto whitespace-normal text-left"
                      onClick={() => setResults((current) => (current ? `${current}\n\n${template}` : template))}
                    >
                      {template}
                    </Button>
                  ))}
                </div>
              ) : null}

              <Textarea
                id="radiology-results"
                placeholder="Describe findings, impression, and any urgent communication points."
                value={results}
                onChange={(event) => setResults(event.target.value)}
                rows={9}
                disabled={!isEditing}
              />
            </div>

            <div className="space-y-3">
              <Label htmlFor="radiology-notes" className="text-base font-semibold text-foreground">
                Additional Notes
              </Label>
              <Textarea
                id="radiology-notes"
                placeholder="Procedure notes, limitations, or follow-up recommendations."
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={5}
                disabled={!isEditing}
              />
            </div>

            {isEditing ? (
              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsEditing(false)
                    setResults(study.results || "")
                    setNotes(study.notes || "")
                  }}
                  disabled={saving}
                >
                  Cancel
                </Button>
                <Button variant="outline" onClick={() => void handleSaveDraft()} disabled={saving || !results.trim()}>
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Save Draft
                </Button>
                <Button
                  onClick={() => void handleSubmitReport()}
                  disabled={saving || !results.trim() || (enforceStructuredSections && missingRequiredSections.length > 0)}
                  title={enforceStructuredSections && missingRequiredSections.length > 0 ? `Complete required sections before submission: ${missingRequiredSections.join(", ")}` : undefined}
                >
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                  Submit Report
                </Button>
                {study.status !== "completed" ? (
                  <Button variant="destructive" onClick={() => void handleCancelStudy()} disabled={saving}>
                    <XCircle className="mr-2 h-4 w-4" />
                    Cancel Study
                  </Button>
                ) : null}
              </div>
            ) : study.results ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 px-4 py-3 text-sm text-emerald-900">
                Report ready. Use &quot;Edit Report&quot; if you need to revise findings or addendum notes.
              </div>
            ) : (
              <div className="rounded-2xl border border-border/70 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
                Open the study to start reporting. Drafts and completion both write back to the shared lab-test record.
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-5">
          <Card className="border-border/70 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Previous Radiology Studies</CardTitle>
              <CardDescription>Historical imaging for the same patient.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setShowPreviousStudies((value) => !value)}
              >
                <History className="mr-2 h-4 w-4" />
                {showPreviousStudies ? "Hide Previous Studies" : `Show Previous Studies (${previousStudies.length})`}
              </Button>

              {showPreviousStudies ? (
                previousStudies.length > 0 ? (
                  <div className="space-y-3">
                    {previousStudies.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className="w-full rounded-2xl border border-border/70 bg-background p-4 text-left transition hover:bg-muted/20"
                        onClick={() => onSelectTest?.(item.id)}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-medium text-foreground">{item.testName}</p>
                            <p className="text-xs text-muted-foreground">
                              {item.completedAt
                                ? `Completed ${new Date(item.completedAt).toLocaleDateString()}`
                                : `Ordered ${new Date(item.orderedAt).toLocaleDateString()}`}
                            </p>
                            {item.results ? (
                              <p className="mt-2 line-clamp-3 text-xs text-muted-foreground">{item.results}</p>
                            ) : null}
                          </div>
                          <Badge variant={item.status === "completed" ? "default" : item.status === "cancelled" ? "destructive" : "secondary"}>
                            {formatStudyStatus(item.status)}
                          </Badge>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
                    No prior radiology studies were found for this patient.
                  </div>
                )
              ) : null}
            </CardContent>
          </Card>

          <Card className="border-border/70 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Workflow Notes</CardTitle>
              <CardDescription>How this study connects to the rest of the hospital flow.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>Assignments update the shared study record, so workload reflects correctly in the radiologist and ordering-clinician workflow.</p>
              <p>When you submit a completed radiology report, the ordering clinician is notified and can review it from their consultation workflow.</p>
              <p>Patient-linked uploads shown above come from the shared document store, so external imaging added here is visible across portals where document access is expected.</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {imageAttachments.length > 0 ? (
        <ImageViewer
          images={imageAttachments.map((image) => ({ url: image.url, name: image.name }))}
          open={imageViewerOpen}
          onOpenChange={setImageViewerOpen}
          initialIndex={imageViewerIndex}
        />
      ) : null}
    </div>
  )
}
