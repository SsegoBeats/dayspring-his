import { cookies } from "next/headers"
import { query } from "@/lib/db"
import { verifyToken } from "@/lib/security"

type NotificationUserMeta = {
  ts: number
  hasDepartment: boolean
  hasRole: boolean
}

export type NotificationScope = {
  userId: string
  department: string | null
  role: string | null
}

export type NotificationPreferences = {
  appointmentAlerts: boolean
  labResults: boolean
  systemUpdates: boolean
  emergencyAlerts: boolean
}

let userMetaCache: NotificationUserMeta | null = null

const META_TTL_MS = 60_000

const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  appointmentAlerts: true,
  labResults: true,
  systemUpdates: false,
  emergencyAlerts: true,
}

export async function resolveNotificationAuth(req: Request) {
  const cookieStore = await cookies()
  let token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value

  if (!token) {
    const authz = req.headers.get("authorization") || ""
    if (/^Bearer\s+/i.test(authz)) token = authz.replace(/^Bearer\s+/i, "")
  }

  if (!token) {
    try {
      const url = new URL(req.url)
      token = url.searchParams.get("token") || url.searchParams.get("t") || undefined
    } catch {}
  }

  return token ? verifyToken(token) : null
}

export async function ensureNotificationInfrastructure() {
  // Notification infrastructure is provisioned through SQL migrations.
  // Keep the helper so older call sites remain valid without doing request-time DDL.
}

async function ensureNotificationPreferenceColumns() {
  // Preferences are also provisioned through migrations.
}

async function getUserMeta() {
  const now = Date.now()
  if (userMetaCache && now - userMetaCache.ts < META_TTL_MS) {
    return userMetaCache
  }

  const userCols = await query<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns WHERE table_name='users'`
  )
  const userColSet = new Set((userCols.rows || []).map((row) => row.column_name))

  userMetaCache = {
    ts: now,
    hasDepartment: userColSet.has("department"),
    hasRole: userColSet.has("role"),
  }

  return userMetaCache
}

export async function getNotificationScope(userId: string): Promise<NotificationScope> {
  await ensureNotificationInfrastructure()
  const meta = await getUserMeta()

  if (!meta.hasDepartment && !meta.hasRole) {
    return { userId, department: null, role: null }
  }

  const columns = [meta.hasDepartment ? "department" : null, meta.hasRole ? "role" : null]
    .filter(Boolean)
    .join(", ")

  const result = await query<{ department?: string | null; role?: string | null }>(
    `SELECT ${columns} FROM users WHERE id = $1`,
    [userId],
  )

  return {
    userId,
    department: result.rows?.[0]?.department || null,
    role: result.rows?.[0]?.role || null,
  }
}

export async function getNotificationPreferences(userId: string): Promise<NotificationPreferences> {
  await ensureNotificationPreferenceColumns()
  const { rows } = await query<{
    appointment_alerts?: boolean | null
    lab_results?: boolean | null
    system_updates?: boolean | null
    emergency_alerts?: boolean | null
  }>(
    `SELECT appointment_alerts, lab_results, system_updates, emergency_alerts
       FROM user_settings
      WHERE user_id = $1`,
    [userId],
  )

  const row = rows[0]
  if (!row) return { ...DEFAULT_NOTIFICATION_PREFERENCES }
  return {
    appointmentAlerts: row.appointment_alerts ?? DEFAULT_NOTIFICATION_PREFERENCES.appointmentAlerts,
    labResults: row.lab_results ?? DEFAULT_NOTIFICATION_PREFERENCES.labResults,
    systemUpdates: row.system_updates ?? DEFAULT_NOTIFICATION_PREFERENCES.systemUpdates,
    emergencyAlerts: row.emergency_alerts ?? DEFAULT_NOTIFICATION_PREFERENCES.emergencyAlerts,
  }
}

function parseNotificationPayload(notification: any) {
  try {
    return notification?.payload
      ? (typeof notification.payload === "string" ? JSON.parse(notification.payload) : notification.payload)
      : null
  } catch {
    return null
  }
}

export function isLabNotification(notification: any) {
  const payload = parseNotificationPayload(notification)
  return /lab/i.test(notification?.title || "")
    || /lab/i.test(notification?.message || "")
    || /radiology|imaging/i.test(notification?.title || "")
    || /radiology|imaging/i.test(notification?.message || "")
    || Boolean(payload && (payload.testId || payload.testIds?.[0] || payload.testType))
}

export function isNotificationVisibleForPreferences(
  notification: any,
  preferences: NotificationPreferences,
) {
  const title = String(notification?.title || "")
  const message = String(notification?.message || "")
  const type = String(notification?.type || "")

  if (notification?.priority === "High" && !preferences.emergencyAlerts) return false
  if (isLabNotification(notification) && !preferences.labResults) return false
  if ((/appointment/i.test(title) || /appointment/i.test(message) || /appointment/i.test(type)) && !preferences.appointmentAlerts) {
    return false
  }
  if ((type === "System" || /system|maintenance|update/i.test(title) || /system|maintenance|update/i.test(message)) && !preferences.systemUpdates) {
    return false
  }
  return true
}

export function filterNotificationsForPreferences(
  notifications: any[],
  preferences: NotificationPreferences,
) {
  return notifications.filter((notification) => isNotificationVisibleForPreferences(notification, preferences))
}

export function buildNotificationAudienceFilter(
  scope: NotificationScope,
  options?: { alias?: string; startIndex?: number },
) {
  const alias = options?.alias || "n"
  let nextIndex = options?.startIndex || 1
  const params: Array<string | null> = []
  const clauses: string[] = []

  params.push(scope.userId)
  clauses.push(`${alias}.user_id = $${nextIndex}`)
  nextIndex += 1

  if (scope.department) {
    params.push(scope.department)
    clauses.push(`${alias}.department = $${nextIndex}`)
    nextIndex += 1
  }

  if (scope.role) {
    params.push(scope.role)
    clauses.push(`${alias}.role = $${nextIndex}`)
    nextIndex += 1
  }

  return { clauses, params, nextIndex }
}
