import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifyToken, can } from "@/lib/security"
import { query } from "@/lib/db"
import { z } from "zod"
import { sendEmailServer, buildDepartmentNotificationEmail } from "@/lib/email-service"

const Schema = z.object({
  department: z.string().min(2),
  title: z.string().min(3).max(200),
  message: z.string().min(3),
  payload: z.any().optional(),
})

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    const auth = token ? verifyToken(token) : null
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!(can(auth.role, 'appointments', 'create') || can(auth.role, 'patients', 'create') || can(auth.role, 'checkins', 'create'))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    const body = await req.json()
    const data = Schema.parse(body)
    // Fetch users in department
    const users = await query<{ id: string; email: string; name: string }>(`SELECT id, email, name FROM users WHERE department = $1 AND is_active = true`, [data.department])
    // Insert per-user notifications
    for (const u of users.rows) {
      await query(`INSERT INTO notifications (user_id, department, role, title, message, payload) VALUES ($1,$2,$3,$4,$5,$6)`, [u.id, data.department, null, data.title, data.message, data.payload || null])
    }
    // Insert a department-scoped notification for panels that query by department
    await query(`INSERT INTO notifications (user_id, department, role, title, message, payload) VALUES (NULL,$1,NULL,$2,$3,$4)`, [data.department, data.title, data.message, data.payload || null])
    // Optionally email department users (feature-flagged)
    try {
      if (process.env.NOTIFY_DEPT_EMAIL === 'true') {
        const { subject, html } = buildDepartmentNotificationEmail(
          data.department,
          data.title,
          data.message,
          data.payload
        )
        for (const u of users.rows) {
          if (u.email) {
            await sendEmailServer(u.email, { subject, html })
          }
        }
      }
    } catch {}
    return NextResponse.json({ success: true, count: users.rows.length })
  } catch (e: any) {
    if (e?.name === 'ZodError') return NextResponse.json({ error: 'Invalid input', details: e.issues }, { status: 400 })
    return NextResponse.json({ error: 'Failed to notify department' }, { status: 500 })
  }
}
