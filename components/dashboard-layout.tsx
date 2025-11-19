"use client"

import type { ReactNode } from "react"
import { useEffect, useState } from "react"
import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { LogOut, Hospital, Bell } from "lucide-react"
import Link from 'next/link'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'

interface DashboardLayoutProps {
  children: ReactNode
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { user, logout } = useAuth()

  const getRoleLabel = (role: string) => {
    const roleMap: Record<string, string> = {
      receptionist: "Receptionist",
      doctor: "Doctor",
      radiologist: "Radiologist",
      nurse: "Nurse",
      "lab-tech": "Lab Technician",
      admin: "Hospital Admin",
      cashier: "Cashier",
      pharmacist: "Pharmacist",
    }
    return roleMap[role] || role
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-50 border-b border-border bg-card">
        <div className="flex h-16 items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <Hospital className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-lg font-semibold text-foreground">Dayspring Medical Center</h1>
              <p className="text-xs text-muted-foreground">Hospital Information System</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-medium text-foreground">{user?.name}</p>
              <p className="text-xs text-muted-foreground">{user && getRoleLabel(user.role)}</p>
            </div>
            <NotificationsBell />
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
      <main className="flex-1 bg-secondary/30 p-6">{children}</main>
      <AdminDeletionWatcher userRole={user?.role} />

    </div>
  )
}

