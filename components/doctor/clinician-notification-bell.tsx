"use client"
import { useCallback, useEffect, useRef, useState } from "react"
import { Bell } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

interface ClinicianNotif {
  id: string
  title: string
  message: string
  payload?: { patientId?: string } | null
  read_at: string | null
  created_at: string
}

function timeAgo(dateStr: string): string {
  const diff = Math.max(0, Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000))
  return diff < 60 ? `${diff}m ago` : `${Math.floor(diff / 60)}h ago`
}

function isClinicianNotif(n: ClinicianNotif): boolean {
  const t = (n.title ?? "").toLowerCase()
  const m = (n.message ?? "").toLowerCase()
  return (
    t.includes("lab") ||
    t.includes("result") ||
    t.includes("consult") ||
    t.includes("patient assigned") ||
    t.includes("triage") ||
    m.includes("lab") ||
    m.includes("result")
  )
}

export function ClinicianNotificationBell() {
  const [notifications, setNotifications] = useState<ClinicianNotif[]>([])
  const [open, setOpen] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications?limit=20", { credentials: "include" })
      if (!res.ok) return
      const data = await res.json().catch(() => ({}))
      const list: ClinicianNotif[] = Array.isArray(data?.notifications) ? data.notifications : []
      setNotifications(list.filter(isClinicianNotif))
    } catch {
      // silent — bell is non-critical
    }
  }, [])

  useEffect(() => {
    void fetchNotifications()
    intervalRef.current = setInterval(() => void fetchNotifications(), 60000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [fetchNotifications])

  const unreadCount = notifications.filter((n) => !n.read_at).length

  async function markRead(id: string) {
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [id] }),
      })
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)),
      )
    } catch {
      // silent
    }
  }

  function handleNotifClick(n: ClinicianNotif) {
    if (!n.read_at) void markRead(n.id)
    const patientId = n.payload?.patientId
    if (patientId) {
      window.dispatchEvent(new CustomEvent("openClinicianConsult", { detail: { patientId, notifId: n.id } }))
      setOpen(false)
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Notifications" className="relative text-teal-100 hover:bg-teal-800/60">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="border-b px-4 py-3">
          <p className="text-sm font-semibold text-slate-800">Notifications</p>
          {unreadCount > 0 && (
            <p className="text-xs text-slate-500">{unreadCount} unread</p>
          )}
        </div>
        <div className="max-h-72 overflow-y-auto divide-y">
          {notifications.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-slate-400">No notifications</p>
          ) : (
            notifications.map((n) => (
              <button
                key={n.id}
                onClick={() => handleNotifClick(n)}
                className={cn(
                  "w-full px-4 py-3 text-left transition-colors hover:bg-teal-50/60",
                  !n.read_at && "bg-teal-50",
                )}
              >
                <p className={cn("text-sm font-medium", !n.read_at ? "text-teal-900" : "text-slate-700")}>
                  {n.title}
                </p>
                <p className="mt-0.5 text-xs text-slate-500 line-clamp-2">{n.message}</p>
                <p className="mt-1 text-[10px] text-slate-400">{timeAgo(n.created_at)}</p>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
