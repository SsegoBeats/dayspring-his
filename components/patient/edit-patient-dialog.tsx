"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { usePatients } from "@/lib/patient-context"

export interface EditPatientDialogProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  patient: {
    id: string
    firstName: string
    lastName: string
    ageYears?: number | null
    gender: string
    phone: string
    address?: string
    emergencyContact?: string
    emergencyPhone?: string
    nextOfKinName?: string | null
    nextOfKinPhone?: string | null
    nextOfKinRelation?: string | null
    nextOfKinResidence?: string | null
  }
  onSaved?: () => void
}

export function EditPatientDialog({ open, onOpenChange, patient, onSaved }: EditPatientDialogProps) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { updatePatient } = usePatients()
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    ageYears: "",
    gender: "other",
    phone: "",
    address: "",
    emergencyContactName: "",
    emergencyContactPhone: "",
    nextOfKinFirstName: "",
    nextOfKinLastName: "",
    nextOfKinPhone: "",
    nextOfKinRelation: "",
    nextOfKinResidence: "",
  })

  useEffect(() => {
    if (!open) return
    const nokSplit = (patient.nextOfKinName || "").split(" ")
    setForm({
      firstName: patient.firstName || "",
      lastName: patient.lastName || "",
      ageYears: typeof patient.ageYears === 'number' ? String(patient.ageYears) : "",
      gender: (patient.gender || 'other').toLowerCase(),
      phone: patient.phone || "",
      address: patient.address || "",
      emergencyContactName: patient.emergencyContact || "",
      emergencyContactPhone: patient.emergencyPhone || "",
      nextOfKinFirstName: nokSplit[0] || "",
      nextOfKinLastName: (nokSplit.slice(1).join(' ') || "").trim(),
      nextOfKinPhone: patient.nextOfKinPhone || "",
      nextOfKinRelation: patient.nextOfKinRelation || "",
      nextOfKinResidence: patient.nextOfKinResidence || "",
    })
  }, [open])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const payload: any = {
        id: patient.id,
        firstName: form.firstName.trim() || undefined,
        lastName: form.lastName.trim() || undefined,
        ageYears: form.ageYears ? Number(form.ageYears) : undefined,
        gender: form.gender === 'male' ? 'Male' : form.gender === 'female' ? 'Female' : 'Other',
        phone: form.phone.trim() || undefined,
        address: form.address.trim() || null,
        emergencyContactName: form.emergencyContactName.trim() || null,
        emergencyContactPhone: form.emergencyContactPhone.trim() || null,
        nextOfKinFirstName: form.nextOfKinFirstName.trim() || null,
        nextOfKinLastName: form.nextOfKinLastName.trim() || null,
        // Keep legacy combined NOK name in sync for older schemas
        nextOfKinName: [form.nextOfKinFirstName.trim(), form.nextOfKinLastName.trim()].filter(Boolean).join(' ') || null,
        nextOfKinPhone: form.nextOfKinPhone.trim() || null,
        nextOfKinRelation: form.nextOfKinRelation.trim() || null,
        nextOfKinResidence: form.nextOfKinResidence.trim() || null,
      }
      const res = await fetch('/api/patients', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const e = await res.json().catch(()=>({}))
        const msg = e?.error || `Failed to update patient (${res.status})`
        throw new Error(msg)
      }
      const data = await res.json().catch(()=>({}))
      const p = data?.patient
      if (p) {
        // Map server row (snake_case) to Patient context shape
        const mapped: any = {
          firstName: p.first_name,
          lastName: p.last_name,
          ageYears: typeof p.age_years === 'number' ? p.age_years : undefined,
          gender: (p.gender || 'Other').toString().toLowerCase(),
          phone: p.phone || '',
          address: p.address || '',
          emergencyContact: p.emergency_contact_name || '',
          emergencyPhone: p.emergency_contact_phone || '',
          nextOfKinName: (p.next_of_kin_name ? p.next_of_kin_name : [p.next_of_kin_first_name, p.next_of_kin_last_name].filter(Boolean).join(' ').trim()) || null,
          nextOfKinPhone: p.next_of_kin_phone || null,
          nextOfKinRelation: p.next_of_kin_relation || null,
          nextOfKinResidence: p.next_of_kin_residence || null,
        }
        try { updatePatient(patient.id, mapped) } catch {}
      }
      toast.success('Patient updated')
      onSaved?.()
      onOpenChange(false)
    } catch (e) {
      console.error(e)
      const msg = (e as Error).message || 'Failed to save changes'
      setError(msg)
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg" className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Patient</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>First Name</Label>
              <Input value={form.firstName} onChange={(e)=>setForm({ ...form, firstName: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label>Last Name</Label>
              <Input value={form.lastName} onChange={(e)=>setForm({ ...form, lastName: e.target.value })} required />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Age (years)</Label>
              <Input type="number" inputMode="numeric" min={0} max={130} value={form.ageYears} onChange={(e)=>setForm({ ...form, ageYears: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Gender</Label>
              <Select value={form.gender} onValueChange={(v)=>setForm({ ...form, gender: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input value={form.phone} onChange={(e)=>setForm({ ...form, phone: e.target.value })} required />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Address</Label>
            <Input value={form.address} onChange={(e)=>setForm({ ...form, address: e.target.value })} />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Emergency Contact Name</Label>
              <Input value={form.emergencyContactName} onChange={(e)=>setForm({ ...form, emergencyContactName: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Emergency Contact Phone</Label>
              <Input value={form.emergencyContactPhone} onChange={(e)=>setForm({ ...form, emergencyContactPhone: e.target.value })} />
            </div>
          </div>
          <div className="space-y-3 rounded-md border p-3">
            <div className="font-medium">Next of Kin</div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>First Name</Label>
                <Input value={form.nextOfKinFirstName} onChange={(e)=>setForm({ ...form, nextOfKinFirstName: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Last Name</Label>
                <Input value={form.nextOfKinLastName} onChange={(e)=>setForm({ ...form, nextOfKinLastName: e.target.value })} />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input value={form.nextOfKinPhone} onChange={(e)=>setForm({ ...form, nextOfKinPhone: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Relationship</Label>
                <Input value={form.nextOfKinRelation} onChange={(e)=>setForm({ ...form, nextOfKinRelation: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Residence</Label>
                <Input value={form.nextOfKinResidence} onChange={(e)=>setForm({ ...form, nextOfKinResidence: e.target.value })} />
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={()=>onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
