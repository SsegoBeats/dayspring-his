"use client"

import { useEffect, useMemo, useState } from "react"
import { useLab, type LabTest } from "@/lib/lab-context"
import { useAuth } from "@/lib/auth-context"
import { usePatients } from "@/lib/patient-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ArrowLeft, Save, XCircle, PlayCircle, Loader2, Printer, AlertCircle, FileDown, Plus, Trash2 } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { BarcodeGenerator } from "@/components/barcode-generator"
import { LabTestAttachments } from "@/components/lab/lab-test-attachments"
import { formatPatientNumber } from "@/lib/patients"
import { toast } from "sonner"
import { type ParameterRow, buildParameterRows, computeFlag, getTemplateForTest } from "@/lib/lab-parameters"

interface LabTestDetailsProps {
  testId: string
  onBack: () => void
}

interface StructuredResult {
  value: string
  units: string
  interpretation: string
  reference: string
}

const DEFAULT_REJECTION_REASON = ""

function buildStructuredResult(test?: LabTest | null): StructuredResult {
  const source = test?.resultJson && typeof test.resultJson === "object" ? test.resultJson : {}
  return {
    value: source.value ? String(source.value) : "",
    units: source.units ? String(source.units) : test?.loincUnits || "",
    interpretation: source.interpretation ? String(source.interpretation) : "",
    reference: source.reference ? String(source.reference) : "",
  }
}

