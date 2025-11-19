"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export function ReceptionRegister() {
  const [from, setFrom] = useState<string>(new Date().toISOString().slice(0,10))
  const [to, setTo] = useState<string>(new Date().toISOString().slice(0,10))
  const [department, setDepartment] = useState<string>("ALL")
  const [detailed, setDetailed] = useState<boolean>(false)

  const buildPayload = (format: 'xlsx'|'pdf') => ({
    dataset: detailed ? 'reception_register_detailed' : 'reception_register',
    format,
    filters: {
      from: new Date(from+'T00:00:00Z').toISOString(),
      to: new Date(to+'T23:59:59Z').toISOString(),
      department: department === 'ALL' ? undefined : department,
    },
  })

  const exportFile = async (format: 'xlsx'|'pdf') => {
    const payload = buildPayload(format)
    const res = await fetch('/api/exports/direct', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    if (!res.ok) return
    const blob = await res.blob(); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href=url; a.download=`reception-register-${from}-${to}.${format}`; a.click(); URL.revokeObjectURL(url)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Reception Register</CardTitle>
        <CardDescription>Summary of check-ins, queue and payments for a period</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-12">
        <div className="space-y-1 md:col-span-3">
          <label className="text-sm font-medium">From</label>
          <Input type="date" value={from} onChange={(e)=>setFrom(e.target.value)} />
        </div>
        <div className="space-y-1 md:col-span-3">
          <label className="text-sm font-medium">To</label>
          <Input type="date" value={to} onChange={(e)=>setTo(e.target.value)} />
        </div>
        <div className="space-y-1 md:col-span-3">
          <label className="text-sm font-medium">Department</label>
          <Select value={department} onValueChange={setDepartment}>
            <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All</SelectItem>
              <SelectItem value="General">General</SelectItem>
              <SelectItem value="Emergency">Emergency</SelectItem>
              <SelectItem value="Pediatrics">Pediatrics</SelectItem>
              <SelectItem value="Surgery">Surgery</SelectItem>
              <SelectItem value="Radiology">Radiology</SelectItem>
              <SelectItem value="Laboratory">Laboratory</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end gap-2 flex-wrap md:col-span-3">
          <label className="text-sm flex items-center gap-2 whitespace-nowrap">
            <input type="checkbox" checked={detailed} onChange={(e)=>setDetailed(e.target.checked)} />
            Detailed
          </label>
          <Button size="sm" variant="outline" onClick={() => exportFile('xlsx')}>Export XLSX</Button>
          <Button size="sm" variant="outline" onClick={() => exportFile('pdf')}>Export PDF</Button>
        </div>
        <div className="flex items-center gap-2 flex-wrap md:col-span-12">
          <Button
            variant="outline"
            onClick={async () => {
              // Export All PDFs: Register (respect detailed), Dashboard, Daily
              const tasks = [
                { dataset: detailed ? 'reception_register_detailed' : 'reception_register', name: `reception-register-${from}-${to}.pdf` },
                { dataset: 'reception_dashboard', name: `reception-dashboard-${from}-${to}.pdf` },
                { dataset: 'reception_daily', name: `reception-daily-${from}-${to}.pdf` },
              ]
              for (const t of tasks) {
                const payload = { dataset: t.dataset, format: 'pdf', filters: { from: new Date(from+'T00:00:00Z').toISOString(), to: new Date(to+'T23:59:59Z').toISOString(), department: department === 'ALL' ? undefined : department } }
                const res = await fetch('/api/exports/direct', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
                if (!res.ok) continue
                const blob = await res.blob(); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = t.name; a.click(); URL.revokeObjectURL(url)
              }
            }}
          >Export All PDFs</Button>
          <Button
            variant="outline"
            onClick={async () => {
              // Export All XLSX: Register (respect detailed), Dashboard, Daily
              const tasks = [
                { dataset: detailed ? 'reception_register_detailed' : 'reception_register', name: `reception-register-${from}-${to}.xlsx` },
                { dataset: 'reception_dashboard', name: `reception-dashboard-${from}-${to}.xlsx` },
                { dataset: 'reception_daily', name: `reception-daily-${from}-${to}.xlsx` },
              ]
              for (const t of tasks) {
                const payload = { dataset: t.dataset, format: 'xlsx', filters: { from: new Date(from+'T00:00:00Z').toISOString(), to: new Date(to+'T23:59:59Z').toISOString(), department: department === 'ALL' ? undefined : department } }
                const res = await fetch('/api/exports/direct', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
                if (!res.ok) continue
                const blob = await res.blob(); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = t.name; a.click(); URL.revokeObjectURL(url)
              }
            }}
          >Export All XLSX</Button>
          <Button
            variant="outline"
            onClick={async () => {
              const payload = {
                dataset: detailed ? 'reception_register_detailed' : 'reception_register',
                format: 'csv',
                filters: {
                  from: new Date(from+'T00:00:00Z').toISOString(),
                  to: new Date(to+'T23:59:59Z').toISOString(),
                  department: department === 'ALL' ? undefined : department,
                },
              }
              const res = await fetch('/api/exports/direct', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
              if (!res.ok) return
              const blob = await res.blob(); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `reception-register-${from}-${to}.csv`; a.click(); URL.revokeObjectURL(url)
            }}
          >Reception Register CSV</Button>
          <Button
            variant="outline"
            onClick={async () => {
              const payload = {
                dataset: 'reception_dashboard',
                format: 'pdf',
                filters: {
                  from: new Date(from+'T00:00:00Z').toISOString(),
                  to: new Date(to+'T23:59:59Z').toISOString(),
                  department: department === 'ALL' ? undefined : department,
                },
              }
              const res = await fetch('/api/exports/direct', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
              if (!res.ok) return
              const blob = await res.blob(); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `reception-dashboard-${from}-${to}.pdf`; a.click(); URL.revokeObjectURL(url)
            }}
          >Reception Dashboard PDF</Button>
          <Button
            variant="outline"
            onClick={async () => {
              const payload = {
                dataset: 'reception_dashboard',
                format: 'xlsx',
                filters: {
                  from: new Date(from+'T00:00:00Z').toISOString(),
                  to: new Date(to+'T23:59:59Z').toISOString(),
                  department: department === 'ALL' ? undefined : department,
                },
              }
              const res = await fetch('/api/exports/direct', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
              if (!res.ok) return
              const blob = await res.blob(); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `reception-dashboard-${from}-${to}.xlsx`; a.click(); URL.revokeObjectURL(url)
            }}
          >Reception Dashboard XLSX</Button>
          <Button
            variant="outline"
            onClick={async () => {
              const payload = {
                dataset: 'reception_daily',
                format: 'xlsx',
                filters: {
                  from: new Date(from+'T00:00:00Z').toISOString(),
                  to: new Date(to+'T23:59:59Z').toISOString(),
                  department: department === 'ALL' ? undefined : department,
                },
              }
              const res = await fetch('/api/exports/direct', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
              if (!res.ok) return
              const blob = await res.blob(); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `reception-daily-${from}-${to}.xlsx`; a.click(); URL.revokeObjectURL(url)
            }}
          >Reception Daily XLSX</Button>
          <Button
            variant="outline"
            onClick={async () => {
              const payload = {
                dataset: 'reception_daily',
                format: 'csv',
                filters: {
                  from: new Date(from+'T00:00:00Z').toISOString(),
                  to: new Date(to+'T23:59:59Z').toISOString(),
                  department: department === 'ALL' ? undefined : department,
                },
              }
              const res = await fetch('/api/exports/direct', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
              if (!res.ok) return
              const blob = await res.blob(); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `reception-daily-${from}-${to}.csv`; a.click(); URL.revokeObjectURL(url)
            }}
          >Reception Daily CSV</Button>
          <Button
            variant="outline"
            onClick={async () => {
              const payload = {
                dataset: 'reception_daily',
                format: 'pdf',
                filters: {
                  from: new Date(from+'T00:00:00Z').toISOString(),
                  to: new Date(to+'T23:59:59Z').toISOString(),
                  department: department === 'ALL' ? undefined : department,
                },
              }
              const res = await fetch('/api/exports/direct', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
              if (!res.ok) return
              const blob = await res.blob(); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `reception-daily-${from}-${to}.pdf`; a.click(); URL.revokeObjectURL(url)
            }}
          >Reception Daily PDF</Button>
          <Button
            variant="outline"
            onClick={async () => {
              const payload = {
                dataset: 'reception_dashboard',
                format: 'csv',
                filters: {
                  from: new Date(from+'T00:00:00Z').toISOString(),
                  to: new Date(to+'T23:59:59Z').toISOString(),
                  department: department === 'ALL' ? undefined : department,
                },
              }
              const res = await fetch('/api/exports/direct', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
              if (!res.ok) return
              const blob = await res.blob(); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `reception-dashboard-${from}-${to}.csv`; a.click(); URL.revokeObjectURL(url)
            }}
          >Reception Dashboard CSV</Button>
        </div>
      </CardContent>
    </Card>
  )
}

