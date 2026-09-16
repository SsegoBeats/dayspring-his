import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifyToken } from "@/lib/security"
import { query } from "@/lib/db"

// Idempotent: adds last_active_at column if it doesn't exist yet.
// Runs once per server instance; safe to call concurrently.
let columnReady = false
async function ensureLastActiveAt() {
  if (columnReady) return
  await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ`)
  columnReady = true
}

export async function POST() {
  const cookieStore = await cookies()
  const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
  const auth = token ? verifyToken(token) : null
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    await ensureLastActiveAt()
    await query(`UPDATE users SET last_active_at = NOW() WHERE id = $1`, [auth.userId])
  } catch {
    // Non-fatal — heartbeat best-effort
  }

  return NextResponse.json({ ok: true })
}
