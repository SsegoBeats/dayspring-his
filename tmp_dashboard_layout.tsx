"use client"

import type { ReactNode } from "react"
import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { LogOut, Hospital, Bell } from "lucide-react"
import Link from "next/link"

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
    </div>
  )
}

function NotificationsBell() {
  const [open, setOpen] = (require('react') as any).useState(false)
  const [items, setItems] = (require('react') as any).useState<any[]>([])
  const [loading, setLoading] = (require('react') as any).useState(false)
  const [unread, setUnread] = (require('react') as any).useState(0)
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
  const markRead = async (ids: string[]) => {
    try { await fetch('/api/notifications', { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids }) }); await load() } catch {}
  }
  return (
    <div className="relative">
      <button onClick={()=> setOpen((v:boolean)=>!v)} className="relative inline-flex items-center rounded-md border px-3 py-1.5 text-sm">
        <Bell className="h-4 w-4" />
        {unread > 0 && <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] text-white">{unread}</span>}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-96 rounded-md border bg-card p-2 shadow-md">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-sm font-semibold">Notifications</div>
            <button onClick={load} className="text-xs text-muted-foreground">{loading? 'Refreshing...':'Refresh'}</button>
          </div>
          <div className="max-h-80 overflow-auto divide-y">
            {items.length === 0 ? (
              <div className="p-3 text-sm text-muted-foreground">No notifications</div>
            ) : items.map((n:any)=> (
              <div key={n.id} className="p-2 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-medium">{n.title}</div>
                    <div className="text-muted-foreground">{n.message}</div>
                    <div className="text-xs text-muted-foreground mt-1">{new Date(n.created_at).toLocaleString()} {n.department ? `• ${n.department}` : n.role ? `• ${n.role}` : ''}</div>
                  </div>
                  {!n.read_at && <button onClick={()=> markRead([n.id])} className="text-xs text-blue-600">Mark read</button>}
                </div>
              </div>
            ))}
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
