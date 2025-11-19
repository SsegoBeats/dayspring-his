import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { z } from "zod"
import { verifyToken, can } from "@/lib/security"
import { queryWithSession } from "@/lib/db"

const Create = z.object({ name: z.string().min(2).max(150), payerCode: z.string().max(50).optional().nullable() })

export async function GET() {
  const cookieStore = await cookies()
  const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
  const auth = token ? verifyToken(token) : null
  if (!auth || !can(auth.role, "insurance", "read")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { rows } = await queryWithSession({ role: auth.role, userId: auth.userId }, `SELECT id, name, payer_code FROM insurance_payers ORDER BY name ASC`)
  return NextResponse.json({ payers: rows })
}

export async function POST(req: Request) {
  const cookieStore = await cookies()
  const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
  const auth = token ? verifyToken(token) : null
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!can(auth.role, "insurance", "create")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const data = Create.parse(await req.json())
  const { rows } = await queryWithSession(
    { role: auth.role, userId: auth.userId },
    `INSERT INTO insurance_payers (name, payer_code) VALUES ($1,$2) RETURNING id`,
    [data.name, data.payerCode || null]
  )
  return NextResponse.json({ id: rows[0].id })
}

