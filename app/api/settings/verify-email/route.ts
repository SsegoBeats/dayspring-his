import { NextResponse } from "next/server"
import { z } from "zod"
import { query } from "@/lib/db"
import { ensureEmailVerificationTable } from "@/lib/email-verification"

const Q = z.object({ token: z.string().min(10) })

export async function GET(req: Request) {
  try {
    await ensureEmailVerificationTable()
  } catch (e) {
    console.error("[verify-email] Table ensure failed:", (e as Error)?.message)
    return NextResponse.json({ error: "Verification service unavailable. Please try again later." }, { status: 503 })
  }

  const url = new URL(req.url)
  let token: string
  try {
    token = Q.parse({ token: url.searchParams.get("token") || "" }).token
  } catch {
    return NextResponse.json({ error: "Invalid or missing verification link." }, { status: 400 })
  }

  let rows: { user_id: string; new_email: string; expires_at: string; used: boolean }[]
  try {
    const result = await query(
      `SELECT user_id, new_email, expires_at, used FROM email_verification_tokens WHERE token = $1`,
      [token],
    )
    rows = result.rows || []
  } catch (e) {
    console.error("[verify-email] Lookup failed:", (e as Error)?.message)
    return NextResponse.json({ error: "Verification service error. Please try again later." }, { status: 500 })
  }
  const row = rows[0]
  if (!row || row.used || new Date(row.expires_at) < new Date()) {
    return NextResponse.json({ error: "Invalid or expired verification link. Please request a new code." }, { status: 400 })
  }

  try {
    await query(`UPDATE users SET email = $1, email_verified_at = NOW() WHERE id = $2`, [row.new_email, row.user_id])
    await query(`UPDATE email_verification_tokens SET used = true WHERE token = $1`, [token])
    await query(`INSERT INTO audit_logs (user_id, action, entity_type, details) VALUES ($1,$2,$3,$4)`, [row.user_id, "email_verified", "user", JSON.stringify({ new_email: row.new_email })])
  } catch (e) {
    console.error("[verify-email] Update failed:", (e as Error)?.message)
    return NextResponse.json({ error: "Verification failed. Please try again or contact support." }, { status: 500 })
  }

  const { rows: userRows } = await query(`SELECT role FROM users WHERE id = $1`, [row.user_id])
  const role = userRows[0]?.role || "Hospital Admin"
  const roleRoutes: Record<string, string> = {
    "Hospital Admin": "/admin/settings",
    "Receptionist": "/receptionist/settings",
    "Clinician": "/clinician/settings",
    "Midwife": "/midwife/settings",
    "Dentist": "/dentist/settings",
    "Nurse": "/nurse/settings",
    "Lab Tech": "/lab-tech/settings",
    "Radiologist": "/radiologist/settings",
    "Pharmacist": "/pharmacist/settings",
    "Cashier": "/cashier/settings",
  }
  const settingsRoute = roleRoutes[role] || "/settings"
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
  return NextResponse.redirect(new URL(`${settingsRoute}?emailVerified=true`, baseUrl))
}


