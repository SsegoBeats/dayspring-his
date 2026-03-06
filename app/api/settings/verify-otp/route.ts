import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifyToken } from "@/lib/security"
import { z } from "zod"
import { query } from "@/lib/db"

const Schema = z.object({ otp: z.string().length(6) })

export async function POST(req: Request) {
  const cookieStore = await cookies()
  const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
  const auth = token ? verifyToken(token) : null
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const { otp } = Schema.parse(body)

  // Verify OTP - use UTC timestamps consistently
  const currentTimeUTC = new Date()
  
  const { rows } = await query(
    `SELECT id, user_id, new_email, expires_at, used, created_at FROM email_verification_tokens 
     WHERE user_id = $1 AND token = $2`,
    [auth.userId, otp]
  )

  const row = rows[0]
  
  if (!row) {
    return NextResponse.json({ error: "Invalid verification code. Please request a new code." }, { status: 400 })
  }

  if (row.used) {
    return NextResponse.json({ error: "This code has already been used. Please request a new code." }, { status: 400 })
  }

  const expiresAtStr = String(row.expires_at)
  const expiresAt = expiresAtStr.includes("T") && expiresAtStr.includes("Z")
    ? new Date(expiresAtStr)
    : new Date(expiresAtStr + "Z")
  if (expiresAt.getTime() < currentTimeUTC.getTime()) {
    return NextResponse.json({ error: "This code has expired. Please request a new code." }, { status: 400 })
  }

  // Get user's name and current email for the notifications
  const { rows: userRows } = await query(`SELECT name, email FROM users WHERE id = $1`, [auth.userId])
  const userName = userRows[0]?.name || "there"
  const oldEmail = userRows[0]?.email || ""

  await query(`UPDATE users SET email = $1, email_verified_at = NOW() WHERE id = $2`, [row.new_email, auth.userId])
  await query(`UPDATE email_verification_tokens SET used = true WHERE user_id = $1 AND token = $2`, [auth.userId, otp])
  await query(`INSERT INTO audit_logs (user_id, action, entity_type, details) VALUES ($1,$2,$3,$4)`, [auth.userId, "email_verified", "user", JSON.stringify({ new_email: row.new_email })])

  try {
    const { emailTemplates, sendEmailServer } = await import("@/lib/email-service")
    if (oldEmail && oldEmail.trim().toLowerCase() !== (row.new_email || "").trim().toLowerCase()) {
      const changeNotification = emailTemplates.emailChanged(userName, oldEmail, row.new_email)
      await sendEmailServer(oldEmail, changeNotification)
    }
    const confirmationTemplate = emailTemplates.emailVerified(userName, row.new_email)
    await sendEmailServer(row.new_email, confirmationTemplate)
  } catch (error) {
    if (process.env.NODE_ENV === "development") console.error("[verify-otp] Email notifications failed:", error)
  }

  return NextResponse.json({ success: true, message: "Email verified successfully" })
}
