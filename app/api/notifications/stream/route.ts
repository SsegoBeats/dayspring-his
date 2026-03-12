import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifyToken } from "@/lib/security"
import { query } from "@/lib/db"

export const runtime = 'nodejs'
// Long-lived SSE: Vercel will close at this limit; clients should reconnect on disconnect
export const maxDuration = 300

export async function GET(req: Request) {
  let requestUrl: URL | null = null
  try { requestUrl = new URL(req.url) } catch {}

  const cookieStore = await cookies()
  let token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
  if (!token) {
    token = requestUrl?.searchParams.get('token') || requestUrl?.searchParams.get('t') || undefined as any
  }
  const auth = token ? verifyToken(token) : null
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const isLightPayload = requestUrl?.searchParams.get('light') === '1'
  const titleFilterRaw = requestUrl?.searchParams.get('title')?.trim()
  const titleFilter = titleFilterRaw ? titleFilterRaw.slice(0, 120) : null
  const requestedLimit = Number.parseInt(requestUrl?.searchParams.get('limit') || "", 10)
  const limit = Number.isFinite(requestedLimit)
    ? Math.max(1, Math.min(requestedLimit, 50))
    : (isLightPayload ? 20 : 50)

  const enc = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let timer: any
      let closed = false
      let lastCreatedAt: string | null = null
      let dept: string | null = null
      let role: string | null = null
      let notificationColumns = new Set<string>()
      // Ensure notifications table exists and has expected columns (legacy DBs where /api/migrate hasn't completed)
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
        await query(`ALTER TABLE notifications ADD COLUMN IF NOT EXISTS department VARCHAR(100)`)
        await query(`ALTER TABLE notifications ADD COLUMN IF NOT EXISTS role VARCHAR(50)`)
        await query(`ALTER TABLE notifications ADD COLUMN IF NOT EXISTS read_at TIMESTAMP`)
        await query(`CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at DESC)`)
        await query(`CREATE INDEX IF NOT EXISTS idx_notifications_dept ON notifications(department, created_at DESC)`)
        await query(`CREATE INDEX IF NOT EXISTS idx_notifications_role ON notifications(role, created_at DESC)`)
      } catch {}

      // Resolve user routing scope and available notification columns once per stream connection.
      try {
        const userCols = await query<{ column_name: string }>(
          `SELECT column_name FROM information_schema.columns WHERE table_name='users'`
        )
        const userColSet = new Set((userCols.rows || []).map((r) => r.column_name))
        const hasDeptCol = userColSet.has("department")
        const hasRoleCol = userColSet.has("role")

        if (hasDeptCol || hasRoleCol) {
          const selectedUserCols = [hasDeptCol ? "department" : null, hasRoleCol ? "role" : null].filter(Boolean).join(", ")
          const user = await query<{ department?: string | null; role?: string | null }>(
            `SELECT ${selectedUserCols} FROM users WHERE id = $1`,
            [auth.userId],
          )
          dept = user.rows?.[0]?.department || null
          role = user.rows?.[0]?.role || null
        }

        const notifCols = await query<{ column_name: string }>(
          `SELECT column_name FROM information_schema.columns WHERE table_name='notifications'`
        )
        notificationColumns = new Set((notifCols.rows || []).map((r) => r.column_name))
      } catch {}

      const send = async () => {
        if (closed) return
        try {
          const colSet = notificationColumns
          const selectCols = isLightPayload
            ? (['id', 'title', 'message', 'created_at'].filter((c) => colSet.size === 0 || colSet.has(c)) as string[])
            : ([
                'id',
                colSet.has('user_id') ? 'user_id' : null,
                colSet.has('department') ? 'department' : null,
                colSet.has('role') ? 'role' : null,
                'title',
                'message',
                colSet.has('payload') ? 'payload' : null,
                colSet.has('read_at') ? 'read_at' : null,
                'created_at',
              ].filter(Boolean) as string[])
          if (selectCols.length === 0) return

          const audienceParts: string[] = []
          const params: any[] = []
          if (colSet.size === 0 || colSet.has('user_id')) { params.push(auth.userId); audienceParts.push(`user_id = $${params.length}`) }
          if ((colSet.size === 0 || colSet.has('department')) && dept) { params.push(dept); audienceParts.push(`department = $${params.length}`) }
          if ((colSet.size === 0 || colSet.has('role')) && role) { params.push(role); audienceParts.push(`role = $${params.length}`) }

          const whereParts: string[] = []
          whereParts.push(audienceParts.length > 0 ? `(${audienceParts.join(' OR ')})` : `1=0`)
          if (lastCreatedAt) {
            params.push(lastCreatedAt)
            whereParts.push(`created_at > $${params.length}`)
          }
          if (titleFilter) {
            params.push(`%${titleFilter}%`)
            whereParts.push(`title ILIKE $${params.length}`)
          }
          params.push(limit)
          const whereSql = `WHERE ${whereParts.join(' AND ')}`
          const sql = `SELECT ${selectCols.join(', ')} FROM notifications ${whereSql} ORDER BY created_at DESC LIMIT $${params.length}`
          const { rows } = await query(sql, params)
          if (rows.length > 0) {
            lastCreatedAt = String(rows[0].created_at)
          }
          const payload = JSON.stringify({ notifications: rows })
          try { controller.enqueue(enc.encode(`data: ${payload}\n\n`)) } catch { closed = true; if (timer) clearInterval(timer) }
        } catch {
          try { controller.enqueue(enc.encode(`event: error\n` + `data: {"message":"stream error"}\n\n`)) } catch { closed = true; if (timer) clearInterval(timer) }
        }
      }
      await send()
      timer = setInterval(send, 30000)
      ;(controller as any)._timer = timer
      ;(controller as any)._closedRef = { value: () => closed, set: (v:boolean)=> (closed=v) }
    },
    cancel() {
      const timer = (this as any)._timer
      if (timer) clearInterval(timer)
      const cr = (this as any)._closedRef
      if (cr) try { cr.set(true) } catch {}
    }
  })
  return new NextResponse(stream as any, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    }
  })
}
