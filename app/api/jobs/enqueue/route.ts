import { NextResponse } from "next/server"
import { z } from "zod"
import { cookies } from "next/headers"
import { verifyToken, can } from "@/lib/security"
import { query } from "@/lib/db"

const Schema = z.object({ queue: z.string().min(1), payload: z.record(z.any()), runAt: z.string().datetime().optional() })

export async function POST(req: Request) {
  const token = cookies().get("session")?.value
  const auth = token ? verifyToken(token) : null
  if (!auth || !can(auth.role, "appointments", "update")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const data = Schema.parse(body)
  const runAt = data.runAt ? new Date(data.runAt).toISOString() : new Date().toISOString()
  await query(`INSERT INTO jobs (queue, payload, run_at) VALUES ($1,$2,$3)`, [data.queue, data.payload, runAt])
  return NextResponse.json({ success: true })
}


