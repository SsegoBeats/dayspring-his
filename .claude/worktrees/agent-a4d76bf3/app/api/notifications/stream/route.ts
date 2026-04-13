import { NextResponse } from "next/server"
import {
  buildNotificationAudienceFilter,
  ensureNotificationInfrastructure,
  filterNotificationsForPreferences,
  getNotificationPreferences,
  getNotificationScope,
  resolveNotificationAuth,
} from "@/lib/notifications"
import { query } from "@/lib/db"

export const runtime = "nodejs"
export const maxDuration = 240

const STREAM_POLL_MS = 30_000
const STREAM_LIFETIME_MS = 235_000

export async function GET(req: Request) {
  let requestUrl: URL | null = null
  try {
    requestUrl = new URL(req.url)
  } catch {}

  const auth = await resolveNotificationAuth(req)
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const isLightPayload = requestUrl?.searchParams.get("light") === "1"
  const titleFilterRaw = requestUrl?.searchParams.get("title")?.trim()
  const titleFilter = titleFilterRaw ? titleFilterRaw.slice(0, 120) : null
  const requestedLimit = Number.parseInt(requestUrl?.searchParams.get("limit") || "", 10)
  const limit = Number.isFinite(requestedLimit)
    ? Math.max(1, Math.min(requestedLimit, 50))
    : (isLightPayload ? 20 : 50)

  await ensureNotificationInfrastructure()
  const scope = await getNotificationScope(auth.userId)
  const audience = buildNotificationAudienceFilter(scope, { alias: "n" })
  const enc = new TextEncoder()
  let timer: ReturnType<typeof setInterval> | undefined
  let lifetimeTimer: ReturnType<typeof setTimeout> | undefined
  let closed = false

  const cleanup = () => {
    closed = true
    if (timer) clearInterval(timer)
    if (lifetimeTimer) clearTimeout(lifetimeTimer)
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let lastCreatedAt: string | null = null

      const send = async () => {
        if (closed) return

        try {
          const selectCols = isLightPayload
            ? [
                "n.id",
                "n.title",
                "n.message",
                "n.created_at",
              ]
            : [
                "n.id",
                "n.user_id",
                "n.department",
                "n.role",
                "n.title",
                "n.message",
                "n.type",
                "n.priority",
                "n.payload",
                "COALESCE(s.read_at, n.read_at) AS read_at",
                "n.created_at",
              ]

          const params: any[] = [...audience.params, auth.userId]
          const viewerParam = params.length
          const whereParts = [`(${audience.clauses.join(" OR ")})`, "s.deleted_at IS NULL"]

          if (lastCreatedAt) {
            params.push(lastCreatedAt)
            whereParts.push(`n.created_at > $${params.length}`)
          }

          if (titleFilter) {
            params.push(`%${titleFilter}%`)
            whereParts.push(`n.title ILIKE $${params.length}`)
          }

          params.push(limit)
          const sql = `
            SELECT ${selectCols.join(", ")}
            FROM notifications n
            LEFT JOIN notification_user_states s
              ON s.notification_id = n.id
             AND s.user_id = $${viewerParam}
            WHERE ${whereParts.join(" AND ")}
            ORDER BY n.created_at DESC
            LIMIT $${params.length}
          `
          const { rows } = await query(sql, params)

          if (rows.length > 0) {
            lastCreatedAt = String(rows[0].created_at)
          }

          const preferences = await getNotificationPreferences(auth.userId)
          const visibleRows = filterNotificationsForPreferences(rows, preferences)
          const payload = JSON.stringify({ notifications: visibleRows })
          controller.enqueue(enc.encode(`data: ${payload}\n\n`))
        } catch {
          try {
            controller.enqueue(enc.encode(`event: error\ndata: {"message":"stream error"}\n\n`))
          } catch {
            cleanup()
          }
        }
      }

      controller.enqueue(enc.encode("retry: 5000\n\n"))
      await send()
      timer = setInterval(() => {
        void send()
      }, STREAM_POLL_MS)
      lifetimeTimer = setTimeout(() => {
        if (closed) return
        cleanup()
        try {
          controller.enqueue(enc.encode(`event: close\ndata: {"reason":"refresh"}\n\n`))
        } catch {}
        try {
          controller.close()
        } catch {}
      }, STREAM_LIFETIME_MS)
    },
    cancel() {
      cleanup()
    },
  })

  return new NextResponse(stream as any, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  })
}
