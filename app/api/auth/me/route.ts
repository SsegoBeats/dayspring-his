import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifyToken } from "@/lib/security"
import { query } from "@/lib/db"

export async function GET() {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    if (!token) return NextResponse.json({ user: null }, { status: 401 })
    const payload = verifyToken(token)
    if (!payload) return NextResponse.json({ user: null }, { status: 401 })

    const { rows } = await query("SELECT id, email, name, role, is_active, email_verified_at FROM users WHERE id = $1", [payload.userId])
    const user = rows[0]
    if (!user || !user.is_active) return NextResponse.json({ user: null }, { status: 401 })
    return NextResponse.json({ user })
  } catch (error) {
    console.error("Error in /api/auth/me:", error)
    return NextResponse.json({ user: null }, { status: 500 })
  }
}



