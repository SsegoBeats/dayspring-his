"use client"
import { useCallback, useEffect, useRef, useState } from "react"
import { Bell } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

interface MidwifeNotif {
  id: string
  title: string
  message: string
  payload?: { patientId?: string } | null
  read_at: string | null
  created_at: string
}

const MIDWIFE_KEYWORDS = [
  "anc", "obstetric", "labor", "labour", "delivery", "postnatal",
  "maternity", "midwif", "patient queued", "patient assigned",
  "appointment", "reminder", "lab", "result", "referral", "handoff",
]

function isMidwifeNotif(n: MidwifeNotif): boolean {
  const t = (n.title ?? "").toLowerCase()
  const m = (n.message ?? "").toLowerCase()
  return MIDWIFE_KEYWORDS.some((kw) => t.includes(kw) || m.includes(kw))
}

function timeAgo(dateStr: string): string {
  const diff = Math.max(0, Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000))
  return diff < 60 ? `${diff}m ago` : `${Math.floor(diff / 60)}h ago`
}

export function MidwifeNotificationBell() {
  const [notifications, setNotifications] = useState<MidwifeNotif[]>([])
  const [open, setOpen] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications?limit=20", { credentials: "include" })
      if (!res.ok) return
      const data = await res.json().catch(() => ({}))
      const list: MidwifeNotif[] = Array.isArray(data?.notifications) ? data.notifications : []
      setNotifications(list.filter(isMidwifeNotif))
    } catch {
      // silent — bell is non-critical
    }
  }, [])

  useEffect(() => {
    void fetchNotifications()
    // Use polling rather than EventSource to avoid HTTP/2 SSE issues
    if (!intervalRef.current) {
      intervalRef.current = setInterval(() => { void fetchNotifications() }, 15_000)
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [fetchNotifications])

  const markAllRead = async () => {
    try {
      const ids = notifications.filter((n) => !n.read_at).map((n) => n.id)
      if (!ids.length) return
      await fetch("/api/notifications", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      })
      setNotifications((prev) => prev.map((n) => ({ ...n, read_at: new Date().toISOString() })))
    } catch {
      // silent
    }
  }

  const markOneRead = async (n: MidwifeNotif) => {
    if (n.read_at) return
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [n.id] }),
      })
      setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)))
    } catch {
      // silent
    }
  }

  const unreadCount = notifications.filter((n) => !n.read_at).length

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9 text-rose-700 hover:bg-rose-50">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-rose-600 text-[10px] font-bold text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0 rounded-2xl border border-rose-100 shadow-xl shadow-rose-100/30" align="end">
        <div className="flex items-center justify-between border-b border-rose-100 px-4 py-3">
          <span className="text-sm font-semibold text-slate-700">Notifications</span>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={markAllRead}
              className="text-xs text-rose-600 hover:text-rose-800 transition-colors"
            >
              Mark all read
            </button>
          )}
        </div>
        <div className="max-h-72 overflow-y-auto divide-y divide-rose-50">
          {notifications.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">No notifications</p>
          ) : (
            notifications.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => {
                  void markOneRead(n)
                  const patientId = n.payload?.patientId
                  if (patientId) {
                    window.dispatchEvent(new CustomEvent("midwife:open-patient", { detail: { patientId } }))
                  }
                }}
                className={cn(
                  "w-full text-left px-4 py-3 text-sm transition-colors hover:bg-rose-50/40",
                  n.read_at ? "opacity-60" : "bg-rose-50/40",
                )}
              >
                <p className="font-medium text-slate-700 leading-tight">{n.title}</p>
                <p className="text-xs text-slate-500 mt-0.5 leading-snug">{n.message}</p>
                <p className="text-[11px] text-rose-400 mt-1">{timeAgo(n.created_at)}</p>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