export function LabTestDetails({ testId, onBack }: LabTestDetailsProps) {
  const { tests, updateTest } = useLab()
  const { user } = useAuth()
  const { getPatient } = usePatients()
  const contextTest = tests.find((item) => item.id === testId)
  const [remoteTest, setRemoteTest] = useState<LabTest | null>(null)
  const [loadingTest, setLoadingTest] = useState(false)
  const test = contextTest ?? remoteTest
  const patient = test ? getPatient(test.patientId) : null
  const patientNumber = test?.patientNumber || formatPatientNumber(patient?.patientNumber)

  const [results, setResults] = useState("")
  const [notes, setNotes] = useState("")
  const [specimenType, setSpecimenType] = useState("")
  const [structured, setStructured] = useState<StructuredResult>(buildStructuredResult(contextTest))
  const [paramRows, setParamRows] = useState<ParameterRow[]>([])
  const [loadingParams, setLoadingParams] = useState(false)
  const [verified, setVerified] = useState(false)
  const [saving, setSaving] = useState(false)
  const [starting, setStarting] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false)
  const [rejectionReason, setRejectionReason] = useState(DEFAULT_REJECTION_REASON)
  const [customRejectionReason, setCustomRejectionReason] = useState("")

  const role = (user?.role || "").toLowerCase()
  const isLabTech = role.includes("lab")
  const loincTitle = useMemo(() => test?.loincLongName || test?.testName || "Lab Result", [test])
  const activeRejectionReason = rejectionReason === "Other" ? customRejectionReason.trim() : rejectionReason.trim()
  const canEditResults = Boolean(
    isLabTech &&
      test &&
      test.status.toLowerCase() !== "completed" &&
      test.status.toLowerCase() !== "cancelled",
  )

  useEffect(() => {
    let ignore = false
    if (contextTest) {
      setLoadingTest(false)
      return
    }

    setLoadingTest(true)
    ;(async () => {
      try {
        const response = await fetch(`/api/lab-tests/${testId}`, { credentials: "include" })
        if (!response.ok) {
          const data = await response.json().catch(() => ({}))
          throw new Error(data.error || "Failed to load test")
        }
        const data = await response.json()
        if (!ignore) {
          setRemoteTest(data.test || null)
        }
      } catch (error: any) {
        if (!ignore) {
          toast.error(error?.message || "Failed to load test")
        }
      } finally {
        if (!ignore) {
          setLoadingTest(false)
        }
      }
    })()

    return () => {
      ignore = true
    }
  }, [contextTest, testId])

  useEffect(() => {
    if (!test) return
    setResults(test.results || "")
    setNotes(test.notes || "")
    setSpecimenType(test.specimenType || "")
    setStructured(buildStructuredResult(test))
    setVerified(test.status.toLowerCase() === "completed")
    setRejectionReason(DEFAULT_REJECTION_REASON)
    setCustomRejectionReason("")
  }, [test])

  useEffect(() => {
    setStructured((current) => ({
      ...current,
      units: current.units || test?.loincUnits || "",
    }))
  }, [test?.loincUnits])

  // Auto-load parameter rows when test opens in "In Progress" state
  useEffect(() => {
    if (!test || test.status.toLowerCase() !== "in progress") return

    // If existing resultJson already has parameters, restore them
    const existing = test.resultJson
    if (existing && typeof existing === "object" && Array.isArray((existing as any).parameters)) {
      const savedParams: ParameterRow[] = (existing as any).parameters.map((p: any) => ({
        name: p.name || "",
        value: p.value || "",
        units: p.units || "",
        reference: p.reference || "",
        flag: p.flag || "",
        active: p.active !== false,
      }))
      if (savedParams.length > 0) {
        setParamRows(savedParams)
        return
      }
    }

    // Tier 1: hardcoded template
    const tier1 = getTemplateForTest(test.testName || "")
    if (tier1 && tier1.length > 0) {
      setParamRows(buildParameterRows(tier1))
      return
    }

    // Tier 2: LOINC panel API
    if (test.loincCode) {
      setLoadingParams(true)
      fetch(`/api/lab-panels?loincCode=${encodeURIComponent(test.loincCode)}`, { credentials: "include" })
        .then((r) => r.json())
        .then((data) => {
          const params = Array.isArray(data.parameters) ? data.parameters : []
          if (params.length > 0) {
            setParamRows(buildParameterRows(params))
          } else {
            // Tier 3: start with one blank row
            setParamRows([{ name: "", value: "", units: "", reference: "", flag: "", active: true }])
          }
        })
        .catch(() => {
          setParamRows([{ name: "", value: "", units: "", reference: "", flag: "", active: true }])
        })
        .finally(() => setLoadingParams(false))
      return
    }

    // Tier 3: no template, no LOINC — one blank row
    setParamRows([{ name: "", value: "", units: "", reference: "", flag: "", active: true }])
  }, [test?.id, test?.status]) // eslint-disable-line react-hooks/exhaustive-deps

  const patchLocalTest = (updates: Partial<LabTest>) => {
    updateTest(testId, updates)
    setRemoteTest((current) => (current ? { ...current, ...updates } : current))
  }

  const buildCompiledResults = () => {
    // Build from parameter rows if any active rows have values
    const activeRows = paramRows.filter((r) => r.active && r.value.trim())
    if (activeRows.length > 0) {
      const lines = activeRows.map((r) => {
        const ref = r.reference ? ` (Ref: ${r.reference})` : ""
        const flag = r.flag && r.flag !== "Normal" ? ` [${r.flag.toUpperCase()}]` : r.flag === "Normal" ? " [Normal]" : ""
        return `${r.name}: ${r.value}${r.units ? ` ${r.units}` : ""}${ref}${flag}`
      })
      return [lines.join("\n"), results.trim()].filter(Boolean).join("\n\n")
    }
    // Fallback: legacy single-value structured entry
    const summaryParts: string[] = []
    if (structured.value) {
      summaryParts.push(`Value: ${structured.value}${structured.units ? ` ${structured.units}` : ""}`)
    }
    if (structured.reference) summaryParts.push(`Reference: ${structured.reference}`)
    if (structured.interpretation) summaryParts.push(`Interpretation: ${structured.interpretation}`)
    return [summaryParts.join("\n"), results.trim()].filter(Boolean).join("\n\n")
  }

  const handleStartCollection = async () => {
    if (!test || !specimenType.trim()) {
      toast.error("Enter a specimen type before starting collection")
      return
    }

    const collectedAt = new Date().toISOString()
    setStarting(true)
    try {
      const response = await fetch(`/api/lab-tests/${test.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "In Progress",
          specimenType: specimenType.trim(),
          collectedAt,
        }),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || "Failed to start collection")
      }

      patchLocalTest({
        status: "In Progress",
        specimenType: specimenType.trim(),
        collectedAt,
        labTechId: user?.id || test.labTechId || null,
        labTechName: user?.name || test.labTechName,
      })
      setVerified(false)
      toast.success("Specimen collection started")
    } catch (error: any) {
      toast.error(error?.message || "Failed to start collection")
    } finally {
      setStarting(false)
    }
  }

  const handleSubmitResults = async () => {
    if (!test) return

    const compiledResults = buildCompiledResults()
    if (!compiledResults.trim()) {
      toast.error("Please enter test results")
      return
    }
    if (!verified) {
      toast.error("Please verify the results before submission")
      return
    }

    setSaving(true)
    try {
      const response = await fetch(`/api/lab-tests/${test.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "Completed",
          results: compiledResults,
          notes,
          resultJson: paramRows.some((r) => r.active && r.value.trim())
            ? { parameters: paramRows.filter((r) => r.active) }
            : structured,
          specimenType: specimenType.trim() || test.specimenType,
        }),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || "Failed to submit results")
      }

      patchLocalTest({
        status: "Completed",
        completedAt: new Date().toISOString(),
        results: compiledResults,
        notes,
        resultJson: structured,
        specimenType: specimenType.trim() || test.specimenType,
        labTechId: user?.id || test.labTechId || null,
        labTechName: user?.name || test.labTechName,
      })
      toast.success("Results submitted successfully")
      onBack()
    } catch (error: any) {
      toast.error(error?.message || "Failed to submit results")
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = async () => {
    if (!test) return

    setCancelling(true)
    try {
      const response = await fetch(`/api/lab-tests/${test.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "Cancelled",
          notes,
        }),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || "Failed to cancel test")
      }

      patchLocalTest({
        status: "Cancelled",
        notes,
      })
      toast.success("Test cancelled")
      onBack()
    } catch (error: any) {
      toast.error(error?.message || "Failed to cancel test")
    } finally {
      setCancelling(false)
    }
  }

  const handleRejectSpecimen = async () => {
    if (!test) return
    if (!activeRejectionReason) {
      toast.error("Provide a reason for rejecting the specimen")
      return
    }

    setRejecting(true)
    try {
      const response = await fetch(`/api/lab-tests/${test.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "Cancelled",
          rejectionReason: activeRejectionReason,
          notes,
        }),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || "Failed to reject specimen")
      }

      patchLocalTest({
        status: "Cancelled",
        rejectionReason: activeRejectionReason,
        notes,
      })
      setRejectDialogOpen(false)
      setRejectionReason(DEFAULT_REJECTION_REASON)
      setCustomRejectionReason("")
      toast.success("Specimen rejected")
      onBack()
    } catch (error: any) {
      toast.error(error?.message || "Failed to reject specimen")
    } finally {
      setRejecting(false)
    }
  }

  if (loadingTest && !test) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center gap-3 p-8 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading test details...
        </CardContent>
      </Card>
    )
  }

  if (!test) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <p className="text-muted-foreground">Test not found.</p>
          <Button onClick={onBack} className="mt-4">
            Go Back
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-5">
      <Button variant="outline" onClick={onBack}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Queue
      </Button>

      <Card className="overflow-hidden border-sky-100 shadow-sm">
        <CardHeader className="bg-[radial-gradient(ellipse_at_top_left,_rgba(14,165,233,0.12),_transparent_55%),linear-gradient(135deg,_rgba(240,249,255,1),_rgba(255,255,255,0.97))] pb-5">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="border-sky-200 bg-sky-100/70 text-sky-900">
                  {test.testType}
                </Badge>
                <Badge
                  variant={test.priority?.toLowerCase() === "stat" ? "destructive" : "secondary"}
                  className={test.priority?.toLowerCase() === "stat" ? "animate-none shadow-[0_0_6px_rgba(239,68,68,0.4)]" : "bg-amber-100 text-amber-900"}
                >
                  {test.priority || "Routine"}
                </Badge>
                <Badge
                  variant={
                    test.status.toLowerCase() === "completed"
                      ? "default"
                      : test.status.toLowerCase() === "pending"
                        ? "secondary"
                        : "outline"
                  }
                  className={test.status.toLowerCase() === "completed" ? "bg-emerald-600 text-white" : test.status.toLowerCase() === "in progress" ? "border-cyan-300 bg-cyan-50 text-cyan-800" : ""}
                >
                  {test.status}
                </Badge>
                {test.loincCode ? (
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 font-mono text-[10px] text-muted-foreground">LOINC {test.loincCode}</span>
                ) : null}
              </div>
              <div>
                <CardTitle className="text-2xl tracking-tight">{test.testName || test.testType}</CardTitle>
                {test.loincLongName && test.loincLongName !== test.testName ? (
                  <p className="mt-0.5 text-xs text-muted-foreground">{test.loincLongName}</p>
                ) : null}
                <CardDescription className="mt-1 font-mono text-xs">ID: {test.id}</CardDescription>
              </div>
              <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                <div>Patient: <span className="font-medium text-foreground">{test.patientName}</span></div>
                <div>P.ID: <span className="font-mono text-foreground">{patientNumber}</span></div>
                <div>Clinician: <span className="text-foreground">{test.doctorName || "—"}</span></div>
                <div>Specimen: <span className="text-foreground">{test.specimenType || specimenType || "—"}</span></div>
                {test.labTechName ? <div>Assigned: <span className="text-foreground">{test.labTechName}</span></div> : null}
              </div>
            </div>

            {test.accessionNumber ? (
              <div className="rounded-2xl border border-sky-100 bg-white/90 p-4 shadow-sm">
                <div className="mb-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">Accession</div>
                <div className="mb-3 font-mono text-sm font-semibold text-foreground">{test.accessionNumber}</div>
                <BarcodeGenerator value={test.accessionNumber} width={2} height={40} displayValue={true} />
              </div>
            ) : null}
          </div>
        </CardHeader>

        <CardContent className="space-y-6 p-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <InfoTile label="Ordered" value={new Date(test.orderedAt).toLocaleString()} />
            <InfoTile label="Collected" value={test.collectedAt ? new Date(test.collectedAt).toLocaleString() : "-"} />
            <InfoTile label="Completed" value={test.completedAt ? new Date(test.completedAt).toLocaleString() : "-"} />
            <InfoTile label="Assigned To" value={test.labTechName || "Unassigned"} />
          </div>

          {test.rejectionReason ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Rejected specimen:</strong> {test.rejectionReason}
              </AlertDescription>
            </Alert>
          ) : null}

          {test.status.toLowerCase() === "completed" ? (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => window.open(`/lab-tests/${test.id}/print`, "_blank", "noopener,noreferrer")}>
                <Printer className="mr-2 h-4 w-4" />
                Print Result
              </Button>
              <Button variant="outline" size="sm" onClick={() => window.open(`/api/lab-tests/${test.id}/pdf`, "_blank", "noopener,noreferrer")}>
                <FileDown className="mr-2 h-4 w-4" />
                Download PDF
              </Button>
            </div>
          ) : null}

          {canEditResults ? (
            <div className="space-y-4">
              {test.status.toLowerCase() === "pending" ? (
                <Card className="border-blue-200 bg-blue-50/50">
                  <CardHeader>
                    <CardTitle className="text-sm">Start Specimen Collection</CardTitle>
                    <CardDescription>
                      Record the specimen type to move this order into active processing.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="specimenType">Specimen Type</Label>
                      <Input
                        id="specimenType"
                        value={specimenType}
                        onChange={(event) => setSpecimenType(event.target.value)}
                        placeholder="Blood, Urine, Stool, Swab..."
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button onClick={handleStartCollection} disabled={starting || !specimenType.trim()} className="bg-sky-600 hover:bg-sky-700">
                        {starting ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Starting...
                          </>
                        ) : (
                          <>
                            <PlayCircle className="mr-2 h-4 w-4" />
                            Start Collection
                          </>
                        )}
                      </Button>
                      <Button variant="destructive" onClick={() => setRejectDialogOpen(true)} disabled={starting}>
                        <XCircle className="mr-2 h-4 w-4" />
                        Reject Specimen
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : null}

              {test.status.toLowerCase() === "in progress" ? (
                <>
                  {test.collectedAt ? (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        Specimen collected on {new Date(test.collectedAt).toLocaleString()}.
                      </AlertDescription>
                    </Alert>
                  ) : null}

                  <Card className="border-slate-200 bg-white">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Result Parameters — {loincTitle}</CardTitle>
                      <CardDescription>
                        Tick parameters you are running. Unticked rows are skipped. Values outside the reference range are flagged automatically.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {loadingParams ? (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Loading parameters…
                        </div>
                      ) : (
                        <>
                          {/* Column headers */}
                          <div className="grid grid-cols-[auto_1fr_18%_14%_22%_12%] gap-2 items-center text-xs font-semibold text-muted-foreground pb-1 border-b">
                            <span />
                            <span>Parameter</span>
                            <span>Value</span>
                            <span>Units</span>
                            <span>Reference</span>
                            <span>Flag</span>
                          </div>
                          {paramRows.map((row, idx) => (
                            <div key={idx} className="grid grid-cols-[auto_1fr_18%_14%_22%_12%] gap-2 items-center">
                              {/* Active checkbox */}
                              <Checkbox
                                id={`param-active-${idx}`}
                                checked={row.active}
                                onCheckedChange={(checked) =>
                                  setParamRows((prev) =>
                                    prev.map((r, i) => i === idx ? { ...r, active: checked === true } : r)
                                  )
                                }
                              />
                              {/* Parameter name */}
                              <Input
                                id={`param-name-${idx}`}
                                name={`paramName${idx}`}
                                autoComplete="off"
                                value={row.name}
                                onChange={(e) =>
                                  setParamRows((prev) =>
                                    prev.map((r, i) => i === idx ? { ...r, name: e.target.value } : r)
                                  )
                                }
                                placeholder="Parameter name"
                                className="text-xs h-8"
                                disabled={!row.active}
                              />
                              {/* Value */}
                              <Input
                                id={`param-value-${idx}`}
                                name={`paramValue${idx}`}
                                autoComplete="off"
                                value={row.value}
                                onChange={(e) => {
                                  const val = e.target.value
                                  setParamRows((prev) =>
                                    prev.map((r, i) =>
                                      i === idx
                                        ? { ...r, value: val, flag: computeFlag(val, r.reference) }
                                        : r
                                    )
                                  )
                                }}
                                placeholder="—"
                                className="text-xs h-8"
                                disabled={!row.active}
                              />
                              {/* Units */}
                              <Input
                                id={`param-units-${idx}`}
                                name={`paramUnits${idx}`}
                                autoComplete="off"
                                value={row.units}
                                onChange={(e) =>
                                  setParamRows((prev) =>
                                    prev.map((r, i) => i === idx ? { ...r, units: e.target.value } : r)
                                  )
                                }
                                placeholder="—"
                                className="text-xs h-8"
                                disabled={!row.active}
                              />
                              {/* Reference */}
                              <Input
                                id={`param-ref-${idx}`}
                                name={`paramRef${idx}`}
                                autoComplete="off"
                                value={row.reference}
                                onChange={(e) => {
                                  const ref = e.target.value
                                  setParamRows((prev) =>
                                    prev.map((r, i) =>
                                      i === idx
                                        ? { ...r, reference: ref, flag: computeFlag(r.value, ref) }
                                        : r
                                    )
                                  )
                                }}
                                placeholder="e.g. 4.0–11.0"
                                className="text-xs h-8"
                                disabled={!row.active}
                              />
                              {/* Flag + delete */}
                              <div className="flex items-center gap-1">
                                <span className={`text-xs font-medium w-14 truncate ${
                                  row.flag === "High" || row.flag === "Critical" ? "text-red-600" :
                                  row.flag === "Low" ? "text-amber-600" :
                                  row.flag === "Normal" ? "text-emerald-600" : "text-muted-foreground"
                                }`}>
                                  {row.flag || "—"}
                                </span>
                                <button
                                  type="button"
                                  aria-label="Remove row"
                                  onClick={() => setParamRows((prev) => prev.filter((_, i) => i !== idx))}
                                  className="text-muted-foreground hover:text-destructive"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}
                          {/* Add custom row */}
                          <button
                            type="button"
                            onClick={() =>
                              setParamRows((prev) => [
                                ...prev,
                                { name: "", value: "", units: "", reference: "", flag: "", active: true },
                              ])
                            }
                            className="flex items-center gap-1.5 text-xs text-sky-600 hover:text-sky-700 mt-1"
                          >
                            <Plus className="h-3.5 w-3.5" />
                            Add custom row
                          </button>
                        </>
                      )}
                    </CardContent>
                  </Card>

                  <div className="space-y-2">
                    <Label htmlFor="results">Results</Label>
                    <Textarea
                      id="results"
                      rows={8}
                      value={results}
                      onChange={(event) => setResults(event.target.value)}
                      placeholder="Enter free-text findings or paste analyzer output..."
                    />
                    <p className="text-xs text-muted-foreground">
                      Structured values above will be appended automatically when you submit.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea
                      id="notes"
                      rows={4}
                      value={notes}
                      onChange={(event) => setNotes(event.target.value)}
                      placeholder="Additional handling notes, caveats, or comments"
                    />
                  </div>

                  <div className={`flex items-start gap-3 rounded-2xl border p-4 transition-colors ${verified ? "border-emerald-200 bg-emerald-50/80" : "border-slate-200 bg-slate-50/60"}`}>
                    <Checkbox
                      id="verify-results"
                      checked={verified}
                      onCheckedChange={(checked) => setVerified(checked === true)}
                      className="mt-0.5"
                    />
                    <div>
                      <Label htmlFor="verify-results" className="cursor-pointer text-sm font-medium">
                        {verified ? "Results verified and ready for clinician review." : "Verify results before submission"}
                      </Label>
                      {!verified && (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          Confirm all structured values and free-text findings are accurate.
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      onClick={handleSubmitResults}
                      className="bg-emerald-600 hover:bg-emerald-700"
                      disabled={saving || !verified || !buildCompiledResults().trim()}
                    >
                      {saving ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Submitting...
                        </>
                      ) : (
                        <>
                          <Save className="mr-2 h-4 w-4" />
                          Submit Results
                        </>
                      )}
                    </Button>
                    <Button variant="outline" onClick={() => setRejectDialogOpen(true)} disabled={rejecting}>
                      <XCircle className="mr-2 h-4 w-4" />
                      Reject Specimen
                    </Button>
                    <Button variant="destructive" onClick={handleCancel} disabled={cancelling}>
                      {cancelling ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Cancelling...
                        </>
                      ) : (
                        <>
                          <XCircle className="mr-2 h-4 w-4" />
                          Cancel Test
                        </>
                      )}
                    </Button>
                  </div>
                </>
              ) : null}
            </div>
          ) : (
            <div className="space-y-4">
              {test.results ? (
                <div className="space-y-2">
                  <h3 className="font-semibold text-foreground">Results</h3>
                  <div className="rounded-2xl border bg-muted/40 p-4">
                    <p className="whitespace-pre-wrap text-sm text-foreground">{test.results}</p>
                  </div>
                  {test.reviewedAt ? (
                    <div className="text-xs text-muted-foreground">
                      Reviewed {new Date(test.reviewedAt).toLocaleString()}
                      {test.reviewedBy ? ` by ${test.reviewedBy}` : ""}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {test.notes ? (
                <div className="space-y-2">
                  <h3 className="font-semibold text-foreground">Notes</h3>
                  <div className="rounded-2xl border bg-muted/40 p-4">
                    <p className="whitespace-pre-wrap text-sm text-foreground">{test.notes}</p>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>

      {isLabTech ? (
        <LabTestAttachments
          patientId={test.patientId}
          patientName={test.patientName}
          testId={test.id}
          testName={test.testName || test.testType}
          accessionNumber={test.accessionNumber}
        />
      ) : null}

      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Specimen</DialogTitle>
            <DialogDescription>
              Record a rejection reason. The order will be cancelled and the ordering clinician will be notified.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="rejectionReason">Rejection Reason</Label>
              <Select value={rejectionReason} onValueChange={setRejectionReason}>
                <SelectTrigger id="rejectionReason">
                  <SelectValue placeholder="Select a reason" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Insufficient volume">Insufficient volume</SelectItem>
                  <SelectItem value="Wrong specimen type">Wrong specimen type</SelectItem>
                  <SelectItem value="Specimen contamination">Specimen contamination</SelectItem>
                  <SelectItem value="Specimen hemolyzed">Specimen hemolyzed</SelectItem>
                  <SelectItem value="Specimen clotted">Specimen clotted</SelectItem>
                  <SelectItem value="Specimen expired">Specimen expired</SelectItem>
                  <SelectItem value="Improper labeling">Improper labeling</SelectItem>
                  <SelectItem value="Specimen leaked">Specimen leaked</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {rejectionReason === "Other" ? (
              <div className="space-y-2">
                <Label htmlFor="customReason">Custom Reason</Label>
                <Textarea
                  id="customReason"
                  rows={3}
                  value={customRejectionReason}
                  onChange={(event) => setCustomRejectionReason(event.target.value)}
                  placeholder="Enter the rejection reason"
                />
              </div>
            ) : null}

            {activeRejectionReason ? (
              <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                Final reason: <span className="font-medium text-foreground">{activeRejectionReason}</span>
              </div>
            ) : null}

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setRejectDialogOpen(false)
                  setRejectionReason(DEFAULT_REJECTION_REASON)
                  setCustomRejectionReason("")
                }}
              >
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleRejectSpecimen} disabled={rejecting || !activeRejectionReason}>
                {rejecting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Rejecting...
                  </>
                ) : (
                  <>
                    <XCircle className="mr-2 h-4 w-4" />
                    Reject Specimen
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function InfoTile({ label, value }: { label: string; value: string }) {
  const empty = value === "—" || value === "-"
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 transition-colors hover:border-slate-300">
      <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">{label}</div>
      <div className={`mt-2 text-sm font-medium ${empty ? "text-muted-foreground/60" : "text-foreground"}`}>{value}</div>
    </div>
  )
}
