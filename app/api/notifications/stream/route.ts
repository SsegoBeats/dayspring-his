import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifyToken } from "@/lib/security"
import { query } from "@/lib/db"

export const runtime = 'nodejs'

export async function GET(req: Request) {
  const cookieStore = await cookies()
  let token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
  if (!token) {
    try {
      const url = new URL(req.url)
      token = url.searchParams.get('token') || url.searchParams.get('t') || undefined as any
    } catch {}
  }
  const auth = token ? verifyToken(token) : null
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const enc = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let timer: any
      let closed = false
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
      const send = async () => {
        if (closed) return
        try {
          let dept: string | null = null
          let role: string | null = null
          const hasDeptCol = await query<{ exists: boolean }>(
            `SELECT EXISTS (
               SELECT 1 FROM information_schema.columns
               WHERE table_name='users' AND column_name='department'
             ) as exists`
          )
          const hasRoleCol = await query<{ exists: boolean }>(
            `SELECT EXISTS (
               SELECT 1 FROM information_schema.columns
               WHERE table_name='users' AND column_name='role'
             ) as exists`
          )
          if (hasDeptCol.rows?.[0]?.exists && hasRoleCol.rows?.[0]?.exists) {
            const user = await query<{ department: string | null; role: string }>(`SELECT department, role FROM users WHERE id = $1`, [auth.userId])
            dept = user.rows?.[0]?.department || null
            role = user.rows?.[0]?.role || null
          } else if (hasDeptCol.rows?.[0]?.exists) {
            const user = await query<{ department: string | null }>(`SELECT department FROM users WHERE id = $1`, [auth.userId])
            dept = user.rows?.[0]?.department || null
            role = null
          } else if (hasRoleCol.rows?.[0]?.exists) {
            const u2 = await query<{ role: string }>(`SELECT role FROM users WHERE id = $1`, [auth.userId])
            role = u2.rows?.[0]?.role || null
            dept = null
          } else {
            dept = null
            role = null
          }
          // Detect available columns
          const notifCols = await query<{ column_name: string }>(
            `SELECT column_name FROM information_schema.columns WHERE table_name='notifications'`
          )
          const colSet = new Set((notifCols.rows || []).map((r) => r.column_name))
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
          params.push(auth.userId)
          whereParts.push(`user_id = $${params.length}`)
          if (colSet.has('department') && dept) { params.push(dept); whereParts.push(`department = $${params.length}`) }
          if (colSet.has('role') && role) { params.push(role); whereParts.push(`role = $${params.length}`) }
          params.push(200)
          const sql = `SELECT ${selectCols.join(', ')} FROM notifications ${whereParts.length ? `WHERE ${whereParts.join(' OR ')}` : ''} ORDER BY created_at DESC LIMIT $${params.length}`
          const { rows } = await query(sql, params)
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
    cancel(reason) {
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
