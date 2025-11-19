import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { z } from "zod"
import { verifyToken } from "@/lib/security"
import { query } from "@/lib/db"
import { rateLimitPg } from "@/lib/rate-limit-pg"
import { hashPassword, verifyPassword, validatePasswordStrength } from "@/lib/security"
import { sendEmailServer } from "@/lib/email-service"

const Schema = z.object({
  currentPassword: z.string().min(8),
  newPassword: z.string().min(8),
})

export async function POST(req: Request) {
  const ip = (req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "127.0.0.1").split(",")[0]
  if (!(await rateLimitPg(`settings:password:${ip}`, 10, 60))) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 })
  }
  const cookieStore = await cookies()
  const token = cookieStore.get("session")?.value
  const auth = token ? verifyToken(token) : null
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const csrfHeader = (req.headers.get("x-csrf-token") || "").trim()
  const csrfCookie = (cookieStore.get("csrfToken")?.value || "").trim()
  if (!csrfHeader || csrfHeader !== csrfCookie) return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 })
  const { currentPassword, newPassword } = Schema.parse(body)
  const strength = validatePasswordStrength(newPassword)
  if (!strength.valid) return NextResponse.json({ error: "Weak password", details: strength.errors }, { status: 400 })

  const { rows } = await query<{ password_hash: string }>(`SELECT password_hash FROM users WHERE id = $1`, [auth.userId])
  const row = rows[0]
  if (!row) return NextResponse.json({ error: "User not found" }, { status: 404 })
  const ok = await verifyPassword(currentPassword, row.password_hash)
  if (!ok) return NextResponse.json({ error: "Invalid current password" }, { status: 400 })

  const newHash = await hashPassword(newPassword)
  await query(`UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`, [newHash, auth.userId])
  await query(`INSERT INTO audit_logs (user_id, action, entity_type, details) VALUES ($1,$2,$3,$4)`,[auth.userId, 'password_changed', 'user', JSON.stringify({})])
  
  // Send password changed confirmation email
  try {
    const { rows: userRows } = await query(`SELECT name, email FROM users WHERE id = $1`, [auth.userId])
    const userName = userRows[0]?.name || "User"
    const userEmail = userRows[0]?.email || ""
    
    if (userEmail) {
      const { emailTemplates } = await import("@/lib/email-service")
      const template = emailTemplates.passwordChanged(userName)
      await sendEmailServer(userEmail, template)
      console.log(`[Password Change] Confirmation email sent to ${userEmail}`)
    }
  } catch (emailError) {
    console.error(`[Password Change] Failed to send confirmation email:`, emailError)
    // Don't fail the password change if email sending fails
  }
  
  return NextResponse.json({ success: true })
}


