import { NextResponse } from "next/server"
import { z } from "zod"
import crypto from "crypto"
import { query } from "@/lib/db"
import { emailTemplates, sendEmail } from "@/lib/email-service"
import { rateLimitPg } from "@/lib/rate-limit-pg"

const Schema = z.object({ email: z.string().email() })

export async function POST(req: Request) {
  const ip = (req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "127.0.0.1").split(",")[0]
  if (!(await rateLimitPg(`pwdreset:${ip}`, 5, 60))) return NextResponse.json({ error: "Too many requests" }, { status: 429 })
  const { email } = Schema.parse(await req.json())
  const { rows } = await query<{ id: string; name: string }>(`SELECT id, name FROM users WHERE email = $1`, [email])
  const user = rows[0]
  if (!user) return NextResponse.json({ success: true })
  const token = crypto.randomBytes(24).toString("hex")
  const expires = new Date(Date.now() + 60 * 60 * 1000)
  await query(`INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES ($1,$2,$3)`, [user.id, token, expires.toISOString()])
  const tpl = emailTemplates.passwordReset(user.name || "", token)
  await sendEmail(email, tpl)
  return NextResponse.json({ success: true })
}


