"use client"

import React, { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { DashboardLayout } from '@/components/dashboard-layout'

type Mapping = { id: number; resourceType: string; field: string; fhirElement: string; facilityId?: string }

export default function FhirAdminPage() {
  const { user } = useAuth()
  const [mappings, setMappings] = useState<Mapping[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ resourceType: 'Patient', field: '', fhirElement: '', facilityId: '' })

  useEffect(() => {
    if (!user) return
    fetch('/api/admin/integrations/fhir', { headers: { Authorization: `Bearer ${user.token}` } })
      .then(r => r.json())
      .then(data => { if (data.ok) setMappings(data.rows); setLoading(false) })
      .catch(() => setLoading(false))
  }, [user])

  async function create() {
    const res = await fetch('/api/admin/integrations/fhir', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user?.token}` }, body: JSON.stringify(form) })
    const data = await res.json()
    if (data.ok) setMappings([data.mapping, ...mappings])
  }

  return (
    <DashboardLayout>
      <div className="p-6">
        <h2 className="text-2xl mb-4">FHIR Mappings</h2>
        <div className="mb-4">
          <input value={form.resourceType} onChange={e => setForm({ ...form, resourceType: e.target.value })} placeholder="Resource Type" />
          <input value={form.field} onChange={e => setForm({ ...form, field: e.target.value })} placeholder="Field" />
          <input value={form.fhirElement} onChange={e => setForm({ ...form, fhirElement: e.target.value })} placeholder="FHIR Element Path" />
          <input value={form.facilityId} onChange={e => setForm({ ...form, facilityId: e.target.value })} placeholder="Facility ID (optional)" />
          <button onClick={create}>Create</button>
        </div>
        <div>
          {loading ? <div>Loading...</div> : (
            <table>
              <thead><tr><th>ID</th><th>Resource</th><th>Field</th><th>FHIR Element</th><th>Facility</th></tr></thead>
              <tbody>
                {mappings.map(m => (
                  <tr key={m.id}><td>{m.id}</td><td>{m.resourceType}</td><td>{m.field}</td><td>{m.fhirElement}</td><td>{m.facilityId}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}
