import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifyToken } from "@/lib/security"
import { z } from "zod"
import { query } from "@/lib/db"
import crypto from "crypto"
import { emailTemplates, sendEmailServer } from "@/lib/email-service"
import { rateLimitPg } from "@/lib/rate-limit-pg"

const Schema = z.object({ email: z.string().email() })

export async function POST(req: Request) {
  const ip = (req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "127.0.0.1").split(",")[0]
  if (!(await rateLimitPg(`settings:email:${ip}`, 10, 60))) {
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
  const { email } = Schema.parse(body)
  const verifyTokenStr = crypto.randomBytes(24).toString("hex")
  const expires = new Date(Date.now() + 60 * 60 * 1000)

  await query(
    `INSERT INTO email_verification_tokens (user_id, token, new_email, expires_at) VALUES ($1,$2,$3,$4)`,
    [auth.userId, verifyTokenStr, email, expires.toISOString()],
  )

  const verifyUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/settings/verify-email?token=${verifyTokenStr}`
  const template = {
    subject: "Confirm your email address",
    html: emailTemplates.passwordReset("", verifyTokenStr).html
      .replace("Password Reset Request - Dayspring HIS", "Confirm your email address")
      .replace(/Reset Your Password/g, "Confirm Email")
      .replace(/reset-password\?token=/g, `verify-email?token=`)
      .replace(/password reset/g, "email verification"),
  }
  await sendEmailServer(email, template)
  await query(`INSERT INTO audit_logs (user_id, action, entity_type, details) VALUES ($1,$2,$3,$4)`,[auth.userId, 'email_change_requested', 'user', JSON.stringify({ new_email: email })])
  return NextResponse.json({ success: true })
}


