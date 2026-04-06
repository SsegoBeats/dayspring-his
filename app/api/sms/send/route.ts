import { NextResponse } from "next/server"
import { z } from "zod"
import { cookies } from "next/headers"
import { verifyToken, can } from "@/lib/security"
import { sendSms } from "@/lib/sms"
import { query } from "@/lib/db"

const Schema = z.object({ to: z.string().min(8), message: z.string().min(1).max(480) })

export async function POST(req: Request) {
  const cookieStore = await cookies()
  const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
  const auth = token ? verifyToken(token) : null
  if (!auth || !can(auth.role, "patients", "update")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { to, message } = Schema.parse(await req.json())

  // ── Recipient allowlist: only send to registered patients or active staff ──
  // This prevents the hospital's SMS sender ID from being used as an
  // arbitrary relay for messages to unregistered phone numbers.
  const { rows } = await query<{ id: string }>(
    `SELECT id FROM patients WHERE phone = $1
     UNION ALL
     SELECT id FROM users   WHERE phone = $1 AND is_active = true
     LIMIT 1`,
    [to],
  )
  if (rows.length === 0) {
    return NextResponse.json(
      { error: "Recipient phone number is not registered in the system." },
      { status: 403 },
    )
  }

  const result = await sendSms(to, message)
  return NextResponse.json(result)
}
