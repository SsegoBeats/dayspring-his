"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowRightLeft, Building2, UserPlus } from "lucide-react"
import { toast } from "sonner"
import { useAuth } from "@/lib/auth-context"

interface Referral {
  id: string
  type: string
  receiving_user_id?: string | null
  referring_user_name?: string
  receiving_user_name?: string
  receiving_department?: string
  external_facility_name?: string
  external_clinician_name?: string
  reason: string
  urgency: string
  status: string
  created_at: string
  notes?: string
  handoff_snapshot?: unknown
  accepted_at?: string
  completed_at?: string
}

interface HandoffSnapshot {
  capturedAt?: string
  patient?: {
    id?: string
    patientNumber?: string | null
    name?: string
  }
  latestClinicalRecord?: {
    chief_complaint?: string | null
    history?: string | null
    impression?: string | null
    diagnosis?: string | null
    treatment_plan?: string | null
    notes?: string | null
  } | null
  latestVitals?: {
    blood_pressure_systolic?: number | null
    blood_pressure_diastolic?: number | null
    heart_rate?: number | null
    temperature?: number | null
    respiratory_rate?: number | null
    oxygen_saturation?: number | null
    notes?: string | null
  } | null
  recentPrescriptions?: Array<{
    medication_name?: string | null
    dosage?: string | null
    frequency?: string | null
    status?: string | null
  }>
  recentLabResults?: Array<{
    test_name?: string | null
    results?: string | null
    status?: string | null
    priority?: string | null
  }>
  requestedProcedures?: Array<{
    id?: string
    name?: string | null
    type?: string | null
    status?: string | null
    performer?: string | null
    reason?: string | null
    findings?: string | null
    notes?: string | null
    outcome?: string | null
    followUpInstructions?: string | null
    performedAt?: string | null
  }>
  followUpRequirements?: string | null
  instructions?: string | null
}

interface ReferralsViewProps {
  patientId: string
}

interface Clinician {
  id: string
  name: string
}

