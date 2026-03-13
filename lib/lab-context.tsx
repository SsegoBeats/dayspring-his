"use client"

import { createContext, useContext, useEffect, useMemo, useState, useCallback, type ReactNode } from "react"
import { useAuth } from "@/lib/auth-context"

export interface LabTest {
  id: string
  patientId: string
  patientNumber?: string | null
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
  collectedBy?: string | null
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
  rejectionReason?: string | null
}

interface LabContextType {
  tests: LabTest[]
  loading: boolean
  refresh: (params?: { status?: string; q?: string; patientId?: string }) => Promise<void>
  orderTest: (input: { patientId: string; tests?: any[]; testName?: string; testType?: string; priority?: string; specimenType?: string; notes?: string; loincCode?: string }) => Promise<{ ids: string[] } | null>
  updateTest: (id: string, updates: Partial<LabTest>) => void
}

const LabContext = createContext<LabContextType | undefined>(undefined)
const LIVE_LAB_ROLES = new Set(["Hospital Admin", "Clinician", "Midwife", "Dentist", "Lab Tech", "Radiologist"])

export function LabProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [tests, setTests] = useState<LabTest[]>([])
  const [loading, setLoading] = useState(false)
  const hasLiveLabAccess = Boolean(user && LIVE_LAB_ROLES.has(user.role))

  const refresh = useCallback(async (params?: { status?: string; q?: string; patientId?: string }) => {
    if (!hasLiveLabAccess) {
      setTests([])
      setLoading(false)
      return
    }
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
  }, [hasLiveLabAccess])

  useEffect(() => {
    if (!hasLiveLabAccess) {
      setTests([])
      setLoading(false)
      return
    }
    refresh().catch(()=>{})
  }, [hasLiveLabAccess, refresh])

  // Live updates via SSE
  useEffect(() => {
    if (!hasLiveLabAccess) return
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
  }, [hasLiveLabAccess])

  const orderTest: LabContextType['orderTest'] = useCallback(async (input) => {
    try {
      const res = await fetch('/api/lab-tests', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) })
      if (!res.ok) return null
      const data = await res.json()
      await refresh()
      if (Array.isArray(data.tests)) return { ids: data.tests.map((t:any)=> t.id) }
      if (data.id) return { ids: [data.id] }
      return { ids: [] }
    } catch { return null }
  }, [refresh])

  const updateTest = useCallback((id: string, updates: Partial<LabTest>) => {
    setTests(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t))
    // Trigger a refresh to ensure data consistency
    setTimeout(() => refresh().catch(() => {}), 500)
  }, [refresh])

  const value = useMemo(() => ({ tests, loading, refresh, orderTest, updateTest }), [tests, loading, refresh, orderTest, updateTest])
  return <LabContext.Provider value={value}>{children}</LabContext.Provider>
}

export function useLab() {
  const ctx = useContext(LabContext)
  if (!ctx) throw new Error('useLab must be used within a LabProvider')
  return ctx
}
