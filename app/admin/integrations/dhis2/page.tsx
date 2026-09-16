"use client"

import React, { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { DashboardLayout } from '@/components/dashboard-layout'

type Mapping = { id: number; resourceType: string; field: string; dataElement: string; facilityId?: string }

export default function Dhis2AdminPage() {
  const { user } = useAuth()
  const [mappings, setMappings] = useState<Mapping[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ resourceType: 'Patient', field: '', dataElement: '', facilityId: '' })

  useEffect(() => {
    if (!user) return
    fetch('/api/admin/integrations/dhis2', { headers: { Authorization: `Bearer ${user.token}` } })
      .then(r => r.json())
      .then(data => { if (data.ok) setMappings(data.rows); setLoading(false) })
      .catch(() => setLoading(false))
  }, [user])

  async function create() {
    const res = await fetch('/api/admin/integrations/dhis2', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user?.token}` }, body: JSON.stringify(form) })
    const data = await res.json()
    if (data.ok) setMappings([data.mapping, ...mappings])
  }

  async function update(id: number, patch: Partial<Mapping>) {
    const res = await fetch(`/api/admin/integrations/dhis2/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user?.token}` }, body: JSON.stringify(patch) })
    const data = await res.json()
    if (data.ok) setMappings(mappings.map(m => m.id === id ? data.mapping : m))
  }

  async function remove(id: number) {
    await fetch(`/api/admin/integrations/dhis2/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${user?.token}` } })
    setMappings(mappings.filter(m => m.id !== id))
  }

  if (!user) return <div>Unauthorized</div>

  return (
    <DashboardLayout>
      <div className="p-6">
        <h2 className="text-2xl mb-4">DHIS2 Mappings</h2>
        <div className="mb-4">
          <input value={form.resourceType} onChange={e => setForm({ ...form, resourceType: e.target.value })} placeholder="Resource Type" />
          <input value={form.field} onChange={e => setForm({ ...form, field: e.target.value })} placeholder="Field" />
          <input value={form.dataElement} onChange={e => setForm({ ...form, dataElement: e.target.value })} placeholder="Data Element ID" />
          <input value={form.facilityId} onChange={e => setForm({ ...form, facilityId: e.target.value })} placeholder="Facility ID (optional)" />
          <button onClick={create}>Create</button>
        </div>
        <div>
          {loading ? <div>Loading...</div> : (
            <table>
              <thead><tr><th>ID</th><th>Resource</th><th>Field</th><th>Data Element</th><th>Facility</th><th></th></tr></thead>
              <tbody>
                {mappings.map(m => (
                  <tr key={m.id}>
                    <td>{m.id}</td>
                    <td>{m.resourceType}</td>
                    <td>
                      <input defaultValue={m.field} onBlur={(e) => update(m.id, { field: e.currentTarget.value })} />
                    </td>
                    <td>
                      <input defaultValue={m.dataElement} onBlur={(e) => update(m.id, { dataElement: e.currentTarget.value })} />
                    </td>
                    <td>
                      <input defaultValue={m.facilityId || ''} onBlur={(e) => update(m.id, { facilityId: e.currentTarget.value || undefined })} />
                    </td>
                    <td><button onClick={() => remove(m.id)}>Delete</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}
