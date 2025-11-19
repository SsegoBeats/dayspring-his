import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifyToken } from "@/lib/security"
import { query } from "@/lib/db"
import { z } from "zod"

// Lightweight, in-process memoization to cut repeated metadata lookups
let ensuredSchema = false
let metaCache: {
  ts: number
  hasDeptCol: boolean
  hasRoleCol: boolean
  notifCols: Set<string>
} | null = null
const META_TTL_MS = 60_000

export async function GET(req: Request) {
  try {
    const cookieStore = await cookies()
    let token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    if (!token) {
      const authz = req.headers.get('authorization') || ''
      if (/^Bearer\s+/i.test(authz)) token = authz.replace(/^Bearer\s+/i, '')
      if (!token) {
        try { const u = new URL(req.url); token = u.searchParams.get('token') || u.searchParams.get('t') || undefined as any } catch {}
      }
    }
    const auth = token ? verifyToken(token) : null
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    // One-time ensure for table/indices to avoid slow checks each request
    if (!ensuredSchema) {
      try {
        await query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"')
        await query(`
          CREATE TABLE IF NOT EXISTS notifications (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            user_id UUID REFERENCES users(id) ON DELETE CASCADE,
            department VARCHAR(100),
            role VARCHAR(50),
            title VARCHAR(200) NOT NULL,
            message TEXT NOT NULL,
            payload JSONB,
            read_at TIMESTAMP,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
          )`)
        await query(`CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at DESC)`)
        await query(`CREATE INDEX IF NOT EXISTS idx_notifications_dept ON notifications(department, created_at DESC)`)
        await query(`CREATE INDEX IF NOT EXISTS idx_notifications_role ON notifications(role, created_at DESC)`)
      } catch {}
      ensuredSchema = true
    }

    // Memoize metadata about available columns for 60s. In dev, modules may reload,
    // so also keep the number of queries per request minimal by batching them.
    const now = Date.now()
    if (!metaCache || now - metaCache.ts > META_TTL_MS) {
      const [userColsQ, notifColsQ] = await Promise.all([
        query<{ column_name: string }>(
          `SELECT column_name FROM information_schema.columns WHERE table_name='users'`
        ),
        query<{ column_name: string }>(
          `SELECT column_name FROM information_schema.columns WHERE table_name='notifications'`
        ),
      ])
      const userCols = new Set((userColsQ.rows || []).map((r) => r.column_name))
      metaCache = {
        ts: now,
        hasDeptCol: userCols.has('department'),
        hasRoleCol: userCols.has('role'),
        notifCols: new Set((notifColsQ.rows || []).map((r) => r.column_name)),
      }
    }

    // Load user's department/role only when the columns exist
    let dept: string | null = null
    let role: string | null = null
    if (metaCache.hasDeptCol && metaCache.hasRoleCol) {
      const user = await query<{ department: string | null; role: string }>(`SELECT department, role FROM users WHERE id = $1`, [auth.userId])
      dept = user.rows?.[0]?.department || null
      role = user.rows?.[0]?.role || null
    } else if (metaCache.hasDeptCol) {
      const user = await query<{ department: string | null }>(`SELECT department FROM users WHERE id = $1`, [auth.userId])
      dept = user.rows?.[0]?.department || null
    } else if (metaCache.hasRoleCol) {
      const user = await query<{ role: string }>(`SELECT role FROM users WHERE id = $1`, [auth.userId])
      role = user.rows?.[0]?.role || null
    }

    const limit = 200
    const colSet = metaCache.notifCols
    const selectCols = [
      'id',
      'user_id',
      colSet.has('department') ? 'department' : null,
      colSet.has('role') ? 'role' : null,
      'title',
      'message',
      colSet.has('payload') ? 'payload' : null,
      colSet.has('read_at') ? 'read_at' : null,
      'created_at',
    ].filter(Boolean) as string[]
    const whereParts: string[] = []
    const params: any[] = []
    // Always include user-scoped notifications
    params.push(auth.userId)
    whereParts.push(`user_id = $${params.length}`)
    // Include department filter if column exists and value provided
    if (colSet.has('department') && dept) {
      params.push(dept)
      whereParts.push(`department = $${params.length}`)
    }
    // Include role filter if column exists and value provided
    if (colSet.has('role') && role) {
      params.push(role)
      whereParts.push(`role = $${params.length}`)
    }
    params.push(limit)
    const sql = `SELECT ${selectCols.join(', ')} FROM notifications ${whereParts.length ? `WHERE ${whereParts.join(' OR ')}` : ''} ORDER BY created_at DESC LIMIT $${params.length}`
    const { rows } = await query(sql, params)
    return NextResponse.json({ notifications: rows })
  } catch (e) {
    console.error('Error loading notifications:', e)
    return NextResponse.json({ error: "Failed to load notifications" }, { status: 500 })
  }
}

