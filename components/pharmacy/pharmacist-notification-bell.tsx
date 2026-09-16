"use client"

import { useState, useEffect, useCallback } from "react"
import { Bell, AlertTriangle, Clock, FileText, CheckCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"

interface ApiNotification {
  id: string
  title: string
  message: string
  type: string | null
  priority: string | null
  payload: Record<string, unknown> | null
  read_at: string | null
  created_at: string
}

function parsePayload(raw: unknown): Record<string, unknown> {
  if (!raw) return {}
  if (typeof raw === "object") return raw as Record<string, unknown>
  try { return JSON.parse(raw as string) } catch { return {} }
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function isPharmacyNotification(n: ApiNotification): boolean {
  const type = n.type ?? ""
  if (["pharmacy_low_stock", "pharmacy_expiry_warning", "pharmacy_new_prescription", "pharmacy_po_approved"].includes(type)) return true
  const lower = (n.title + " " + (n.message ?? "")).toLowerCase()
  return lower.includes("stock") || lower.includes("expir") || lower.includes("prescription") || lower.includes("purchase order")
}

function getNotificationIcon(n: ApiNotification) {
  const type = n.type ?? ""
  if (type === "pharmacy_low_stock") return <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-red-500" />
  if (type === "pharmacy_expiry_warning") return <Clock className="h-3.5 w-3.5 shrink-0 text-yellow-500" />
  if (type === "pharmacy_new_prescription") return <FileText className="h-3.5 w-3.5 shrink-0 text-green-500" />
  if (type === "pharmacy_po_approved") return <CheckCircle className="h-3.5 w-3.5 shrink-0 text-blue-500" />
  return <Bell className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
}

export function PharmacistNotificationBell() {
  const [notifications, setNotifications] = useState<ApiNotification[]>([])
  const [open, setOpen] = useState(false)
  const [markingAll, setMarkingAll] = useState(false)

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications", { credentials: "include" })
      if (!res.ok) return
      const data = await res.json() as { notifications: ApiNotification[] }
      setNotifications(data.notifications ?? [])
    } catch {
      // silent — bell is non-critical
    }
  }, [])

  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 30_000)
    return () => clearInterval(interval)
  }, [fetchNotifications])

  const unreadCount = notifications.filter((n) => !n.read_at).length

  const markRead = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return
    await fetch("/api/notifications", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    })
    setNotifications((prev) =>
      prev.map((n) => ids.includes(n.id) ? { ...n, read_at: new Date().toISOString() } : n)
    )
  }, [])

  const handleMarkAllRead = useCallback(async () => {
    setMarkingAll(true)
    try {
      const unread = notifications.filter((n) => !n.read_at).map((n) => n.id)
      await markRead(unread)
    } finally {
      setMarkingAll(false)
    }
  }, [notifications, markRead])

  const handleOpen = useCallback((n: ApiNotification) => {
    const payload = parsePayload(n.payload)
    const type = n.type ?? ""
    const detail: Record<string, unknown> = { notificationId: n.id }

    if (type === "pharmacy_low_stock") {
      detail.initialTab = payload.initialTab ?? "inventory"
    } else if (type === "pharmacy_expiry_warning") {
      detail.initialTab = "inventory"
      detail.filterExpiry = true
    } else if (type === "pharmacy_new_prescription") {
      detail.initialTab = "prescriptions"
      detail.prescriptionId = payload.prescriptionId
    } else if (type === "pharmacy_po_approved") {
      detail.initialTab = "purchase-orders"
    } else {
      detail.initialTab = payload.initialTab ?? "prescriptions"
    }

    window.dispatchEvent(new CustomEvent("openPharmacistDesk", { detail }))
    markRead([n.id])
    setOpen(false)
  }, [markRead])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9 rounded-full"
          aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-80 p-0">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <span className="text-sm font-semibold">Notifications</span>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-muted-foreground"
              disabled={markingAll}
              onClick={handleMarkAllRead}
            >
              Mark all read
            </Button>
          )}
        </div>

        {/* List */}
        <div className="max-h-[400px] overflow-y-auto divide-y">
          {notifications.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              No notifications
            </div>
          ) : (
            notifications.slice(0, 20).map((n) => {
              const isUnread = !n.read_at
              const isPharmacy = isPharmacyNotification(n)
              return (
                <div
                  key={n.id}
                  className={`px-4 py-3 ${isUnread ? "bg-blue-50/50" : ""}`}
                >
                  <div className="flex items-start gap-2">
                    <div className="mt-0.5 shrink-0">{getNotificationIcon(n)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        {isUnread && (
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />
                        )}
                        {n.priority === "High" && (
                          <Badge variant="destructive" className="px-1.5 py-0 text-[10px]">
                            Urgent
                          </Badge>
                        )}
                        <p className="truncate text-sm font-medium text-foreground">{n.title}</p>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{n.message}</p>
                      <p className="mt-1 text-[11px] text-muted-foreground/70">{relativeTime(n.created_at)}</p>
                    </div>
                  </div>
                  <div className="mt-2 flex gap-2">
                    {isPharmacy && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 rounded-full px-2.5 text-xs"
                        onClick={() => handleOpen(n)}
                      >
                        Open
                      </Button>
                    )}
                    {isUnread && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 rounded-full px-2.5 text-xs text-muted-foreground"
                        onClick={() => markRead([n.id])}
                      >
                        Mark read
                      </Button>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
