"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import {
  getPatientDocumentTypeDescription,
  getPatientDocumentTypeLabel,
  PATIENT_DOCUMENT_TYPES,
  type PatientDocumentType,
} from "@/lib/insurance"
import { InsuranceFieldLabel, InsuranceHoverNote } from "@/components/patient/insurance-help"

type Doc = {
  id: string
  type: PatientDocumentType
  file_url: string
  uploaded_at: string
  original_name?: string | null
  mime_type?: string | null
  notes?: string | null
}

type PolicySnapshot = {
  id: string
  active: boolean
  authorization_required?: boolean | null
  payer_type?: string | null
  verification_status?: string | null
  scheme_stamp_required?: boolean | null
  employer_name?: string | null
}

type PreauthorizationSnapshot = {
  id: string
  status: string
}

type ChecklistItem = {
  id: string
  title: string
  description: string
  required: boolean
  complete: boolean
  suggestedType?: PatientDocumentType
}

export function DocumentsList({ patientId }: { patientId: string }) {
  const [docs, setDocs] = useState<Doc[]>([])
  const [policies, setPolicies] = useState<PolicySnapshot[]>([])
  const [preauthorizations, setPreauthorizations] = useState<PreauthorizationSnapshot[]>([])
  const [type, setType] = useState<PatientDocumentType>("ID")
  const [notes, setNotes] = useState("")
  const [loading, setLoading] = useState(false)
  const [adding, setAdding] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [highlightChecklist, setHighlightChecklist] = useState(false)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const [docsRes, policiesRes, preauthRes] = await Promise.all([
        fetch(`/api/documents?patientId=${patientId}`, { credentials: "include" }),
        fetch(`/api/insurance/policies?patientId=${patientId}`, { credentials: "include" }),
        fetch(`/api/insurance/preauthorizations?patientId=${patientId}`, { credentials: "include" }),
      ])
      if (docsRes.ok) setDocs((await docsRes.json()).documents || [])
      if (policiesRes.ok) setPolicies((await policiesRes.json()).policies || [])
      if (preauthRes.ok) setPreauthorizations((await preauthRes.json()).preauthorizations || [])
    } catch {
      // Silent load failure; the UI keeps the last known state.
    } finally {
      setLoading(false)
    }
  }, [patientId])

  useEffect(() => {
    void load()
  }, [load])

  const activePolicies = useMemo(() => policies.filter((policy) => policy.active), [policies])
  const requiredChecklist = useMemo<ChecklistItem[]>(() => {
    const typePresent = (documentType: PatientDocumentType) => docs.some((doc) => doc.type === documentType)
    const hasInsuranceCover = activePolicies.some((policy) => policy.payer_type !== "CORPORATE")
    const needsGuarantee = activePolicies.some(
      (policy) => policy.payer_type === "CORPORATE" || !!policy.employer_name || !!policy.scheme_stamp_required,
    )
    const needsPreauthPaper = preauthorizations.some((item) => item.status === "Approved") ||
      activePolicies.some((policy) => !!policy.authorization_required)
    const needsReferral = activePolicies.some((policy) => policy.payer_type === "HMO")
    const needsClaimForm = activePolicies.some((policy) => policy.verification_status === "Verified")

    return [
      {
        id: "id",
        title: "Identification",
        description: "Keep a patient or principal-member identity document on file for payer verification and billing disputes.",
        required: activePolicies.length > 0,
        complete: typePresent("ID"),
        suggestedType: "ID",
      },
      {
        id: "insurance",
        title: "Insurance / membership card",
        description: "Upload the current front or digital card showing the payer, membership number, and scheme details.",
        required: hasInsuranceCover,
        complete: typePresent("INSURANCE"),
        suggestedType: "INSURANCE",
      },
      {
        id: "guarantee",
        title: "Guarantee letter",
        description: "Corporate or sponsor-backed visits should carry an employer, school, NGO, or guarantor letter.",
        required: needsGuarantee,
        complete: typePresent("GUARANTEE"),
        suggestedType: "GUARANTEE",
      },
      {
        id: "referral",
        title: "Referral letter",
        description: "HMOs and managed-care schemes often need a referral or gatekeeper note before specialist or panel service.",
        required: false,
        complete: typePresent("REFERRAL"),
        suggestedType: "REFERRAL",
      },
      {
        id: "preauth",
        title: "Pre-authorization approval",
        description: "When the payer requests approval for admission, surgery, scans, maternity, or other services, keep the approval record here.",
        required: needsPreauthPaper,
        complete: typePresent("PREAUTH"),
        suggestedType: "PREAUTH",
      },
      {
        id: "claim-form",
        title: "Claim / reimbursement form",
        description: "Use this for payer reimbursement forms, signed claim packs, or billing documents prepared for submission.",
        required: false,
        complete: typePresent("CLAIM_FORM"),
        suggestedType: "CLAIM_FORM",
      },
      {
        id: "consent",
        title: "Consent / undertaking",
        description: "Signed financial undertaking or insurer-communication consent protects the facility when payer responses are delayed.",
        required: false,
        complete: typePresent("CONSENT"),
        suggestedType: "CONSENT",
      },
    ].filter((item) => item.required || item.complete || item.id === "referral" || item.id === "claim-form" || item.id === "consent") as ChecklistItem[]
  }, [activePolicies, docs, preauthorizations])

  const missingRequiredCount = requiredChecklist.filter((item) => item.required && !item.complete).length
  const selectedTypeDescription = getPatientDocumentTypeDescription(type)

  const jumpToAddForm = (nextType?: PatientDocumentType) => {
    try {
      if (nextType) setType(nextType)
      setHighlightChecklist(false)
      const el = document.getElementById(`patient-documents-add-${patientId}`)
      el?.scrollIntoView({ behavior: "smooth", block: "start" })
      // Nudge attention to file picker
      setTimeout(() => {
        const fileLabel = document.getElementById(`patient-document-file-label-${patientId}`)
        fileLabel?.focus?.()
      }, 300)
    } catch {}
  }

  useEffect(() => {
    const handler = ((ev: Event) => {
      const e = ev as CustomEvent
      if (e?.detail?.patientId && e.detail.patientId !== patientId) return
      setHighlightChecklist(true)
      try {
        const el = document.getElementById(`patient-documents-checklist-${patientId}`)
        el?.scrollIntoView({ behavior: "smooth", block: "start" })
      } catch {}
      setTimeout(() => setHighlightChecklist(false), 2500)
    }) as EventListener
    window.addEventListener("insuranceJumpToDocuments", handler)
    return () => window.removeEventListener("insuranceJumpToDocuments", handler)
  }, [patientId])

  const add = async () => {
    if (!file) {
      toast.error("Choose a file to upload")
      return
    }
    setAdding(true)
    try {
      const fd = new FormData()
      fd.append("file", file)
      fd.append("kind", "insurance")

      const up = await fetch("/api/upload", { method: "POST", body: fd, credentials: "include" })
      if (!up.ok) {
        const error = await up.json().catch(() => ({}))
        toast.error(error.error || "Upload failed")
        return
      }

      const { url, originalName, mimeType } = await up.json()
      if (!url) {
        toast.error("Upload failed")
        return
      }

      const res = await fetch("/api/documents", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId,
          type,
          fileUrl: url,
          notes: notes.trim() || undefined,
          fileName: originalName || file.name,
          mimeType: mimeType || file.type || undefined,
        }),
      })
      if (!res.ok) {
        const error = await res.json().catch(() => ({}))
        toast.error(error.error || "Failed to add document")
      } else {
        toast.success("Document added")
        setFile(null)
        setNotes("")
        await load()
      }
    } catch {
      toast.error("Failed to add document")
    } finally {
      setAdding(false)
    }
  }

  const deleteDocument = async (id: string) => {
    if (!window.confirm("Remove this document from the patient record?")) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/documents?id=${id}`, { method: "DELETE", credentials: "include" })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error || "Failed to remove document")
      } else {
        toast.success("Document removed")
        await load()
      }
    } catch {
      toast.error("Failed to remove document")
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <Card className="border-0 shadow-none">
      <CardHeader className="px-0 pt-0">
        <CardTitle>Documents</CardTitle>
        <CardDescription>Attach identity, insurance, guarantee, referral, and authorization paperwork so billing and clinical teams can act without guesswork.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 px-0 pb-0">
        <div className="grid gap-3 md:grid-cols-3">
          <InsuranceHoverNote
            title="Uploaded documents"
            description="This counts every insurance-related document saved on the patient file, regardless of type."
          >
            <div className="rounded-lg border bg-slate-50/80 p-3">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Documents</div>
              <div className="mt-2 text-2xl font-semibold text-slate-950">{docs.length}</div>
              <p className="text-xs text-muted-foreground">Insurance, IDs, guarantees, referrals, and claim paperwork.</p>
            </div>
          </InsuranceHoverNote>
          <InsuranceHoverNote
            title="Missing required items"
            description="These are documents the current active cover or authorization workflow still needs before billing is safe."
          >
            <div className="rounded-lg border bg-amber-50/70 p-3">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">Missing required</div>
              <div className="mt-2 text-2xl font-semibold text-amber-900">{missingRequiredCount}</div>
              <p className="text-xs text-muted-foreground">Use the checklist below to close the gaps.</p>
            </div>
          </InsuranceHoverNote>
          <InsuranceHoverNote
            title="Open authorizations"
            description="Approved or pending pre-authorizations usually need supporting paperwork kept on the patient file."
          >
            <div className="rounded-lg border bg-sky-50/70 p-3">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">Authorization trail</div>
              <div className="mt-2 text-2xl font-semibold text-sky-900">{preauthorizations.length}</div>
              <p className="text-xs text-muted-foreground">Pending and approved authorizations linked to the patient.</p>
            </div>
          </InsuranceHoverNote>
        </div>

        <div
          id={`patient-documents-checklist-${patientId}`}
          className={`rounded-lg border p-4 transition ${highlightChecklist ? "ring-2 ring-amber-300" : ""}`}
        >
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-foreground">Insurance document checklist</h3>
            <p className="text-xs text-muted-foreground">Hover each item to understand why it matters for Ugandan insurer, HMO, or corporate-guarantee workflows.</p>
          </div>
          <div className="grid gap-3">
            {requiredChecklist.map((item) => (
              <InsuranceHoverNote key={item.id} title={item.title} description={item.description}>
                <div className="flex items-start justify-between gap-3 rounded-lg border bg-white px-3 py-3">
                  <div>
                    <div className="font-medium text-foreground">{item.title}</div>
                    <div className="text-sm text-muted-foreground">
                      {item.required ? "Required for the current cover" : "Recommended where applicable"}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!item.complete && item.suggestedType ? (
                      <Button
                        size="sm"
                        variant={item.required ? "default" : "outline"}
                        onClick={() => jumpToAddForm(item.suggestedType)}
                      >
                        Upload
                      </Button>
                    ) : null}
                    <Badge variant={item.complete ? "default" : item.required ? "destructive" : "secondary"}>
                      {item.complete ? "On file" : item.required ? "Missing" : "Optional"}
                    </Badge>
                  </div>
                </div>
              </InsuranceHoverNote>
            ))}
          </div>
        </div>

        <div id={`patient-documents-add-${patientId}`} className="rounded-lg border p-4">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-foreground">Add document</h3>
            <p className="text-xs text-muted-foreground">
              Choose the correct document type so the next team can immediately understand what was uploaded.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <InsuranceFieldLabel htmlFor="patient-document-type" help="Use the type that best matches the original paperwork. This drives the checklist and helps billing retrieve the right file later.">
                Document type
              </InsuranceFieldLabel>
              <Select value={type} onValueChange={(value: PatientDocumentType) => setType(value)}>
                <SelectTrigger id="patient-document-type" aria-label="Document type" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PATIENT_DOCUMENT_TYPES.map((documentType) => (
                    <SelectItem key={documentType} value={documentType}>
                      {getPatientDocumentTypeLabel(documentType)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{selectedTypeDescription}</p>
            </div>

            <div className="space-y-2">
              <InsuranceFieldLabel htmlFor="patient-document-file" help="Upload a clear PDF or image. If the insurer sent an email or portal approval, save it as a PDF first where possible.">
                Select document file
              </InsuranceFieldLabel>
              <label
                htmlFor="patient-document-file"
                id={`patient-document-file-label-${patientId}`}
                tabIndex={0}
                className="flex min-h-10 cursor-pointer items-center rounded-md border border-input bg-background px-4 py-2 text-sm text-muted-foreground shadow-xs transition hover:bg-muted"
              >
                {file ? file.name : "Choose a PDF or image"}
              </label>
              <Input
                id="patient-document-file"
                name="patientDocumentFile"
                type="file"
                accept="image/*,.pdf"
                onChange={(event) => setFile(event.target.files && event.target.files[0] ? event.target.files[0] : null)}
                className="sr-only"
              />
            </div>
          </div>

          <div className="mt-4 space-y-2">
            <InsuranceFieldLabel htmlFor="patient-document-notes" help="Briefly describe what the file contains, for example card front, guarantee signed by HR, referral from panel clinic, or approved theatre authorization.">
              Document notes
            </InsuranceFieldLabel>
            <Textarea
              id="patient-document-notes"
              name="patientDocumentNotes"
              placeholder="Example: Guarantee letter signed by HR for admission, or approved MRI pre-authorization printout."
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={3}
            />
          </div>

          <div className="mt-4 flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              Uploads are visible to reception, billing, and clinical teams so they do not have to ask the patient for the same paperwork twice.
            </p>
            <Button onClick={add} disabled={adding || !file}>
              {adding ? "Adding..." : "Add Document"}
            </Button>
          </div>
        </div>

        <div className="rounded border divide-y" data-testid="patient-documents-list">
          {loading ? (
            <div className="p-3 text-sm text-muted-foreground">Loading...</div>
          ) : docs.length === 0 ? (
            <div className="p-3 text-sm text-muted-foreground">No documents</div>
          ) : (
            docs.map((document) => (
              <div
                key={document.id}
                data-document-name={document.original_name || ""}
                className="flex flex-col gap-2 p-3 text-sm md:flex-row md:items-center md:justify-between"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{getPatientDocumentTypeLabel(document.type)}</span>
                    <Badge variant="outline">{new Date(document.uploaded_at).toLocaleDateString()}</Badge>
                  </div>
                  {document.original_name ? <div className="text-muted-foreground">{document.original_name}</div> : null}
                  {document.notes ? <div className="text-muted-foreground">{document.notes}</div> : null}
                  <div className="text-xs text-muted-foreground">{getPatientDocumentTypeDescription(document.type)}</div>
                </div>
                <div className="flex items-center gap-2">
                  <a className="text-primary underline" href={document.file_url} target="_blank" rel="noreferrer">
                    Open
                  </a>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => deleteDocument(document.id)}
                    disabled={deletingId === document.id}
                  >
                    {deletingId === document.id ? "Removing..." : "Remove"}
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  )
}