const CreateNotificationSchema = z.object({
  userIds: z.array(z.string().uuid()).optional(),
  department: z.string().optional(),
  role: z.string().optional(),
  title: z.string().min(1),
  message: z.string().min(1),
  payload: z.any().optional(),
})

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies()
    let token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    if (!token) {
      const authz = req.headers.get('authorization') || ''
      if (/^Bearer\s+/i.test(authz)) token = authz.replace(/^Bearer\s+/i, '')
      if (!token) {
        try { const u = new URL(req.url); token = u.searchParams.get('token') || u.searchParams.get('t') || undefined as any } catch {}
      }
    }
    const auth = token ? verifyToken(token) : null
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    // Ensure table exists (mirrors GET)
    if (!ensuredSchema) {
      try {
        await query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"')
        await query(`
          CREATE TABLE IF NOT EXISTS notifications (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            user_id UUID REFERENCES users(id) ON DELETE CASCADE,
            department VARCHAR(100),
            role VARCHAR(50),
            title VARCHAR(200) NOT NULL,
            message TEXT NOT NULL,
            payload JSONB,
            read_at TIMESTAMP,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
          )`)
      } catch {}
      ensuredSchema = true
    }

    const body = await req.json().catch(() => ({}))
    const data = CreateNotificationSchema.parse(body)

    const targets = Array.isArray(data.userIds) && data.userIds.length > 0 ? data.userIds : [null]
    for (const userId of targets) {
      await query(
        `INSERT INTO notifications (user_id, department, role, title, message, payload)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [userId, data.department || null, data.role || null, data.title, data.message, data.payload || null]
      )
    }
    return NextResponse.json({ success: true })
  } catch (e: any) {
    if (e?.name === 'ZodError') return NextResponse.json({ error: 'Invalid input', details: e.issues }, { status: 400 })
    console.error('Failed to create notification', e)
    return NextResponse.json({ error: "Failed to create notification" }, { status: 500 })
  }
}

const MarkReadSchema = z.object({ ids: z.array(z.string().uuid()).min(1) })

export async function PATCH(req: Request) {
  try {
    const cookieStore = await cookies()
    let token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    if (!token) {
      const authz = req.headers.get('authorization') || ''
      if (/^Bearer\s+/i.test(authz)) token = authz.replace(/^Bearer\s+/i, '')
      if (!token) {
        try { const u = new URL(req.url); token = u.searchParams.get('token') || u.searchParams.get('t') || undefined as any } catch {}
      }
    }
    const auth = token ? verifyToken(token) : null
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await req.json()
    const data = MarkReadSchema.parse(body)
    // Only mark user's own notifications (user targeted) as read; dept/role notifications mark all
    for (const id of data.ids) {
      await query(`UPDATE notifications SET read_at = NOW() WHERE id = $1 AND (user_id = $2 OR user_id IS NULL)`, [id, auth.userId])
    }
    return NextResponse.json({ success: true })
  } catch (e: any) {
    if (e?.name === 'ZodError') return NextResponse.json({ error: 'Invalid input', details: e.issues }, { status: 400 })
    return NextResponse.json({ error: "Failed to update notifications" }, { status: 500 })
  }
}

const DeleteNotificationsSchema = z.object({ ids: z.array(z.string().uuid()).min(1) })

export async function DELETE(req: Request) {
  try {
    const cookieStore = await cookies()
    let token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    if (!token) {
      const authz = req.headers.get('authorization') || ''
      if (/^Bearer\s+/i.test(authz)) token = authz.replace(/^Bearer\s+/i, '')
      if (!token) {
        try { const u = new URL(req.url); token = u.searchParams.get('token') || u.searchParams.get('t') || undefined as any } catch {}
      }
    }
    const auth = token ? verifyToken(token) : null
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    const data = DeleteNotificationsSchema.parse(body)
    // Only delete user's own notifications (user targeted); dept/role notifications can be deleted by anyone with access
    for (const id of data.ids) {
      await query(`DELETE FROM notifications WHERE id = $1 AND (user_id = $2 OR user_id IS NULL)`, [id, auth.userId])
    }
    return NextResponse.json({ success: true })
  } catch (e: any) {
    if (e?.name === 'ZodError') return NextResponse.json({ error: 'Invalid input', details: e.issues }, { status: 400 })
    return NextResponse.json({ error: "Failed to delete notifications" }, { status: 500 })
  }
}
