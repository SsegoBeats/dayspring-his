import { NextResponse } from "next/server"
import { z } from "zod"
import { query } from "@/lib/db"
import { hashPassword, validatePasswordStrength } from "@/lib/security"

const Schema = z.object({ token: z.string().min(10), newPassword: z.string().min(8) })

export async function POST(req: Request) {
  const { token, newPassword } = Schema.parse(await req.json())
  const strength = validatePasswordStrength(newPassword)
  if (!strength.valid) return NextResponse.json({ error: "Weak password", details: strength.errors }, { status: 400 })
  const { rows } = await query<any>(`SELECT user_id, expires_at, used FROM password_reset_tokens WHERE token = $1`, [token])
  const row = rows[0]
  if (!row || row.used || new Date(row.expires_at) < new Date()) {
    return NextResponse.json({ error: "Invalid or expired token" }, { status: 400 })
  }
  const hash = await hashPassword(newPassword)
  await query(`UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`, [hash, row.user_id])
  await query(`UPDATE password_reset_tokens SET used = true WHERE token = $1`, [token])
  return NextResponse.json({ success: true })
}


