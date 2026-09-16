import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { z } from "zod"
import { verifyToken } from "@/lib/security"
import { query } from "@/lib/db"

const Schema = z.object({ rationale: z.string().min(10), scope: z.string().min(3) })

export async function POST(req: Request) {
  const cookieStore = await cookies()
  const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
  const auth = token ? verifyToken(token) : null
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  const { rationale, scope } = Schema.parse(await req.json())
  await query(`insert into consent_log (user_id, rationale, scope) values ($1,$2,$3)`, [auth.userId, rationale, scope])
  return NextResponse.json({ ok: true })
}


