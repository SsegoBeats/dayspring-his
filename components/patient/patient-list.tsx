"use client"

import React, { useState, useEffect } from "react"
import { usePatients } from "@/lib/patient-context"
import { PatientRegistration } from "@/components/patient/patient-registration"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Search, Eye, Trash2 } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { PatientDetails } from "./patient-details"
import { formatPatientDigits } from "@/lib/patients"

export function PatientList({ initialSelectedPatientId }: { initialSelectedPatientId?: string }) {
  const { patients, searchPatients } = usePatients()
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(initialSelectedPatientId || null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteReason, setDeleteReason] = useState("")
  const [deletingPatient, setDeletingPatient] = useState<{ id: string; name: string } | null>(null)
  const [registerOpen, setRegisterOpen] = useState(false)

  // React to changes when parent wants to open a patient directly
  useEffect(() => {
    if (initialSelectedPatientId) setSelectedPatientId(initialSelectedPatientId)
  }, [initialSelectedPatientId])

  const displayedPatients = searchQuery ? searchPatients(searchQuery) : patients

  if (selectedPatientId) {
    return <PatientDetails patientId={selectedPatientId} onBack={() => setSelectedPatientId(null)} />
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Patient List</CardTitle>
        <CardDescription>Search and view all registered patients</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name, P.ID, or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            />
          </div>
          <Button onClick={()=> setRegisterOpen(true)}>Register Patient</Button>
        </div>

        {displayedPatients.length === 0 ? (
          <p className="text-center text-muted-foreground">No patients found</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left">
                  <th className="py-2 px-2">P.ID</th>
                  <th className="py-2 px-2">First Name</th>
                  <th className="py-2 px-2">Last Name</th>
                  <th className="py-2 px-2">Age</th>
                  <th className="py-2 px-2">Sex</th>
                  <th className="py-2 px-2">Contact</th>
                  <th className="py-2 px-2">Triage</th>
                  <th className="py-2 px-2">Status</th>
                  <th className="py-2 px-2"></th>
                </tr>
              </thead>
              <tbody>
                {displayedPatients.map((p) => {
                  const pid = formatPatientDigits(p.patientNumber)
                  // Age: prefer ageYears, else approximate from dateOfBirth
                  let age: string | number = p.ageYears || ''
                  if (!age && p.dateOfBirth) {
                    try {
                      const dob = new Date(p.dateOfBirth)
                      const now = new Date()
                      age = now.getFullYear() - dob.getFullYear() - ((now.getMonth()<dob.getMonth()||(now.getMonth()===dob.getMonth()&&now.getDate()<dob.getDate()))?1:0)
                    } catch {}
                  }
                  const sex = (p.gender || '').toString().charAt(0).toUpperCase() + (p.gender || '').toString().slice(1)
                  const triage = (p.triageCategory || '').toString()
                  const triageClass = triage === 'Emergency'
                    ? 'bg-red-600 text-white'
                    : triage === 'Very Urgent'
                    ? 'bg-orange-600 text-white'
                    : triage === 'Urgent'
                    ? 'bg-amber-500 text-black'
                    : triage === 'Standard'
                    ? 'bg-green-600 text-white'
                    : triage === 'Non-urgent'
                    ? 'bg-slate-500 text-white'
                    : 'bg-slate-200 text-slate-700'
                  return (
                    <tr key={p.id} className="border-b hover:bg-muted/30">
                      <td className="py-2 px-2 font-mono">{pid}</td>
                      <td className="py-2 px-2">{p.firstName}</td>
                      <td className="py-2 px-2">{p.lastName}</td>
                      <td className="py-2 px-2">{age || '-'}</td>
                      <td className="py-2 px-2">{sex}</td>
                      <td className="py-2 px-2">{p.phone}</td>
                      <td className="py-2 px-2">
                        {triage ? (
                          <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${triageClass}`}>{triage}</span>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="py-2 px-2"><Badge variant={p.status === 'active' ? 'default' : 'secondary'}>{p.status}</Badge></td>
                      <td className="py-2 px-2 text-right space-x-2">
                        <Button variant="outline" size="sm" onClick={() => setSelectedPatientId(p.id)}>
                          <Eye className="mr-2 h-4 w-4" /> View
                        </Button>
                        <Button variant="destructive" size="sm" onClick={() => { setDeletingPatient({ id: p.id, name: `${p.firstName} ${p.lastName}` }); setDeleteOpen(true) }}>
                          <Trash2 className="mr-2 h-4 w-4" /> Delete
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Patient Deletion</DialogTitle>
            <DialogDescription>
              Provide a reason for deleting {deletingPatient?.name}. Your request will be sent to Hospital Admin for approval.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Textarea value={deleteReason} onChange={(e)=>setDeleteReason(e.target.value)} placeholder="Reason for deletion..." rows={4} />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={()=>setDeleteOpen(false)}>Cancel</Button>
              <Button
                onClick={async ()=>{
                  if (!deletingPatient?.id || !deleteReason.trim()) { toast.error('Please provide a reason'); return }
                  try {
                    const res = await fetch('/api/patient-deletions', {
                      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ patientId: deletingPatient.id, reason: deleteReason.trim() })
                    })
                    if (!res.ok) throw new Error('Failed to submit request')
                    toast.success('Deletion request sent to Hospital Admin')
                    setDeleteReason(''); setDeletingPatient(null); setDeleteOpen(false)
                  } catch {
                    toast.error('Failed to send deletion request')
                  }
                }}
              >Submit Request</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={registerOpen} onOpenChange={setRegisterOpen}>
        <DialogContent size="lg" className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Register Patient</DialogTitle>
          </DialogHeader>
          <PatientRegistration onSuccess={(id)=>{ try { setRegisterOpen(false) } catch {}; if (id) setSelectedPatientId(id) }} />
        </DialogContent>
      </Dialog>
    </Card>
  )
}

