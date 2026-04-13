import { NextResponse } from "next/server"
import { z } from "zod"
import {
  buildNotificationAudienceFilter,
  ensureNotificationInfrastructure,
  filterNotificationsForPreferences,
  getNotificationPreferences,
  getNotificationScope,
  resolveNotificationAuth,
} from "@/lib/notifications"
import { query } from "@/lib/db"

const CreateNotificationSchema = z.object({
  userIds: z.array(z.string().uuid()).optional(),
  department: z.string().optional(),
  role: z.string().optional(),
  title: z.string().min(1),
  message: z.string().min(1),
  type: z.string().optional(),
  priority: z.string().optional(),
  payload: z.any().optional(),
})

const MarkReadSchema = z.object({ ids: z.array(z.string().uuid()).min(1) })
const DeleteNotificationsSchema = z.object({ ids: z.array(z.string().uuid()).min(1) })

export async function GET(req: Request) {
  try {
    const auth = await resolveNotificationAuth(req)
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    await ensureNotificationInfrastructure()
    const scope = await getNotificationScope(auth.userId)
    const audience = buildNotificationAudienceFilter(scope, { alias: "n" })
    const params: any[] = [...audience.params, auth.userId]
    const viewerParam = params.length
    params.push(200)
    const limitParam = params.length

    const sql = `
      SELECT
        n.id,
        n.user_id,
        n.department,
        n.role,
        n.title,
        n.message,
        n.type,
        n.priority,
        n.payload,
        COALESCE(s.read_at, n.read_at) AS read_at,
        n.created_at
      FROM notifications n
      LEFT JOIN notification_user_states s
        ON s.notification_id = n.id
       AND s.user_id = $${viewerParam}
      WHERE (${audience.clauses.join(" OR ")})
        AND s.deleted_at IS NULL
      ORDER BY n.created_at DESC
      LIMIT $${limitParam}
    `

    const { rows } = await query(sql, params)
    const preferences = await getNotificationPreferences(auth.userId)
    return NextResponse.json({ notifications: filterNotificationsForPreferences(rows, preferences) })
  } catch (error) {
    console.error("Error loading notifications:", error)
    return NextResponse.json({ error: "Failed to load notifications" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const auth = await resolveNotificationAuth(req)
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    await ensureNotificationInfrastructure()
    const body = await req.json().catch(() => ({}))
    const data = CreateNotificationSchema.parse(body)

    const targets = Array.isArray(data.userIds) && data.userIds.length > 0 ? data.userIds : [null]
    for (const userId of targets) {
      await query(
        `INSERT INTO notifications (user_id, department, role, title, message, type, priority, payload)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          userId,
          data.department || null,
          data.role || null,
          data.title,
          data.message,
          data.type || null,
          data.priority || null,
          data.payload || null,
        ],
      )
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    if (error?.name === "ZodError") {
      return NextResponse.json({ error: "Invalid input", details: error.issues }, { status: 400 })
    }
    console.error("Failed to create notification", error)
    return NextResponse.json({ error: "Failed to create notification" }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  try {
    const auth = await resolveNotificationAuth(req)
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    await ensureNotificationInfrastructure()
    const body = await req.json().catch(() => ({}))
    const data = MarkReadSchema.parse(body)
    const scope = await getNotificationScope(auth.userId)
    const audience = buildNotificationAudienceFilter(scope, { alias: "n" })
    const params: any[] = [...audience.params, auth.userId, data.ids]
    const viewerParam = audience.nextIndex
    const idsParam = viewerParam + 1

    await query(
      `
        INSERT INTO notification_user_states (notification_id, user_id, read_at, deleted_at, updated_at)
        SELECT n.id, $${viewerParam}, NOW(), NULL, NOW()
        FROM notifications n
        WHERE n.id = ANY($${idsParam}::uuid[])
          AND (${audience.clauses.join(" OR ")})
        ON CONFLICT (notification_id, user_id)
        DO UPDATE SET
          read_at = COALESCE(notification_user_states.read_at, EXCLUDED.read_at),
          updated_at = NOW()
      `,
      params,
    )

    return NextResponse.json({ success: true })
  } catch (error: any) {
    if (error?.name === "ZodError") {
      return NextResponse.json({ error: "Invalid input", details: error.issues }, { status: 400 })
    }
    console.error("Failed to update notifications", error)
    return NextResponse.json({ error: "Failed to update notifications" }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const auth = await resolveNotificationAuth(req)
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    await ensureNotificationInfrastructure()
    const body = await req.json().catch(() => ({}))
    const data = DeleteNotificationsSchema.parse(body)
    const scope = await getNotificationScope(auth.userId)
    const audience = buildNotificationAudienceFilter(scope, { alias: "n" })
    const params: any[] = [...audience.params, auth.userId, data.ids]
    const viewerParam = audience.nextIndex
    const idsParam = viewerParam + 1

    await query(
      `
        INSERT INTO notification_user_states (notification_id, user_id, read_at, deleted_at, updated_at)
        SELECT n.id, $${viewerParam}, COALESCE(n.read_at, NOW()), NOW(), NOW()
        FROM notifications n
        WHERE n.id = ANY($${idsParam}::uuid[])
          AND (${audience.clauses.join(" OR ")})
        ON CONFLICT (notification_id, user_id)
        DO UPDATE SET
          deleted_at = NOW(),
          updated_at = NOW()
      `,
      params,
    )

    return NextResponse.json({ success: true })
  } catch (error: any) {
    if (error?.name === "ZodError") {
      return NextResponse.json({ error: "Invalid input", details: error.issues }, { status: 400 })
    }
    console.error("Failed to delete notifications", error)
    return NextResponse.json({ error: "Failed to delete notifications" }, { status: 500 })
  }
}