function NotificationsBell() {
  const [open, setOpen] = (require('react') as any).useState(false)
  const [items, setItems] = (require('react') as any).useState<any[]>([])
  const [loading, setLoading] = (require('react') as any).useState(false)
  const [unread, setUnread] = (require('react') as any).useState(0)
  const [filter, setFilter] = (require('react') as any).useState<'all'|'unread'|'lab'>('all')
  const load = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/notifications', { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        const list = Array.isArray(data.notifications) ? data.notifications : []
        setItems(list)
        setUnread(list.filter((n:any)=>!n.read_at).length)
      }
    } finally { setLoading(false) }
  }
  ;(require('react') as any).useEffect(() => { load() }, [])
  ;(require('react') as any).useEffect(() => {
    const id = setInterval(() => { load().catch(()=>{}) }, 30000)
    return () => clearInterval(id)
  }, [])
  ;(require('react') as any).useEffect(() => {
    try {
      const hasCookie = typeof document !== 'undefined' && /(?:^|;\s)(session=|session_dev=)/.test(document.cookie)
      const tokenMatch = typeof document !== 'undefined' ? (document.cookie.match(/(?:^|;\s)session_dev=([^;]+)/) || document.cookie.match(/(?:^|;\s)session=([^;]+)/)) : null
      const token = tokenMatch ? decodeURIComponent(tokenMatch[1]) : (typeof localStorage !== 'undefined' ? localStorage.getItem('session_dev_bearer') : null)
      const url = new URL('/api/notifications/stream', window.location.origin)
      if (!hasCookie && token) url.searchParams.set('t', token)
      const es = new (window as any).EventSource(url.toString(), { withCredentials: true })
      es.onmessage = (ev: MessageEvent) => {
        try {
          const data = JSON.parse(ev.data)
          if (Array.isArray(data.notifications)) {
            const prevIds = new Set(items.map((x:any)=> x.id))
            // Show toast for newly arrived lab results
            const toast = (require('sonner') as any).toast
            for (const n of data.notifications) {
              if (!prevIds.has(n.id)) {
                try {
                  const payload = n.payload ? (typeof n.payload === 'string' ? JSON.parse(n.payload) : n.payload) : null
                  const isLab = /lab results/i.test(n.title || '') || (payload && payload.testId && payload.testType)
                  if (isLab && typeof toast === 'function') {
                    const patientId = payload?.patientId
                    toast(n.title || 'Lab Results Ready', {
                      description: n.message || '',
                      action: patientId ? {
                        label: 'Open',
                        onClick: () => {
                          try {
                            window.dispatchEvent(new CustomEvent('openDoctorConsult', { detail: { patientId, initialTab: 'labs', notificationId: n.id } }))
                          } catch {}
                        }
                      } : undefined
                    })
                  }
                } catch {}
              }
            }
            setItems(data.notifications)
            setUnread(data.notifications.filter((n:any)=>!n.read_at).length)
          }
        } catch {}
      }
      es.onerror = () => { try { es.close() } catch {} }
      return () => { try { es.close() } catch {} }
    } catch {}
  }, [])
  const markRead = async (ids: string[]) => {
    try { await fetch('/api/notifications', { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids }) }); await load() } catch {}
  }
  const deleteNotification = async (id: string) => {
    try { 
      await fetch('/api/notifications', { method: 'DELETE', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: [id] }) })
      await load() 
    } catch {}
  }
  const clearAll = async () => {
    try {
      const allIds = items.map((n:any) => n.id)
      if (allIds.length > 0) {
        await fetch('/api/notifications', { method: 'DELETE', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: allIds }) })
        await load()
      }
    } catch {}
  }
  return (
    <div className="relative">
      <button onClick={()=> setOpen((v:boolean)=>!v)} className="relative inline-flex items-center rounded-md border px-3 py-1.5 text-sm">
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
            <button className={`rounded px-2 py-0.5 border ${filter==='lab'?'bg-secondary text-foreground':'text-muted-foreground'}`} onClick={()=> setFilter('lab')}>Lab</button>
          </div>
          <div className="max-h-80 overflow-auto divide-y">
            {items.filter((n:any)=>{
              if (filter==='unread') return !n.read_at
              if (filter==='lab') {
                try {
                  const payload = n.payload ? (typeof n.payload === 'string' ? JSON.parse(n.payload) : n.payload) : null
                  const isLab = /lab/i.test(n.title||'') || /lab/i.test(n.message||'') || (payload && (payload.testId || payload.testType))
                  return isLab
                } catch { return false }
              }
              return true
            }).length === 0 ? (
              <div className="p-3 text-sm text-muted-foreground">No notifications</div>
            ) : items.filter((n:any)=>{
              if (filter==='unread') return !n.read_at
              if (filter==='lab') {
                try {
                  const payload = n.payload ? (typeof n.payload === 'string' ? JSON.parse(n.payload) : n.payload) : null
                  const isLab = /lab/i.test(n.title||'') || /lab/i.test(n.message||'') || (payload && (payload.testId || payload.testType))
                  return isLab
                } catch { return false }
              }
              return true
            }).map((n:any)=> {
              // Check if this is a deletion request notification
              const isDeletionRequest = n.title === 'Patient Deletion Request' || n.title?.includes('Deletion')
              let payload: any = null
              try {
                if (n.payload) payload = typeof n.payload === 'string' ? JSON.parse(n.payload) : n.payload
              } catch {}
              const requestId = payload?.requestId
              const patientId = payload?.patientId
              const isLabReviewed = /lab result reviewed/i.test(n.title || '')
              
              return (
                <div 
                  key={n.id} 
                  className={`p-2 text-sm relative group ${(isDeletionRequest && requestId) || patientId ? 'cursor-pointer hover:bg-secondary/50' : ''}`}
                  onClick={(isDeletionRequest && requestId) ? () => {
                    window.dispatchEvent(new CustomEvent('openDeletionDialog', { detail: { requestId } }))
                    markRead([n.id])
                  } : (patientId ? () => {
                    window.dispatchEvent(new CustomEvent('openDoctorConsult', { detail: { patientId, initialTab: 'labs', notificationId: n.id } }))
                    // Let DoctorDashboard mark this as read after the dialog opens
                  } : undefined)}
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
                      <div className="text-xs text-muted-foreground mt-1">{new Date(n.created_at).toLocaleString()} {n.department ? `• ${n.department}` : n.role ? `• ${n.role}` : ''}</div>
                      {isDeletionRequest && requestId ? (
                        <div className="text-xs text-blue-600 mt-1">Click to review request</div>
                      ) : (patientId ? (
                        <div className="text-xs text-blue-600 mt-1">Click to open Lab Results</div>
                      ) : null)}
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
  const openDialog = (require('react') as any).useCallback(async (requestId: string) => {
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
            <div><span className='text-muted-foreground'>Patient:</span> {pendingReq.first_name} {pendingReq.last_name} ({pendingReq.patient_number})</div>
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




