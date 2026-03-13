"use client"

import type { ReactNode } from "react"
import { useEffect, useState, useCallback, useMemo } from "react"
import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { ErrorBoundary } from "@/components/error-boundary"
import { LogOut, Bell } from "lucide-react"
import Link from 'next/link'
import Image from 'next/image'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { formatPatientNumber } from "@/lib/patients"
import { ORG_NAME, ORG_LOGO_PATH, ORG_SUBTITLE } from "@/lib/org-constants"
import { toast } from "sonner"

interface DashboardLayoutProps {
  children: ReactNode
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { user, logout } = useAuth()

  const getRoleLabel = (role: string) => {
    const roleMap: Record<string, string> = {
      receptionist: "Receptionist",
      clinician: "Clinician",
      radiologist: "Radiologist",
      nurse: "Nurse",
      "lab-tech": "Lab Technician",
      admin: "Hospital Admin",
      cashier: "Cashier",
      pharmacist: "Pharmacist",
      midwife: "Midwife",
      dentist: "Dentist",
    }
    return roleMap[(role || "").toLowerCase()] || role
  }

  const showSchedulesLink = user && ["Clinician", "Midwife", "Dentist"].includes(user.role)
  const showAncLink = user && user.role === "Midwife"

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-50 border-b border-border bg-card print:hidden">
        <div className="flex h-16 items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <Image
              src={ORG_LOGO_PATH}
              alt={`${ORG_NAME} logo`}
              width={32}
              height={32}
              className="h-8 w-8 object-contain"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }}
            />
            <div>
              <h1 className="text-lg font-semibold text-foreground">{ORG_NAME}</h1>
              <p className="text-xs text-muted-foreground">{ORG_SUBTITLE}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-medium text-foreground">{user?.name}</p>
              <p className="text-xs text-muted-foreground">{user && getRoleLabel(user.role)}</p>
            </div>
            <NotificationsBell userRole={user?.role} />
            {showAncLink && (
              <Link href="/midwife/anc">
                <Button variant="ghost" size="sm">ANC</Button>
              </Link>
            )}
            {showSchedulesLink && (
              <Link href="/clinician/schedules">
                <Button variant="ghost" size="sm">Schedules</Button>
              </Link>
            )}
            <Link href="/settings">
              <Button variant="secondary" size="sm">Settings</Button>
            </Link>
            <Button variant="outline" size="sm" onClick={logout}>
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>
      </header>
      <main className="flex-1 bg-secondary/30 p-6 print:p-0 print:bg-white print:min-h-0">
        <ErrorBoundary fallbackTitle="Dashboard error" fallbackDescription="Something went wrong. Try again or refresh the page.">
          {children}
        </ErrorBoundary>
      </main>
      <AdminDeletionWatcher userRole={user?.role} />

    </div>
  )
}

