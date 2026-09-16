"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Pill, Syringe, CheckCircle2, Clock } from "lucide-react"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"

interface Prescription {
  id: string
  medication_name: string
  dosage: string
  frequency: string
  duration: string
  instructions?: string
  administration_guidance?: string
  created_at: string
  status: string
  doctor_name?: string
}

interface Administration {
  id: string
  dose_given: string
  administered_at: string
  nurse_name: string
  route?: string
  notes?: string
}

interface PrescriptionViewProps {
  patientId: string
}

export function PrescriptionView({ patientId }: PrescriptionViewProps) {
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([])
  const [administrations, setAdministrations] = useState<Record<string, Administration[]>>({})
  const [loading, setLoading] = useState(true)
  const [administerDialogOpen, setAdministerDialogOpen] = useState(false)
  const [selectedPrescription, setSelectedPrescription] = useState<Prescription | null>(null)
  const [doseGiven, setDoseGiven] = useState('')
  const [route, setRoute] = useState('')
  const [adminNotes, setAdminNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const loadData = async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/medical/prescriptions?patientId=${patientId}`, {
        credentials: 'include',
      })

      if (!res.ok) throw new Error('Failed to load prescriptions')
      const data = await res.json()
      setPrescriptions(data.prescriptions || [])

      // Load administrations for each prescription
      const adminData: Record<string, Administration[]> = {}
      for (const rx of data.prescriptions || []) {
        const adminRes = await fetch(`/api/prescription-administrations?prescriptionId=${rx.id}`, {
          credentials: 'include',
        })
        if (adminRes.ok) {
          const adminJson = await adminRes.json()
          adminData[rx.id] = adminJson.administrations || []
        }
      }
      setAdministrations(adminData)
    } catch (error) {
      console.error('Failed to load prescriptions:', error)
      toast.error('Failed to load prescriptions')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (patientId) void loadData()
  }, [patientId])

  const handleAdminister = async () => {
    if (!selectedPrescription || !doseGiven.trim()) return

    setSubmitting(true)
    try {
      const res = await fetch('/api/prescription-administrations', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prescriptionId: selectedPrescription.id,
          doseGiven: doseGiven.trim(),
          route: route.trim() || null,
          notes: adminNotes.trim() || null,
        }),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to record administration')
      }

      toast.success('Dose administration recorded')
      setAdministerDialogOpen(false)
      setDoseGiven('')
      setRoute('')
      setAdminNotes('')
      setSelectedPrescription(null)
      await loadData()
    } catch (error: any) {
      toast.error(error?.message || 'Failed to record administration')
    } finally {
      setSubmitting(false)
    }
  }

  const isInjectable = (rx: Prescription) => {
    const name = rx.medication_name.toLowerCase()
    return name.includes('injection') || name.includes('iv') || rx.administration_guidance?.toLowerCase().includes('inject')
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-sm text-muted-foreground">Loading prescriptions...</p>
        </CardContent>
      </Card>
    )
  }

  if (prescriptions.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-sm text-muted-foreground">No prescriptions found for this patient.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {prescriptions.map((rx) => {
        const adminHistory = administrations[rx.id] || []
        const injectable = isInjectable(rx)

        return (
          <Card key={rx.id} className="overflow-hidden">
            <CardHeader className="bg-violet-50 border-b border-violet-100">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-base flex items-center gap-2">
                    {injectable ? <Syringe className="h-4 w-4 text-violet-600" /> : <Pill className="h-4 w-4 text-violet-600" />}
                    {rx.medication_name}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {rx.dosage} • {rx.frequency} • {rx.duration}
                  </p>
                  {rx.doctor_name && (
                    <p className="text-xs text-muted-foreground">Prescribed by: {rx.doctor_name}</p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-2">
                  <Badge variant={rx.status === 'Dispensed' ? 'default' : 'secondary'}>
                    {rx.status}
                  </Badge>
                  <Dialog open={administerDialogOpen && selectedPrescription?.id === rx.id} onOpenChange={(open) => {
                    setAdministerDialogOpen(open)
                    if (!open) setSelectedPrescription(null)
                  }}>
                    <DialogTrigger asChild>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedPrescription(rx)
                          setDoseGiven(rx.dosage)
                          setRoute('')
                          setAdminNotes('')
                        }}
                      >
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Record Dose
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Record Dose Administration</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div>
                          <Label>Medication</Label>
                          <p className="text-sm font-medium">{rx.medication_name}</p>
                        </div>
                        <div>
                          <Label htmlFor="dose-given">Dose Given</Label>
                          <Input
                            id="dose-given"
                            value={doseGiven}
                            onChange={(e) => setDoseGiven(e.target.value)}
                            placeholder={rx.dosage}
                          />
                        </div>
                        <div>
                          <Label htmlFor="route">Route (optional)</Label>
                          <Input
                            id="route"
                            value={route}
                            onChange={(e) => setRoute(e.target.value)}
                            placeholder="e.g., IM, IV, PO"
                          />
                        </div>
                        <div>
                          <Label htmlFor="admin-notes">Notes (optional)</Label>
                          <Textarea
                            id="admin-notes"
                            value={adminNotes}
                            onChange={(e) => setAdminNotes(e.target.value)}
                            placeholder="Any observations or notes"
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setAdministerDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleAdminister} disabled={submitting || !doseGiven.trim()}>
                          {submitting ? 'Recording...' : 'Record Administration'}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4">
              {rx.instructions && (
                <div className="mb-3 rounded-lg bg-blue-50 p-3">
                  <p className="text-sm font-medium text-blue-900">Instructions:</p>
                  <p className="text-sm text-blue-700">{rx.instructions}</p>
                </div>
              )}
              {injectable && rx.administration_guidance && (
                <div className="mb-3 rounded-lg bg-amber-50 border border-amber-200 p-3">
                  <p className="text-sm font-medium text-amber-900 flex items-center gap-2">
                    <Syringe className="h-4 w-4" />
                    Injection Guidance:
                  </p>
                  <p className="text-sm text-amber-700">{rx.administration_guidance}</p>
                </div>
              )}
              {adminHistory.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-2">
                    Administration History
                  </p>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Date/Time</TableHead>
                        <TableHead className="text-xs">Dose</TableHead>
                        <TableHead className="text-xs">Route</TableHead>
                        <TableHead className="text-xs">Nurse</TableHead>
                        <TableHead className="text-xs">Notes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {adminHistory.map((admin) => (
                        <TableRow key={admin.id}>
                          <TableCell className="text-sm">
                            {new Date(admin.administered_at).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-sm font-mono">{admin.dose_given}</TableCell>
                          <TableCell className="text-sm">{admin.route || '—'}</TableCell>
                          <TableCell className="text-sm">{admin.nurse_name}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{admin.notes || '—'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
              {adminHistory.length === 0 && (
                <p className="text-xs text-muted-foreground flex items-center gap-2 mt-2">
                  <Clock className="h-3 w-3" />
                  No doses administered yet
                </p>
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
