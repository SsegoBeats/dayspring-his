import { NextResponse } from "next/server"
import { z } from "zod"
import { query } from "@/lib/db"

const Q = z.object({ token: z.string().min(10) })

export async function GET(req: Request) {
  const url = new URL(req.url)
  const token = Q.parse({ token: url.searchParams.get("token") || "" }).token

  const { rows } = await query(
    `SELECT user_id, new_email, expires_at, used FROM email_verification_tokens WHERE token = $1`,
    [token],
  )
  const row = rows[0]
  if (!row || row.used || new Date(row.expires_at) < new Date()) {
    return NextResponse.json({ error: "Invalid or expired token" }, { status: 400 })
  }

  await query(`UPDATE users SET email = $1, email_verified_at = NOW() WHERE id = $2`, [row.new_email, row.user_id])
  await query(`UPDATE email_verification_tokens SET used = true WHERE token = $1`, [token])
  await query(`INSERT INTO audit_logs (user_id, action, entity_type, details) VALUES ($1,$2,$3,$4)`,[row.user_id, 'email_verified', 'user', JSON.stringify({ new_email: row.new_email })])
  
  // Get user's role to redirect to correct settings page
  const { rows: userRows } = await query(`SELECT role FROM users WHERE id = $1`, [row.user_id])
  const role = userRows[0]?.role || "Hospital Admin"
  const roleRoutes: Record<string, string> = {
    "Hospital Admin": "/admin/settings",
    "Receptionist": "/receptionist/settings",
    "Doctor": "/doctor/settings",
    "Midwife": "/midwife/settings",
    "Dentist": "/dentist/settings",
    "Nurse": "/nurse/settings",
    "Lab Tech": "/lab-tech/settings",
    "Radiologist": "/radiologist/settings",
    "Pharmacist": "/pharmacist/settings",
    "Cashier": "/cashier/settings"
  }
  const settingsRoute = roleRoutes[role] || "/admin/settings"
  
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
  return NextResponse.redirect(new URL(`${settingsRoute}?emailVerified=true`, baseUrl))
}