function NotificationsBell({ userRole }: { userRole?: string }) {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState<'all'|'unread'|'lab'>('all')
  const normalizedRole = (userRole || "").toLowerCase()
  const resultFilterLabel = normalizedRole === 'radiologist' ? 'Imaging' : 'Lab'
  const unread = useMemo(() => items.reduce((count, n) => count + (!n.read_at ? 1 : 0), 0), [items])
  const load = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/notifications', { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        const list = Array.isArray(data.notifications) ? data.notifications : []
        setItems(list)
      }
    } finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])
  useEffect(() => {
    const id = setInterval(() => { load().catch(()=>{}) }, 30000)
    return () => clearInterval(id)
  }, [load])
  useEffect(() => {
    let es: EventSource | null = null
    let timeoutId: ReturnType<typeof setTimeout> | null = null
    let mounted = true
    const connect = () => {
      if (!mounted) return
      try {
        const hasCookie = typeof document !== 'undefined' && /(?:^|;\s)(session=|session_dev=)/.test(document.cookie)
        const tokenMatch = typeof document !== 'undefined' ? (document.cookie.match(/(?:^|;\s)session_dev=([^;]+)/) || document.cookie.match(/(?:^|;\s)session=([^;]+)/)) : null
        const token = tokenMatch ? decodeURIComponent(tokenMatch[1]) : (typeof localStorage !== 'undefined' ? localStorage.getItem('session_dev_bearer') : null)
        const url = new URL('/api/notifications/stream', window.location.origin)
        if (!hasCookie && token) url.searchParams.set('t', token)
        const source = new (window as any).EventSource(url.toString(), { withCredentials: true }) as EventSource
        es = source
        source.onmessage = (ev: MessageEvent) => {
          try {
            const data = JSON.parse(ev.data)
            const incoming = Array.isArray(data.notifications) ? data.notifications : []
            if (incoming.length === 0) return
            setItems((prev) => {
              const prevIds = new Set(prev.map((x: any) => x.id))
              const added: any[] = []
              for (const n of incoming) {
                if (!n?.id || prevIds.has(n.id)) continue
                prevIds.add(n.id)
                added.push(n)
              }
              if (added.length === 0) return prev

              // Show at most one toast per SSE payload to avoid layout thrash under bursty updates.
              const firstLab = added.find((n) => {
                try {
                  const payload = n.payload ? (typeof n.payload === 'string' ? JSON.parse(n.payload) : n.payload) : null
                  return /lab results/i.test(n.title || '')
                    || /radiology|imaging/i.test(n.title || '')
                    || /radiology|imaging/i.test(n.message || '')
                    || Boolean(payload && (payload.testId || payload.testIds?.[0]))
                } catch {
                  return false
                }
              })
              if (firstLab) {
                let payload: any = null
                try {
                  payload = firstLab.payload
                    ? (typeof firstLab.payload === 'string' ? JSON.parse(firstLab.payload) : firstLab.payload)
                    : null
                } catch {}
                const patientId = payload?.patientId
                const testId = payload?.testId || payload?.testIds?.[0]
                const openAction = normalizedRole === 'radiologist' && testId
                  ? {
                      label: 'Open',
                      onClick: () => {
                        try {
                          window.dispatchEvent(
                            new CustomEvent('openRadiologyStudy', {
                              detail: { testId, patientId, notificationId: firstLab.id },
                            }),
                          )
                        } catch {}
                      },
                    }
                  : patientId
                    ? {
                        label: 'Open',
                        onClick: () => {
                          try {
                            window.dispatchEvent(
                              new CustomEvent('openClinicianConsult', {
                                detail: { patientId, initialTab: 'labs', notificationId: firstLab.id },
                              }),
                            )
                          } catch {}
                        },
                      }
                    : undefined
                toast(firstLab.title || 'Lab Results Ready', {
                  description: firstLab.message || '',
                  action: openAction,
                })
              }

              return [...added, ...prev].slice(0, 100)
            })
          } catch {}
        }
        source.onerror = () => {
          try { source.close() } catch {}
          es = null
          // Reconnect after disconnect (e.g. Vercel 300s timeout); backoff 2-30s
          if (mounted && timeoutId == null) {
            const delay = Math.min(2000 + Math.random() * 4000, 30000)
            timeoutId = setTimeout(() => { timeoutId = null; connect() }, delay)
          }
        }
      } catch {}
    }
    connect()
    return () => {
      mounted = false
      if (timeoutId) clearTimeout(timeoutId)
      try { es?.close() } catch {}
    }
  }, [normalizedRole])
  const markRead = useCallback(async (ids: string[]) => {
    try { await fetch('/api/notifications', { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids }) }); await load() } catch {}
  }, [load])
  const deleteNotification = useCallback(async (id: string) => {
    try { 
      await fetch('/api/notifications', { method: 'DELETE', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: [id] }) })
      await load() 
    } catch {}
  }, [load])
  const clearAll = useCallback(async () => {
    try {
      const allIds = items.map((n:any) => n.id)
      if (allIds.length > 0) {
        await fetch('/api/notifications', { method: 'DELETE', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: allIds }) })
        await load()
      }
    } catch {}
  }, [items, load])
  const filteredItems = useMemo(() => {
    return items.filter((n: any) => {
      if (filter === 'unread') return !n.read_at
      if (filter === 'lab') {
        try {
          const payload = n.payload ? (typeof n.payload === 'string' ? JSON.parse(n.payload) : n.payload) : null
          return /lab/i.test(n.title || '')
            || /lab/i.test(n.message || '')
            || /radiology|imaging/i.test(n.title || '')
            || /radiology|imaging/i.test(n.message || '')
            || Boolean(payload && (payload.testId || payload.testIds?.[0] || payload.testType))
        } catch {
          return false
        }
      }
      return true
    })
  }, [filter, items])
  const openNotificationTarget = useCallback((notification: any, requestId?: string, patientId?: string) => {
    if (requestId) {
      window.dispatchEvent(new CustomEvent('openDeletionDialog', { detail: { requestId } }))
      markRead([notification.id])
      return
    }
    let payload: any = null
    try {
      payload = notification.payload ? (typeof notification.payload === 'string' ? JSON.parse(notification.payload) : notification.payload) : null
    } catch {}
    const testId = payload?.testId || payload?.testIds?.[0]
    if (normalizedRole === 'radiologist') {
      if (!testId) return
      window.dispatchEvent(new CustomEvent('openRadiologyStudy', { detail: { testId, patientId, notificationId: notification.id } }))
      return
    }
    if (!patientId) return
    if (normalizedRole === 'nurse') {
      const initialTab = /new patient registered/i.test(notification.title || '') ? 'triage' : 'vitals'
      window.dispatchEvent(new CustomEvent('openNursePatientCare', { detail: { patientId, initialTab, notificationId: notification.id } }))
      return
    }
    window.dispatchEvent(new CustomEvent('openClinicianConsult', { detail: { patientId, initialTab: 'labs', notificationId: notification.id } }))
  }, [markRead, normalizedRole])
  const getNotificationHint = useCallback((notification: any, requestId?: string, patientId?: string) => {
    if (requestId) return 'Click to review request'
    let payload: any = null
    try {
      payload = notification.payload ? (typeof notification.payload === 'string' ? JSON.parse(notification.payload) : notification.payload) : null
    } catch {}
    const testId = payload?.testId || payload?.testIds?.[0]
    if (normalizedRole === 'radiologist' && testId) return 'Click to open radiology study'
    if (!patientId) return null
    if (normalizedRole === 'nurse') {
      return /new patient registered/i.test(notification.title || '') ? 'Click to start triage' : 'Click to open patient care'
    }
    return 'Click to open Lab Results'
  }, [normalizedRole])
  return (
    <div className="relative">
      <button
        onClick={()=> setOpen((v:boolean)=>!v)}
        className="relative inline-flex items-center rounded-md border px-3 py-1.5 text-sm"
        aria-label="Open notifications"
        title="Notifications"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && !open && <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] text-white">{unread}</span>}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-96 rounded-md border bg-card p-2 shadow-md z-50">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-sm font-semibold">Notifications</div>
            <div className="flex items-center gap-2">
              <button onClick={load} className="text-xs text-muted-foreground">{loading? 'Refreshing...':'Refresh'}</button>
              {items.length > 0 && (
                <button onClick={clearAll} className="text-xs text-red-600 hover:text-red-700">Clear all</button>
              )}
            </div>
          </div>
          <div className="mb-2 flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">Filter:</span>
            <button className={`rounded px-2 py-0.5 border ${filter==='all'?'bg-secondary text-foreground':'text-muted-foreground'}`} onClick={()=> setFilter('all')}>All</button>
            <button className={`rounded px-2 py-0.5 border ${filter==='unread'?'bg-secondary text-foreground':'text-muted-foreground'}`} onClick={()=> setFilter('unread')}>Unread</button>
            <button className={`rounded px-2 py-0.5 border ${filter==='lab'?'bg-secondary text-foreground':'text-muted-foreground'}`} onClick={()=> setFilter('lab')}>{resultFilterLabel}</button>
          </div>
          <div className="max-h-80 overflow-auto divide-y">
            {filteredItems.length === 0 ? (
              <div className="p-3 text-sm text-muted-foreground">No notifications</div>
            ) : filteredItems.map((n:any)=> {
              // Check if this is a deletion request notification
              const isDeletionRequest = n.title === 'Patient Deletion Request' || n.title?.includes('Deletion')
              let payload: any = null
              try {
                if (n.payload) payload = typeof n.payload === 'string' ? JSON.parse(n.payload) : n.payload
              } catch {}
              const requestId = payload?.requestId
              const patientId = payload?.patientId
              const isLabReviewed = /lab result reviewed/i.test(n.title || '')
              const actionHint = getNotificationHint(n, requestId, patientId)
              const isClickable = Boolean(actionHint)
              
              return (
                <div 
                  key={n.id} 
                  className={`p-2 text-sm relative group ${isClickable ? 'cursor-pointer hover:bg-secondary/50' : ''}`}
                  onClick={isClickable ? () => openNotificationTarget(n, requestId, patientId) : undefined}
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      deleteNotification(n.id)
                    }}
                    className="absolute right-1 top-1 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground text-xs p-1"
                    title="Close notification"
                  >
                    <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                    <div className="flex items-start justify-between gap-2 pr-6">
                      <div className="flex-1">
                      <div className="font-medium flex items-center gap-2">
                        <span>{n.title}</span>
                        {isLabReviewed && <span className="rounded px-1.5 py-0.5 text-[10px] bg-green-100 text-green-800 border border-green-200">Reviewed</span>}
                      </div>
                      <div className="text-muted-foreground">{n.message}</div>
                      <div className="text-xs text-muted-foreground mt-1">{new Date(n.created_at).toLocaleString()} {n.department ? `- ${n.department}` : n.role ? `- ${n.role}` : ''}</div>
                      {actionHint ? (
                        <div className="text-xs text-blue-600 mt-1">{actionHint}</div>
                      ) : null}
                    </div>
                    {!n.read_at && !isDeletionRequest && (
                      <button onClick={(e) => { e.stopPropagation(); markRead([n.id]) }} className="text-xs text-blue-600">Mark read</button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
          {items.some((n:any)=>!n.read_at) && (
            <div className="mt-2 text-right">
              <button onClick={()=> markRead(items.filter((n:any)=>!n.read_at).map((n:any)=>n.id))} className="text-xs text-blue-600">Mark all read</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}


function AdminDeletionWatcher({ userRole }: { userRole?: string }) {
  const [open, setOpen] = useState(false)
  const [pendingReq, setPendingReq] = useState<any | null>(null)
  const [lastSeenReqId, setLastSeenReqId] = useState<string | null>(null)

  const isAdmin = (userRole || '').toLowerCase() === 'hospital admin' || (userRole || '').toLowerCase() === 'admin'

  // Function to open dialog with a specific request
  const openDialog = useCallback(async (requestId: string) => {
    try {
      const res = await fetch(`/api/patient-deletions?status=Pending`, { credentials: 'include' })
      if (!res.ok) return
      const data = await res.json()
      const req = (data.requests || []).find((r: any) => r.id === requestId)
      if (req) {
        setPendingReq(req)
        setOpen(true)
        setLastSeenReqId(req.id)
      }
    } catch {}
  }, [])

  useEffect(() => {
    if (!isAdmin) return
    let cancelled = false as any
    let timer: any
    const tick = async () => {
      try {
        const res = await fetch('/api/patient-deletions?status=Pending', { credentials: 'include' })
        if (!res.ok) return
        const data = await res.json()
        const req = (data.requests || [])[0]
        if (req && req.id !== lastSeenReqId) {
          setPendingReq(req)
          setOpen(true)
          setLastSeenReqId(req.id)
        }
      } catch {}
      if (!cancelled) timer = setTimeout(tick, 10000)
    }
    tick()
    return () => { cancelled = true; if (timer) clearTimeout(timer) }
  }, [isAdmin, lastSeenReqId])

  // Listen for custom events to open dialog from notifications
  useEffect(() => {
    if (!isAdmin) return
    const handler = ((e: CustomEvent) => {
      const requestId = e.detail?.requestId
      if (requestId) {
        openDialog(requestId)
      }
    }) as EventListener
    window.addEventListener('openDeletionDialog', handler)
    return () => window.removeEventListener('openDeletionDialog', handler)
  }, [isAdmin, openDialog])

  if (!isAdmin) return null

  const act = async (approve: boolean) => {
    try {
      await fetch('/api/patient-deletions', {
        method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId: pendingReq?.id, approve })
      })
      // Refresh after action
      setLastSeenReqId(null)
    } finally {
      setOpen(false)
      setPendingReq(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Patient Deletion Approval</DialogTitle>
          <DialogDescription>
            Review the deletion request details below before making a decision.
          </DialogDescription>
        </DialogHeader>
        {pendingReq ? (
          <div className='space-y-2 text-sm'>
            <div><span className='text-muted-foreground'>Requested by:</span> {pendingReq.requested_by_name} ({pendingReq.requested_by_role})</div>
            <div><span className='text-muted-foreground'>Patient:</span> {pendingReq.first_name} {pendingReq.last_name} ({formatPatientNumber(pendingReq.patient_number)})</div>
            <div><span className='text-muted-foreground'>Reason:</span> {pendingReq.reason}</div>
          </div>
        ) : null}
        <div className='flex justify-end gap-2'>
          <button className='rounded border px-3 py-1 text-sm' onClick={()=> setOpen(false)}>Close</button>
          <button className='rounded border px-3 py-1 text-sm' onClick={()=> act(false)}>Reject</button>
          <button className='rounded bg-red-600 text-white px-3 py-1 text-sm' onClick={()=> act(true)}>Approve & Delete</button>
        </div>
      </DialogContent>
    </Dialog>
  )
}





