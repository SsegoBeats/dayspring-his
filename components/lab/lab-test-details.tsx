"use client"

import { useEffect, useMemo, useState } from "react"
import { useLab } from "@/lib/lab-context"
import { useAuth } from "@/lib/auth-context"
import { usePatients } from "@/lib/patient-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ArrowLeft, Save, XCircle, PlayCircle, Loader2, Printer, AlertCircle } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { BarcodeGenerator } from "@/components/barcode-generator"
import { formatPatientNumber } from "@/lib/patients"
import { toast } from "sonner"

interface LabTestDetailsProps {
  testId: string
  onBack: () => void
}

export function LabTestDetails({ testId, onBack }: LabTestDetailsProps) {
  const { tests, updateTest } = useLab()
  const { user } = useAuth()
  const { getPatient } = usePatients()
  const test = tests.find((lr) => lr.id === testId)
  const patient = test ? getPatient(test.patientId) : null

  const [results, setResults] = useState(test?.results || "")
  const [notes, setNotes] = useState(test?.notes || "")
  const [specimenType, setSpecimenType] = useState(test?.specimenType || "")
  const [saving, setSaving] = useState(false)
  const [starting, setStarting] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false)
  const [rejectionReason, setRejectionReason] = useState('')
  const [verified, setVerified] = useState(false)
  const role = (user?.role || '').toLowerCase()
  const isLabTech = role.includes('lab')
  const [structured, setStructured] = useState<any>(() => test?.resultJson || { value: '', units: test?.loincUnits || '', interpretation: '', reference: '' })
  
  // Update local state when test changes
  useEffect(() => {
    if (test) {
      setResults(test.results || "")
      setNotes(test.notes || "")
      setSpecimenType(test.specimenType || "")
      setStructured(test.resultJson || { value: '', units: test.loincUnits || '', interpretation: '', reference: '' })
    }
  }, [test])

  useEffect(() => {
    setStructured((prev:any) => ({
      ...prev,
      units: prev.units || test?.loincUnits || '',
    }))
  }, [test?.loincUnits])

  const loincTitle = useMemo(() => test?.loincLongName || test?.testName, [test])

  if (!test) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <p className="text-muted-foreground">Test not found</p>
          <Button onClick={onBack} className="mt-4">Go Back</Button>
        </CardContent>
      </Card>
    )
  }

  const handleSubmitResults = async () => {
    if (!results.trim() && !structured.value) {
      toast.error('Please enter test results')
      return
    }
    if (!verified) {
      toast.error('Please verify results before submission')
      return
    }
    setSaving(true)
    try {
      const parts: string[] = []
      if (structured.value) parts.push(`Value: ${structured.value}${structured.units ? ' ' + structured.units : ''}`)
      if (structured.reference) parts.push(`Reference: ${structured.reference}`)
      if (structured.interpretation) parts.push(`Interpretation: ${structured.interpretation}`)
      const summary = parts.join('\n')
      const compiled = [summary, results].filter(Boolean).join('\n\n')
      
      const res = await fetch(`/api/lab-tests/${test.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          status: 'Completed', 
          results: compiled, 
          notes,
          resultJson: structured,
          specimenType: specimenType.trim() || test.specimenType
        })
      })
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to submit results')
      }
      updateTest(test.id, { 
        status: 'Completed' as any, 
        completedAt: new Date().toISOString(), 
        results: compiled, 
        notes,
        resultJson: structured,
        specimenType: specimenType.trim() || test.specimenType
      })
      toast.success('Test results submitted successfully!')
      onBack()
    } catch (e: any) {
      toast.error(e?.message || 'Failed to submit results')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <Button variant="outline" onClick={onBack}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Queue
      </Button>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{test.testType}</CardTitle>
              <CardDescription>Test ID: {test.id}</CardDescription>
            </div>
            {test.accessionNumber && (
              <div className="text-right">
                <div className="mb-2 text-xs">Accession: <span className="font-mono">{test.accessionNumber}</span></div>
                <div className="inline-block">
                  <BarcodeGenerator value={test.accessionNumber} width={2} height={40} displayValue={true} />
                </div>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 text-sm">
              <div><span className="text-muted-foreground">Patient:</span> <span className="text-foreground">{test.patientName}</span></div>
              <div><span className="text-muted-foreground">P.ID:</span> <span className="font-mono">{formatPatientNumber((patient as any)?.patientNumber) || test.patientId}</span></div>
              <div><span className="text-muted-foreground">Clinician:</span> <span className="text-foreground">{test.doctorName || '-'}</span></div>
              <div><span className="text-muted-foreground">Ordered:</span> <span className="text-foreground">{new Date(test.orderedAt).toLocaleString()}</span></div>
            </div>
            <div className="space-y-2 text-sm">
              <div><span className="text-muted-foreground">Priority:</span> <Badge variant={test.priority?.toLowerCase() === 'stat' ? 'destructive' : 'outline'}>{test.priority || 'Routine'}</Badge></div>
              <div><span className="text-muted-foreground">Specimen:</span> <span className="text-foreground">{test.specimenType || '-'}</span></div>
              {test.collectedAt && (
                <div><span className="text-muted-foreground">Collected:</span> <span className="text-foreground">{new Date(test.collectedAt).toLocaleString()}</span></div>
              )}
              {test.completedAt && (
                <div><span className="text-muted-foreground">Completed:</span> <span className="text-foreground">{new Date(test.completedAt).toLocaleString()}</span></div>
              )}
              <div><span className="text-muted-foreground">Status:</span> <Badge variant={test.status.toLowerCase()==='completed'? 'default' : test.status.toLowerCase()==='pending'? 'secondary': test.status.toLowerCase() === 'in progress' ? 'default' : 'outline'}>{test.status}</Badge></div>
              {test.labTechName && (
                <div><span className="text-muted-foreground">Assigned To:</span> <span className="text-foreground">{test.labTechName}</span></div>
              )}
              {test.rejectionReason && (
                <Alert variant="destructive" className="mt-2">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Rejected:</strong> {test.rejectionReason}
                  </AlertDescription>
                </Alert>
              )}
              {test.status.toLowerCase() === 'completed' && (
                <div className="flex gap-2 pt-2">
                  <Button variant="outline" size="sm" onClick={() => window.open(`/lab-tests/${test.id}/print`, '_blank')}>
                    <Printer className="mr-2 h-4 w-4" />
                    Print Result
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => window.open(`/api/lab-tests/${test.id}/pdf`, '_blank')}>
                    Download PDF
                  </Button>
                </div>
              )}
            </div>
          </div>

          {isLabTech && test.status.toLowerCase() !== 'completed' && test.status.toLowerCase() !== 'cancelled' ? (
            <div className="space-y-4">
              {/* Specimen Collection Section */}
              {test.status.toLowerCase() === 'pending' && (
                <Card className="border-blue-200 bg-blue-50/40">
                  <CardHeader>
                    <CardTitle className="text-sm">Start Specimen Collection</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor="specimenType">Specimen Type *</Label>
                      <Input
                        id="specimenType"
                        placeholder="e.g., Blood, Urine, Stool, Swab"
                        value={specimenType}
                        onChange={(e) => setSpecimenType(e.target.value)}
                        required
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        onClick={handleStartCollection} 
                        disabled={starting || !specimenType.trim()}
                        className="flex-1"
                      >
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
                      <Button 
                        variant="destructive" 
                        onClick={() => setRejectDialogOpen(true)}
                        disabled={starting}
                      >
                        <XCircle className="mr-2 h-4 w-4" />
                        Reject Specimen
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Results Entry Section */}
              {test.status.toLowerCase() === 'in progress' && (
                <>
                  {test.collectedAt && (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        Specimen collected: {new Date(test.collectedAt).toLocaleString()}
                      </AlertDescription>
                    </Alert>
                  )}
                  {test.status.toLowerCase() === 'in progress' && (
                    <div className="flex items-center gap-2 p-3 border rounded-md bg-muted/30">
                      <Checkbox
                        id="verify-results"
                        checked={verified}
                        onCheckedChange={(checked) => setVerified(checked === true)}
                      />
                      <Label htmlFor="verify-results" className="text-sm cursor-pointer">
                        I have verified these results are accurate and complete
                      </Label>
                    </div>
                  )}
                  <div className="rounded-md border p-3 space-y-3">
                    <div className="text-sm font-medium">Structured entry for {loincTitle}</div>
                    <div className="grid md:grid-cols-3 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Value</Label>
                        <Input
                          value={structured.value || ''}
                          onChange={(e) => setStructured({ ...structured, value: e.target.value })}
                          placeholder="Enter value"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Units</Label>
                        <Input
                          value={structured.units || ''}
                          onChange={(e) => setStructured({ ...structured, units: e.target.value })}
                          placeholder={test.loincUnits || 'Units'}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Reference Range</Label>
                        <Input
                          value={structured.reference || ''}
                          onChange={(e) => setStructured({ ...structured, reference: e.target.value })}
                          placeholder="e.g., 3.9-7.8"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Interpretation</Label>
                      <Textarea
                        rows={3}
                        value={structured.interpretation || ''}
                        onChange={(e) => setStructured({ ...structured, interpretation: e.target.value })}
                        placeholder="Clinical interpretation or notes"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="results">Results (free text) *</Label>
                    <Textarea
                      id="results"
                      rows={6}
                      value={results}
                      onChange={(e) => setResults(e.target.value)}
                      placeholder="Enter test results or paste from analyzer..."
                      required
                    />
                    <p className="text-xs text-muted-foreground">
                      Structured values above will be automatically included if provided
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea
                      id="notes"
                      rows={3}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Additional notes or comments"
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button 
                      onClick={handleSubmitResults} 
                      className="flex-1"
                      disabled={saving || (!results.trim() && !structured.value) || !verified}
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
                    <Button 
                      variant="outline" 
                      onClick={() => setRejectDialogOpen(true)}
                      disabled={rejecting}
                    >
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
                    <Button 
                      variant="destructive" 
                      onClick={handleCancel}
                      disabled={cancelling}
                    >
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
                  {!verified && (
                    <p className="text-xs text-muted-foreground">
                      Please verify results before submission
                    </p>
                  )}
                </>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {test.results && (
                <div className="space-y-2">
                  <h3 className="font-semibold text-foreground">Results</h3>
                  <div className="rounded-lg border border-border bg-muted/50 p-4">
                    <p className="text-sm text-foreground whitespace-pre-wrap">{test.results}</p>
                  </div>
                  {test.reviewedAt && (
                    <div className="text-xs text-muted-foreground">Reviewed {new Date(test.reviewedAt).toLocaleString()} {test.reviewedBy ? `by ${test.reviewedBy}` : ''}</div>
                  )}
                </div>
              )}
              {test.notes && (
                <div className="space-y-2">
                  <h3 className="font-semibold text-foreground">Notes</h3>
                  <div className="rounded-lg border border-border bg-muted/50 p-4">
                    <p className="text-sm text-foreground whitespace-pre-wrap">{test.notes}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reject Specimen Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Specimen</DialogTitle>
            <DialogDescription>
              Provide a reason for rejecting this specimen. The test will be cancelled and the ordering clinician will be notified.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="rejectionReason">Rejection Reason *</Label>
              <Select value={rejectionReason} onValueChange={setRejectionReason}>
                <SelectTrigger>
                  <SelectValue placeholder="Select reason" />
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
            {rejectionReason === 'Other' && (
              <div className="space-y-2">
                <Label htmlFor="customReason">Specify Reason</Label>
                <Textarea
                  id="customReason"
                  placeholder="Enter rejection reason..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                />
              </div>
            )}
            {rejectionReason && rejectionReason !== 'Other' && (
              <div className="text-sm text-muted-foreground">
                Selected: <span className="font-medium">{rejectionReason}</span>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setRejectDialogOpen(false); setRejectionReason('') }}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleRejectSpecimen} disabled={rejecting || !rejectionReason.trim()}>
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

function AttachmentForm({ patientId }: { patientId: string }) {
  const [url, setUrl] = (require('react') as any).useState('')
  const [saving, setSaving] = (require('react') as any).useState(false)
  const add = async () => {
    if (!url.trim()) return
    setSaving(true)
    try {
      await fetch('/api/documents', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ patientId, type: 'OTHER', fileUrl: url.trim() }) })
      setUrl('')
    } catch {}
    finally { setSaving(false) }
  }
  return (
    <div className="flex items-center gap-2">
      <input className="border rounded px-2 py-1 text-sm flex-1" placeholder="Paste analyzer file URL (PDF/image)" value={url} onChange={(e)=> setUrl(e.target.value)} />
      <button className="rounded border px-3 py-1.5 text-sm" onClick={add} disabled={saving || !url.trim()}>{saving ? 'Attaching…':'Attach'}</button>
    </div>
  )
}
