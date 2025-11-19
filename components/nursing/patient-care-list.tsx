"use client"

import { useMemo, useState } from "react"
import { usePatients } from "@/lib/patient-context"
import { useNursing } from "@/lib/nursing-context"
import { formatPatientDigits } from "@/lib/patients"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Search, Stethoscope, Loader2 } from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { toast } from "sonner"

interface PatientCareListProps {
  onSelectPatient: (patientId: string, tab?: 'vitals'|'notes') => void
}

export function PatientCareList({ onSelectPatient }: PatientCareListProps) {
  const { patients, searchPatients, loadingPatients } = usePatients()
  const { getLatestVitals } = useNursing()
  const { user } = useAuth()
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [bulkVitals, setBulkVitals] = useState({ bloodPressure:'', temperature:'', heartRate:'', respiratoryRate:'', oxygenSaturation:'', notes:'' })
  const hasAnyBulkField = !!(bulkVitals.bloodPressure || bulkVitals.temperature || bulkVitals.heartRate || bulkVitals.respiratoryRate || bulkVitals.oxygenSaturation || bulkVitals.notes)
  
  // Helpers to auto-append metric units on blur
  const numInt = (s: string) => {
    const m = String(s || '').match(/-?\d+/)
    return m ? parseInt(m[0], 10) : null
  }
  const numFloat = (s: string) => {
    const m = String(s || '').replace(',', '.').match(/-?\d+(?:\.\d+)?/)
    return m ? parseFloat(m[0]) : null
  }
  const fmtBP = (s: string) => {
    const raw = String(s || '')
    const m = raw.match(/(\d+)\D+(\d+)/)
    if (m) return `${m[1]}/${m[2]}`
    const nums = raw.match(/\d+/g)
    if (nums && nums.length >= 2) return `${nums[0]}/${nums[1]}`
    const n = numInt(raw)
    return n == null ? '' : String(n)
  }
  const fmtTemp = (s: string) => {
    const n = numFloat(s)
    if (n == null) return ''
    const c = n > 45 ? (n - 32) * 5/9 : n
    return `${c.toFixed(1)} °C`
  }
  const fmtBpm = (s: string) => (numInt(s) == null ? '' : `${numInt(s)} bpm`)
  const fmtRR = (s: string) => (numInt(s) == null ? '' : `${numInt(s)}/min`)
  const fmtSpO2 = (s: string) => (numInt(s) == null ? '' : `${numInt(s)}%`)

  const displayedPatients = searchQuery ? searchPatients(searchQuery) : patients

  // Loading state while patients load from the server
  if (loadingPatients) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Patient Care List</CardTitle>
          <CardDescription>Loading patients…</CardDescription>
        </CardHeader>
        <CardContent className="py-10">
          <div className="flex items-center justify-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            Loading patients…
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Patient Care List</CardTitle>
        <CardDescription>Select a patient to record vitals and care notes</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search patients by name, ID, or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        {selectedIds.length > 0 && (
          <div className="rounded-md border p-3 space-y-2 bg-muted/40">
            <div className="font-medium text-foreground">Record Vitals for {selectedIds.length} selected</div>
            <div className="grid gap-2 md:grid-cols-5">
              <Input
                placeholder="BP (e.g., 120/80)"
                value={bulkVitals.bloodPressure}
                onChange={(e)=>setBulkVitals({...bulkVitals, bloodPressure:e.target.value})}
                onBlur={()=> setBulkVitals((v)=> ({...v, bloodPressure: fmtBP(v.bloodPressure)}))}
              />
              <Input
                placeholder="Temp (°C)"
                value={bulkVitals.temperature}
                onChange={(e)=>setBulkVitals({...bulkVitals, temperature:e.target.value})}
                onBlur={()=> setBulkVitals((v)=> ({...v, temperature: fmtTemp(v.temperature)}))}
              />
              <Input
                placeholder="HR (bpm)"
                value={bulkVitals.heartRate}
                onChange={(e)=>setBulkVitals({...bulkVitals, heartRate:e.target.value})}
                onBlur={()=> setBulkVitals((v)=> ({...v, heartRate: fmtBpm(v.heartRate)}))}
              />
              <Input
                placeholder="RR (/min)"
                value={bulkVitals.respiratoryRate}
                onChange={(e)=>setBulkVitals({...bulkVitals, respiratoryRate:e.target.value})}
                onBlur={()=> setBulkVitals((v)=> ({...v, respiratoryRate: fmtRR(v.respiratoryRate)}))}
              />
              <Input
                placeholder="SpO2 (%)"
                value={bulkVitals.oxygenSaturation}
                onChange={(e)=>setBulkVitals({...bulkVitals, oxygenSaturation:e.target.value})}
                onBlur={()=> setBulkVitals((v)=> ({...v, oxygenSaturation: fmtSpO2(v.oxygenSaturation)}))}
              />
            </div>
            <Input placeholder="Notes (optional)" value={bulkVitals.notes} onChange={(e)=>setBulkVitals({...bulkVitals, notes:e.target.value})} />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={()=> setSelectedIds([])}>Clear Selection</Button>
              <Button onClick={async ()=>{
                if (!user) { toast.error('Not authenticated'); return }
                if (!hasAnyBulkField) { toast.error('Enter at least one vital or note'); return }
                const now = new Date();
                let ok = 0, fail = 0
                for (const id of selectedIds) {
                  const p = patients.find(x=>x.id===id); if (!p) { fail++; continue }
                  try {
                    const res = await fetch('/api/vitals', {
                      method: 'POST',
                      credentials: 'include',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        patientId: id,
                        bloodPressure: bulkVitals.bloodPressure,
                        temperature: bulkVitals.temperature,
                        heartRate: bulkVitals.heartRate,
                        respiratoryRate: bulkVitals.respiratoryRate,
                        oxygenSaturation: bulkVitals.oxygenSaturation,
                        notes: bulkVitals.notes || undefined,
                      })
                    })
                    if (!res.ok) throw new Error((await res.json().catch(()=>({} as any)))?.error || 'Failed')
                    ok++
                  } catch (e:any) {
                    fail++
                    toast.error(`Failed for ${p.firstName} ${p.lastName}`, { description: e?.message || 'Error' })
                  }
                }
                if (ok) toast.success(`Recorded vitals for ${ok} patient(s)`) 
                if (fail && !ok) toast.error('Failed to record vitals for selected patients')
                setSelectedIds([])
                setBulkVitals({ bloodPressure:'', temperature:'', heartRate:'', respiratoryRate:'', oxygenSaturation:'', notes:'' })
              }}
              disabled={selectedIds.length===0}
              >Record Vitals</Button>
            </div>
          </div>
        )}

        {displayedPatients.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground">
            <Search className="h-6 w-6 mb-2" />
            {searchQuery ? (
              <>
                <p>No results for "{searchQuery}"</p>
                <Button variant="outline" size="sm" className="mt-3" onClick={()=> setSearchQuery("")}>Clear search</Button>
              </>
            ) : (
              <p>No patients found</p>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left">
                  <th className="py-2 px-2">
                    <input
                      id="select-all-care"
                      name="selectAllCare"
                      type="checkbox"
                      checked={selectedIds.length>0 && selectedIds.length===displayedPatients.length}
                      aria-label="Select all"
                      onChange={(e)=> setSelectedIds(e.target.checked ? displayedPatients.map(p=>p.id) : [])}
                    />
                  </th>
                  <th className="py-2 px-2">P.ID</th>
                  <th className="py-2 px-2">Name</th>
                  <th className="py-2 px-2">Age</th>
                  <th className="py-2 px-2">Sex</th>
                  <th className="py-2 px-2">Blood</th>
                  <th className="py-2 px-2">Latest Vitals</th>
                  <th className="py-2 px-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayedPatients.map((patient) => {
                  const latestVitals = getLatestVitals(patient.id)
                  const pid = formatPatientDigits(patient.patientNumber)
                  let age = '' as any
                  try {
                    if (patient.ageYears) age = patient.ageYears
                    else if (patient.dateOfBirth) {
                      const dob = new Date(patient.dateOfBirth)
                      const now = new Date()
                      age = now.getFullYear() - dob.getFullYear() - ((now.getMonth()<dob.getMonth()||(now.getMonth()===dob.getMonth()&&now.getDate()<dob.getDate()))?1:0)
                    }
                  } catch {}
                  const checked = selectedIds.includes(patient.id)
                  return (
                    <tr key={patient.id} className="border-b hover:bg-muted/30">
                      <td className="py-2 px-2">
                        <input
                          type="checkbox"
                          id={`sel-${patient.id}`}
                          name={`select-${patient.id}`}
                          checked={checked}
                          onChange={(e)=> setSelectedIds((prev)=> e.target.checked ? [...prev, patient.id] : prev.filter(x=>x!==patient.id))}
                        />
                      </td>
                      <td className="py-2 px-2 font-mono">{pid}</td>
                      <td className="py-2 px-2">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground">{patient.firstName} {patient.lastName}</span>
                          {patient.allergies && <Badge variant="destructive">Allergies</Badge>}
                        </div>
                      </td>
                      <td className="py-2 px-2">{age || '-'}</td>
                      <td className="py-2 px-2">{patient.gender}</td>
                      <td className="py-2 px-2">{patient.bloodGroup || '-'}</td>
                      <td className="py-2 px-2 text-xs text-muted-foreground">
                        {latestVitals ? (
                          <div className="space-x-2">
                            <span>BP {latestVitals.bloodPressure}</span>
                            <span>Temp {latestVitals.temperature}</span>
                            <span>HR {latestVitals.heartRate}</span>
                            <span>on {latestVitals.date}</span>
                          </div>
                        ) : (
                          <span>-</span>
                        )}
                      </td>
                      <td className="py-2 px-2 text-right space-x-2">
                        <Button size="sm" onClick={() => onSelectPatient(patient.id, 'vitals')}>
                          <Stethoscope className="mr-2 h-4 w-4" /> Vitals
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => onSelectPatient(patient.id, 'notes')}>
                          Note
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => onSelectPatient(patient.id, 'triage')}>
                          Triage
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
    </Card>
  )
}
