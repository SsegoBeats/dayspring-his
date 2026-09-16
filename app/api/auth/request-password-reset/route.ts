import { NextResponse } from "next/server"
import { z } from "zod"
import * as crypto from "crypto"
import { query } from "@/lib/db"
import { emailTemplates, sendEmail } from "@/lib/email-service"
import { rateLimitPg } from "@/lib/rate-limit-pg"

const Schema = z.object({ email: z.string().email() })

export async function POST(req: Request) {
  try {
    const ip = (req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "127.0.0.1").split(",")[0]
    if (!(await rateLimitPg(`pwdreset:${ip}`, 5, 60))) return NextResponse.json({ error: "Too many requests" }, { status: 429 })
    let parsed: { email: string }
    try {
      parsed = Schema.parse(await req.json())
    } catch {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
    }
    const { email } = parsed
    const { rows } = await query<{ id: string; name: string }>(`SELECT id, name FROM users WHERE email = $1`, [email])
    const user = rows[0]
    if (!user) return NextResponse.json({ success: true }) // Don't reveal whether email exists
    const token = crypto.randomBytes(24).toString("hex")
    const expires = new Date(Date.now() + 60 * 60 * 1000)
    await query(`INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES ($1,$2,$3)`, [user.id, token, expires.toISOString()])
    const tpl = emailTemplates.passwordReset(user.name || "", token)
    await sendEmail(email, tpl)
    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error("[request-password-reset] Unexpected error:", err)
    return NextResponse.json({ success: true }) // Always return success to prevent email enumeration
  }
}


