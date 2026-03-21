"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Bell } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

interface NurseNotif {
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

export function NurseNotificationBell() {
  const [notifications, setNotifications] = useState<NurseNotif[]>([])
  const [open, setOpen] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications?limit=15", { credentials: "include" })
      if (!res.ok) return
      const data = await res.json().catch(() => ({}))
      const list: NurseNotif[] = Array.isArray(data?.notifications) ? data.notifications : []
      setNotifications(
        list.filter((n) => String(n.title || "").includes("New Patient Registered"))
      )
    } catch {
      // silent — bell is non-critical
    }
  }, [])

  useEffect(() => {
    void fetchNotifications()
    intervalRef.current = setInterval(() => void fetchNotifications(), 60000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [fetchNotifications])

  const unreadCount = notifications.filter((n) => !n.read_at).length

  const handleClick = async (notif: NurseNotif) => {
    const patientId = notif.payload?.patientId
    if (patientId) {
      window.dispatchEvent(
        new CustomEvent("openNursePatientCare", {
          detail: { patientId, initialTab: "triage", notificationId: notif.id },
        })
      )
    }
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [notif.id] }),
      })
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, read_at: new Date().toISOString() } : n))
      )
    } catch {
      // silent
    }
    setOpen(false)
  }

  const handleMarkAllRead = async () => {
    const unreadIds = notifications.filter((n) => !n.read_at).map((n) => n.id)
    if (unreadIds.length === 0) return
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: unreadIds }),
      })
      const now = new Date().toISOString()
      setNotifications((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? now })))
    } catch {
      // silent
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative shrink-0"
          aria-label="Notifications"
        >
          <Bell size={16} className="text-violet-600" />
          {unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-fuchsia-600 text-[10px] font-bold text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end" aria-label="Notification list">
        <div className="flex items-center justify-between border-b border-violet-100 px-4 py-3">
          <span className="text-sm font-semibold text-slate-900">Notifications</span>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-auto py-0.5 text-xs text-violet-600 hover:text-violet-800"
              onClick={handleMarkAllRead}
            >
              Mark all read
            </Button>
          )}
        </div>
        {notifications.length === 0 ? (
          <div className="py-8 text-center text-sm text-slate-400">No new notifications</div>
        ) : (
          <div className="max-h-72 overflow-y-auto">
            {notifications.slice(0, 10).map((notif) => (
              <button
                key={notif.id}
                type="button"
                aria-label={`Patient notification: ${notif.message}`}
                onClick={() => void handleClick(notif)}
                className={`w-full border-b border-violet-50 px-4 py-3 text-left transition hover:bg-violet-50 ${
                  !notif.read_at ? "bg-fuchsia-50/40" : ""
                }`}
              >
                <div className="text-sm font-medium text-slate-900">
                  {String(notif.message || "").replace(" has been registered.", "")}
                </div>
                <div className="mt-0.5 flex items-center justify-between">
                  <span className="text-xs text-slate-500">New patient registered</span>
                  <span className="text-xs text-slate-400">{timeAgo(notif.created_at)}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
