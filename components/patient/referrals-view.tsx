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

  const canCreateReferral = user?.role && ['Clinician', 'Nurse', 'Hospital Admin'].includes(user.role)

  const loadReferrals = async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/referrals?patientId=${patientId}`, { credentials: 'include' })
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
  }, [patientId])

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
      setCreateDialogOpen(false)
      setReason('')
      setNotes('')
      setReceivingUserId('')
      setExternalFacility('')
      setExternalClinician('')
      setExternalContact('')
      await loadReferrals()
    } catch (error: any) {
      toast.error(error?.message || 'Failed to create referral')
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

      {referrals.length === 0 ? (
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">No referrals for this patient.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {referrals.map((ref) => (
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
                  <p className="text-xs text-muted-foreground">
                    Created: {new Date(ref.created_at).toLocaleString()}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