export function ReferralsView({ patientId }: ReferralsViewProps) {
  const { user } = useAuth()
  const [referrals, setReferrals] = useState<Referral[]>([])
  const [clinicians, setClinicians] = useState<Clinician[]>([])
  const [loading, setLoading] = useState(true)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [referralType, setReferralType] = useState<'internal' | 'external-out'>('internal')
  const [receivingUserId, setReceivingUserId] = useState('')
  const [externalFacility, setExternalFacility] = useState('')
  const [externalClinician, setExternalClinician] = useState('')
  const [externalContact, setExternalContact] = useState('')
  const [reason, setReason] = useState('')
  const [urgency, setUrgency] = useState('routine')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [statusFilter, setStatusFilter] = useState('__all_status__')
  const [urgencyFilter, setUrgencyFilter] = useState('__all_urgency__')

  const canCreateReferral = user?.role && ['Clinician', 'Nurse', 'Midwife', 'Hospital Admin'].includes(user.role)

  const toSnapshot = (value: unknown): HandoffSnapshot | null => {
    if (!value) return null
    try {
      if (typeof value === 'string') return JSON.parse(value) as HandoffSnapshot
      if (typeof value === 'object') return value as HandoffSnapshot
      return null
    } catch {
      return null
    }
  }

  const loadReferrals = async () => {
    try {
      setLoading(true)
      const qs = new URLSearchParams({ patientId })
      if (user?.facilityId) qs.set('facilityId', user.facilityId)
      if (statusFilter !== '__all_status__') qs.set('status', statusFilter)
      if (urgencyFilter !== '__all_urgency__') qs.set('urgency', urgencyFilter)
      const res = await fetch(`/api/referrals?${qs.toString()}`, { credentials: 'include' })
      if (!res.ok) throw new Error('Failed to load referrals')
      const data = await res.json()
      setReferrals(data.referrals || [])
    } catch (error) {
      console.error('Failed to load referrals:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadClinicians = async () => {
    try {
      const res = await fetch('/api/users/clinicians', { credentials: 'include' })
      if (!res.ok) return
      const data = await res.json()
      setClinicians(data.users || [])
    } catch (error) {
      console.error('Failed to load clinicians:', error)
    }
  }

  useEffect(() => {
    if (patientId) {
      void loadReferrals()
      void loadClinicians()
    }
  }, [patientId, user?.facilityId, statusFilter, urgencyFilter])

  const updateHandoffStatus = async (referral: Referral, status: "accepted" | "completed") => {
    try {
      const res = await fetch(`/api/referrals/${encodeURIComponent(referral.id)}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Could not update handoff status")
      toast.success(status === "accepted" ? "Handoff accepted" : "Handoff completed")
      await loadReferrals()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update handoff status")
    }
  }

  const handleCreate = async () => {
    if (!reason.trim()) {
      toast.error('Reason for referral is required')
      return
    }

    if (referralType === 'internal' && !receivingUserId) {
      toast.error('Please select a receiving clinician')
      return
    }

    if (referralType === 'external-out' && !externalFacility.trim()) {
      toast.error('External facility name is required')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/referrals', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId,
          type: referralType,
          receivingUserId: referralType === 'internal' ? receivingUserId : null,
          externalFacilityName: referralType === 'external-out' ? externalFacility.trim() : null,
          externalClinicianName: referralType === 'external-out' ? externalClinician.trim() : null,
          externalClinicianContact: referralType === 'external-out' ? externalContact.trim() : null,
          facilityId: user?.facilityId ?? null,
          reason: reason.trim(),
          urgency,
          notes: notes.trim() || null,
        }),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to create referral')
      }

      toast.success('Referral created successfully')
      // Emit an audit-log event so the rest of the UI can react (notifications, audit)
      try {
        if (typeof window !== 'undefined') {
          const event = new CustomEvent('audit-log', {
            detail: {
              action: 'CREATE_REFERRAL',
              category: 'REFERRAL',
              entityType: 'Referral',
              entityId: null,
              description: `Referral created for patient ${patientId} (${referralType}) by ${user?.name}`,
            },
          })
          window.dispatchEvent(event)
        }
      } catch {}
      setCreateDialogOpen(false)
      setReason('')
      setNotes('')
      setReceivingUserId('')
      setExternalFacility('')
      setExternalClinician('')
      setExternalContact('')
      await loadReferrals()
    } catch (error: any) {
      toast.error(error?.message || 'Referral was not saved. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'accepted': return <Badge variant="default" className="bg-green-600">Accepted</Badge>
      case 'completed': return <Badge variant="default">Completed</Badge>
      case 'pending': return <Badge variant="secondary">Pending</Badge>
      case 'cancelled': return <Badge variant="destructive">Cancelled</Badge>
      default: return <Badge>{status}</Badge>
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Referrals</h3>
        {canCreateReferral && (
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <UserPlus className="mr-2 h-4 w-4" />
                New Referral
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create Referral</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <Label>Referral Type</Label>
                  <Select value={referralType} onValueChange={(v) => setReferralType(v as any)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="internal">Internal (to another clinician)</SelectItem>
                      <SelectItem value="external-out">External (to another facility)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {referralType === 'internal' && (
                  <div>
                    <Label htmlFor="receiving-clinician">Receiving Clinician</Label>
                    <Select value={receivingUserId} onValueChange={setReceivingUserId}>
                      <SelectTrigger id="receiving-clinician">
                        <SelectValue placeholder="Select clinician" />
                      </SelectTrigger>
                      <SelectContent>
                        {clinicians.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {referralType === 'external-out' && (
                  <>
                    <div>
                      <Label htmlFor="external-facility">Facility Name</Label>
                      <Input
                        id="external-facility"
                        value={externalFacility}
                        onChange={(e) => setExternalFacility(e.target.value)}
                        placeholder="e.g., Mulago Hospital"
                      />
                    </div>
                    <div>
                      <Label htmlFor="external-clinician">Clinician Name (optional)</Label>
                      <Input
                        id="external-clinician"
                        value={externalClinician}
                        onChange={(e) => setExternalClinician(e.target.value)}
                        placeholder="e.g., Dr. Jane Doe"
                      />
                    </div>
                    <div>
                      <Label htmlFor="external-contact">Contact (optional)</Label>
                      <Input
                        id="external-contact"
                        value={externalContact}
                        onChange={(e) => setExternalContact(e.target.value)}
                        placeholder="Phone or email"
                      />
                    </div>
                  </>
                )}

                <div>
                  <Label htmlFor="urgency">Urgency</Label>
                  <Select value={urgency} onValueChange={setUrgency}>
                    <SelectTrigger id="urgency">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="emergency">Emergency</SelectItem>
                      <SelectItem value="Very Urgent">Very Urgent</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                      <SelectItem value="routine">Routine</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="reason">Reason for Referral *</Label>
                  <Textarea
                    id="reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Why is this patient being referred?"
                    rows={3}
                  />
                </div>

                <div>
                  <Label htmlFor="notes">Additional Notes (optional)</Label>
                  <Textarea
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Any additional information"
                    rows={2}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleCreate} disabled={submitting}>
                  {submitting ? 'Creating...' : 'Create Referral'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="w-44">
          <Label htmlFor="referral-status-filter" className="sr-only">Status filter</Label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger id="referral-status-filter">
              <SelectValue placeholder="Filter status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all_status__">All Statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="accepted">Accepted</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="w-44">
          <Label htmlFor="referral-urgency-filter" className="sr-only">Urgency filter</Label>
          <Select value={urgencyFilter} onValueChange={setUrgencyFilter}>
            <SelectTrigger id="referral-urgency-filter">
              <SelectValue placeholder="Filter urgency" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all_urgency__">All Urgencies</SelectItem>
              <SelectItem value="emergency">Emergency</SelectItem>
              <SelectItem value="Very Urgent">Very Urgent</SelectItem>
              <SelectItem value="urgent">Urgent</SelectItem>
              <SelectItem value="routine">Routine</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {(statusFilter !== '__all_status__' || urgencyFilter !== '__all_urgency__') && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setStatusFilter('__all_status__')
              setUrgencyFilter('__all_urgency__')
            }}
          >
            Clear Filters
          </Button>
        )}
      </div>

      {loading && (
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Loading referrals...</p>
          </CardContent>
        </Card>
      )}

      {!loading && referrals.length === 0 ? (
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">No referrals for this patient.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {referrals.map((ref) => {
            const isHandoffRecipient = !!user && (
              user.role === "Hospital Admin"
              || ref.receiving_user_id === user.id
              || (!ref.receiving_user_id && ref.receiving_department?.toLowerCase() === user.role.toLowerCase())
            )
            return (
            <Card key={ref.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    {ref.type === 'internal' ? <ArrowRightLeft className="h-4 w-4" /> : <Building2 className="h-4 w-4" />}
                    <CardTitle className="text-base">
                      {ref.type === 'internal' && `Referral to ${ref.receiving_user_name || 'Clinician'}`}
                      {ref.type === 'external-out' && `Referred to ${ref.external_facility_name}`}
                      {ref.type === 'external-in' && `Received from ${ref.external_facility_name}`}
                    </CardTitle>
                  </div>
                  {getStatusBadge(ref.status)}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <p><strong>Reason:</strong> {ref.reason}</p>
                  <p><strong>Urgency:</strong> <Badge variant="outline">{ref.urgency}</Badge></p>
                  <p><strong>Referred by:</strong> {ref.referring_user_name || 'Unknown'}</p>
                  {ref.type === 'external-out' && ref.external_clinician_name && (
                    <p><strong>To:</strong> {ref.external_clinician_name}</p>
                  )}
                  {ref.notes && <p className="text-muted-foreground"><strong>Notes:</strong> {ref.notes}</p>}
                  {(() => {
                    const snapshot = toSnapshot(ref.handoff_snapshot)
                    if (!snapshot) return null
                    const vitals = snapshot.latestVitals
                    const clinical = snapshot.latestClinicalRecord
                    const meds = Array.isArray(snapshot.recentPrescriptions) ? snapshot.recentPrescriptions.slice(0, 5) : []
                    const labs = Array.isArray(snapshot.recentLabResults) ? snapshot.recentLabResults.slice(0, 5) : []
                    return (
                      <details open={ref.type === "internal" && ref.status === "pending"} className="rounded border border-teal-100 bg-teal-50/40 p-3">
                        <summary className="cursor-pointer text-xs font-semibold uppercase tracking-widest text-teal-700">
                          Handoff Snapshot
                        </summary>
                        <div className="mt-2 space-y-2 text-xs text-slate-700">
                          {snapshot.patient?.name && (
                            <p><strong>Patient:</strong> {snapshot.patient.name}{snapshot.patient.patientNumber ? ` (${snapshot.patient.patientNumber})` : ""}</p>
                          )}
                          {clinical?.chief_complaint && <p><strong>Chief Complaint:</strong> {clinical.chief_complaint}</p>}
                          {clinical?.history && <p><strong>Relevant History:</strong> {clinical.history}</p>}
                          {clinical?.impression && <p><strong>Impression:</strong> {clinical.impression}</p>}
                          {clinical?.diagnosis && <p><strong>Diagnosis:</strong> {clinical.diagnosis}</p>}
                          {clinical?.treatment_plan && <p><strong>Treatment Plan:</strong> {clinical.treatment_plan}</p>}
                          {snapshot.instructions && <p><strong>Instructions:</strong> {snapshot.instructions}</p>}
                          {vitals && (
                            <p>
                              <strong>Latest Vitals:</strong>{" "}
                              {vitals.blood_pressure_systolic != null && vitals.blood_pressure_diastolic != null ? `BP ${vitals.blood_pressure_systolic}/${vitals.blood_pressure_diastolic} ` : ""}
                              {vitals.temperature != null ? `Temp ${vitals.temperature} ` : ""}
                              {vitals.heart_rate != null ? `HR ${vitals.heart_rate} ` : ""}
                              {vitals.respiratory_rate != null ? `RR ${vitals.respiratory_rate} ` : ""}
                              {vitals.oxygen_saturation != null ? `SpO2 ${vitals.oxygen_saturation}%` : ""}
                            </p>
                          )}
                          {meds.length > 0 && (
                            <p>
                              <strong>Requested/Recent Medications:</strong>{" "}
                              {meds.map((m) => [m.medication_name, m.dosage, m.frequency].filter(Boolean).join(" ")).filter(Boolean).join("; ")}
                            </p>
                          )}
                          {labs.length > 0 && (
                            <div>
                              <strong>Relevant Labs:</strong>
                              <ul className="ml-4 list-disc">
                                {labs.map((lab, index) => (
                                  <li key={`${lab.test_name || "lab"}-${index}`}>
                                    {[lab.test_name, lab.status ? `(${lab.status})` : "", lab.priority ? `[${lab.priority}]` : "", lab.results].filter(Boolean).join(" — ")}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {snapshot.requestedProcedures?.length ? (
                            <div>
                              <strong>Requested / Recent Procedures:</strong>
                              <ul className="ml-4 list-disc">
                                {snapshot.requestedProcedures.map((procedure, index) => (
                                  <li key={procedure.id || `${procedure.name || "procedure"}-${index}`}>
                                    <span className="font-medium">{procedure.name || "Procedure"}</span>
                                    {procedure.status ? ` (${procedure.status})` : ""}
                                    {procedure.reason ? ` — Indication: ${procedure.reason}` : ""}
                                    {procedure.notes ? ` — Instructions: ${procedure.notes}` : ""}
                                    {procedure.findings ? ` — Findings: ${procedure.findings}` : ""}
                                    {procedure.outcome ? ` — Outcome: ${procedure.outcome}` : ""}
                                    {procedure.followUpInstructions ? ` — Follow-up: ${procedure.followUpInstructions}` : ""}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ) : null}
                          {snapshot.followUpRequirements && (
                            <p><strong>Follow-up Requirements:</strong> {snapshot.followUpRequirements}</p>
                          )}
                          {snapshot.capturedAt && <p className="text-[11px] text-slate-500">Snapshot captured: {new Date(snapshot.capturedAt).toLocaleString()}</p>}
                        </div>
                      </details>
                    )
                  })()}
                  {ref.accepted_at && <p className="text-xs text-muted-foreground">Accepted: {new Date(ref.accepted_at).toLocaleString()}</p>}
                  {ref.completed_at && <p className="text-xs text-muted-foreground">Completed: {new Date(ref.completed_at).toLocaleString()}</p>}
                  {ref.type === "internal" && isHandoffRecipient && ref.status === "pending" && (
                    <Button size="sm" onClick={() => void updateHandoffStatus(ref, "accepted")}>
                      Accept Handoff
                    </Button>
                  )}
                  {ref.type === "internal" && isHandoffRecipient && ref.status === "accepted" && (
                    <Button size="sm" variant="outline" onClick={() => void updateHandoffStatus(ref, "completed")}>
                      Complete Handoff
                    </Button>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Created: {new Date(ref.created_at).toLocaleString()}
                  </p>
                </div>
              </CardContent>
            </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
