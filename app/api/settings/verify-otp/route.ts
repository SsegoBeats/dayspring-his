import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifyToken } from "@/lib/security"
import { z } from "zod"
import { query } from "@/lib/db"
import { ensureEmailVerificationTable, getLatestActiveEmailVerificationToken } from "@/lib/email-verification"

const Schema = z.object({ otp: z.string().trim().length(6) })

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    const auth = token ? verifyToken(token) : null
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await req.json()
    const { otp } = Schema.parse(body)
    await ensureEmailVerificationTable()

    // Verify OTP - use UTC timestamps consistently
    const currentTimeUTC = new Date()
    
    const { rows } = await query(
      `SELECT id, user_id, new_email, expires_at, used, created_at FROM email_verification_tokens 
       WHERE user_id = $1 AND token = $2`,
      [auth.userId, otp]
    )

    const row = rows[0]
    
    if (!row) {
      const latest = await getLatestActiveEmailVerificationToken(auth.userId)
      if (latest) {
        return NextResponse.json(
          {
            error: "This verification code is no longer current. Use the latest code sent to your email or click Resend Code.",
          },
          { status: 400 },
        )
      }
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

    const normalizedNewEmail = String(row.new_email || "").trim().toLowerCase()
    const { rows: duplicates } = await query(`SELECT id FROM users WHERE LOWER(email) = $1 AND id <> $2 LIMIT 1`, [
      normalizedNewEmail,
      auth.userId,
    ])
    if (duplicates.length > 0) {
      return NextResponse.json({ error: "That email address is already in use by another account." }, { status: 409 })
    }

    // Get user's name and current email for the notifications
    const { rows: userRows } = await query(`SELECT name, email FROM users WHERE id = $1`, [auth.userId])
    const userName = userRows[0]?.name || "there"
    const oldEmail = userRows[0]?.email || ""

    try {
      await query(`UPDATE users SET email = $1, email_verified_at = NOW() WHERE id = $2`, [normalizedNewEmail, auth.userId])
    } catch (error: any) {
      if (error?.code === "23505") {
        return NextResponse.json({ error: "That email address is already in use by another account." }, { status: 409 })
      }
      throw error
    }
    await query(`UPDATE email_verification_tokens SET used = true WHERE user_id = $1`, [auth.userId])
    await query(`INSERT INTO audit_logs (user_id, action, entity_type, details) VALUES ($1,$2,$3,$4)`, [auth.userId, "email_verified", "user", JSON.stringify({ new_email: normalizedNewEmail })])

    try {
      const { emailTemplates, sendEmailServer } = await import("@/lib/email-service")
      if (oldEmail && oldEmail.trim().toLowerCase() !== normalizedNewEmail) {
        const changeNotification = emailTemplates.emailChanged(userName, oldEmail, normalizedNewEmail)
        await sendEmailServer(oldEmail, changeNotification)
      }
      const confirmationTemplate = emailTemplates.emailVerified(userName, normalizedNewEmail)
      await sendEmailServer(normalizedNewEmail, confirmationTemplate)
    } catch (error) {
      if (process.env.NODE_ENV === "development") console.error("[verify-otp] Email notifications failed:", error)
    }

    return NextResponse.json({ success: true, message: "Email verified successfully" })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid verification code", details: error.issues }, { status: 400 })
    }
    console.error("[verify-otp] Verification failed:", error)
    return NextResponse.json({ error: "Failed to verify code" }, { status: 500 })
  }
}
