"use client"

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react"

export interface LabTest {
  id: string
  patientId: string
  patientName: string
  doctorId: string
  doctorName: string
  testName: string
  testType: string
  status: 'Pending' | 'In Progress' | 'Completed' | 'Cancelled'
  priority?: 'Routine' | 'Stat' | string
  specimenType?: string | null
  accessionNumber?: string | null
  orderedAt: string
  completedAt?: string | null
  collectedAt?: string | null
  results?: string
  notes?: string
  labTechId?: string | null
  labTechName?: string
  reviewedBy?: string | null
  reviewedAt?: string | null
  patientGender?: string | null
  patientDob?: string | null
  assignedToId?: string | null
  assignedToName?: string | null
  assignedAt?: string | null
  loincCode?: string | null
  loincLongName?: string | null
  loincProperty?: string | null
  loincScale?: string | null
  loincSystem?: string | null
  loincTimeAspct?: string | null
  loincClass?: string | null
  loincUnits?: string | null
  resultJson?: any
}

interface LabContextType {
  tests: LabTest[]
  loading: boolean
  refresh: (params?: { status?: string; q?: string; patientId?: string }) => Promise<void>
  orderTest: (input: { patientId: string; tests?: any[]; testName?: string; testType?: string; priority?: string; specimenType?: string; notes?: string; loincCode?: string }) => Promise<{ ids: string[] } | null>
  updateTest: (id: string, updates: Partial<LabTest>) => void
}

const LabContext = createContext<LabContextType | undefined>(undefined)

export function LabProvider({ children }: { children: ReactNode }) {
  const [tests, setTests] = useState<LabTest[]>([])
  const [loading, setLoading] = useState(false)

  const refresh = async (params?: { status?: string; q?: string; patientId?: string }) => {
    setLoading(true)
    try {
      const url = new URL('/api/lab-tests', window.location.origin)
      if (params?.status) url.searchParams.set('status', params.status)
      if (params?.q) url.searchParams.set('q', params.q)
      if (params?.patientId) url.searchParams.set('patientId', params.patientId)
      const res = await fetch(url.toString(), { credentials: 'include' })
      const data = await res.json()
      setTests(Array.isArray(data.tests) ? data.tests : [])
    } catch { setTests([]) }
    finally { setLoading(false) }
  }

  useEffect(() => { refresh().catch(()=>{}) }, [])

  // Live updates via SSE
  useEffect(() => {
    try {
      const hasCookie = typeof document !== 'undefined' && /(?:^|;\s)(session=|session_dev=)/.test(document.cookie)
      const tokenMatch = typeof document !== 'undefined' ? (document.cookie.match(/(?:^|;\s)session_dev=([^;]+)/) || document.cookie.match(/(?:^|;\s)session=([^;]+)/)) : null
      const token = tokenMatch ? decodeURIComponent(tokenMatch[1]) : (typeof localStorage !== 'undefined' ? localStorage.getItem('session_dev_bearer') : null)
      const url = new URL('/api/lab-tests/stream', window.location.origin)
      if (!hasCookie && token) url.searchParams.set('t', token)
      const es = new (window as any).EventSource(url.toString(), { withCredentials: true })
      es.onmessage = (ev: MessageEvent) => {
        try {
          const data = JSON.parse(ev.data)
          if (Array.isArray(data.tests)) setTests(data.tests)
        } catch {}
      }
      es.onerror = () => { try { es.close() } catch {} }
      return () => { try { es.close() } catch {} }
    } catch {}
  }, [])

  const orderTest: LabContextType['orderTest'] = async (input) => {
    try {
      const res = await fetch('/api/lab-tests', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) })
      if (!res.ok) return null
      const data = await res.json()
      await refresh()
      if (Array.isArray(data.tests)) return { ids: data.tests.map((t:any)=> t.id) }
      if (data.id) return { ids: [data.id] }
      return { ids: [] }
    } catch { return null }
  }

  const updateTest = (id: string, updates: Partial<LabTest>) => {
    setTests(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t))
  }

  const value = useMemo(() => ({ tests, loading, refresh, orderTest, updateTest }), [tests, loading])
  return <LabContext.Provider value={value}>{children}</LabContext.Provider>
}

export function useLab() {
  const ctx = useContext(LabContext)
  if (!ctx) throw new Error('useLab must be used within a LabProvider')
  return ctx
}
