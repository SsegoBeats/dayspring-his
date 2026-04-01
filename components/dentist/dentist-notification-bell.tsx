"use client"
import { useCallback, useEffect, useRef, useState } from "react"
import { Bell } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

interface DentistNotif {
  id: string
  title: string
  message: string
  payload?: { patientId?: string } | null
  read_at: string | null
  created_at: string
}

const DENTAL_KEYWORDS = [
  "dental", "tooth", "teeth", "dentist",
  "patient queued", "patient assigned",
  "lab", "result",
  "appointment", "reminder",
  "pre-auth", "preauth", "authorization",
]

function isDentalNotif(n: DentistNotif): boolean {
  const t = (n.title ?? "").toLowerCase()
  const m = (n.message ?? "").toLowerCase()
  return DENTAL_KEYWORDS.some((kw) => t.includes(kw) || m.includes(kw))
}

function timeAgo(dateStr: string): string {
  const diff = Math.max(0, Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000))
  return diff < 60 ? `${diff}m ago` : `${Math.floor(diff / 60)}h ago`
}

export function DentistNotificationBell() {
  const [notifications, setNotifications] = useState<DentistNotif[]>([])
  const [open, setOpen] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const sseRef = useRef<EventSource | null>(null)

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications?limit=20", { credentials: "include" })
      if (!res.ok) return
      const data = await res.json().catch(() => ({}))
      const list: DentistNotif[] = Array.isArray(data?.notifications) ? data.notifications : []
      setNotifications(list.filter(isDentalNotif))
    } catch {
      // silent — bell is non-critical
    }
  }, [])

  useEffect(() => {
    void fetchNotifications()

    const es = new EventSource("/api/notifications/stream", { withCredentials: true })
    sseRef.current = es
    es.onmessage = () => { void fetchNotifications() }
    es.onerror = () => {
      es.close()
      sseRef.current = null
      if (!intervalRef.current) {
        intervalRef.current = setInterval(() => void fetchNotifications(), 30000)
      }
    }

    return () => {
      es.close()
      sseRef.current = null
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [fetchNotifications])

  const unreadCount = notifications.filter((n) => !n.read_at).length

  async function markAllRead() {
    const unreadIds = notifications.filter((n) => !n.read_at).map((n) => n.id)
    if (!unreadIds.length) return
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: unreadIds }),
      })
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })),
      )
    } catch { /* silent */ }
  }

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
    } catch { /* silent */ }
  }

  function handleNotifClick(n: DentistNotif) {
    if (!n.read_at) void markRead(n.id)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Notifications"
          className={cn("relative", unreadCount > 0 ? "text-cyan-600" : "text-slate-400")}
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-cyan-600 text-[10px] font-bold text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-slate-800">Notifications</p>
            {unreadCount > 0 && (
              <p className="text-xs text-slate-500">{unreadCount} unread</p>
            )}
          </div>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="text-[11px] text-cyan-600 hover:text-cyan-800 font-medium"
            >
              Mark all read
            </button>
          )}
        </div>
        <div className="max-h-72 overflow-y-auto divide-y">
          {notifications.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-slate-400">No notifications</p>
          ) : (
            notifications.slice(0, 10).map((n) => (
              <button
                key={n.id}
                onClick={() => handleNotifClick(n)}
                className={cn(
                  "w-full px-4 py-3 text-left transition-colors hover:bg-cyan-50/60",
                  !n.read_at
                    ? "bg-cyan-50 border-l-4 border-cyan-500"
                    : "border-l-4 border-transparent",
                )}
              >
                <p className={cn("text-sm font-medium", !n.read_at ? "text-cyan-900" : "text-slate-700")}>
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
