import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifyToken } from "@/lib/security"
import { query } from "@/lib/db"

function unauthorizedResponse() {
  const res = NextResponse.json({ user: null }, { status: 401 })
  // Clear potentially-stale session cookies so clients stop retrying /api/auth/me
  res.cookies.set("session", "", { path: "/", maxAge: 0 })
  res.cookies.set("session_dev", "", { path: "/", maxAge: 0 })
  return res
}

export async function GET() {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    if (!token) return unauthorizedResponse()
    const payload = verifyToken(token)
    if (!payload) return unauthorizedResponse()

    const { rows } = await query("SELECT id, email, name, role, is_active, email_verified_at FROM users WHERE id = $1", [payload.userId])
    const user = rows[0]
    if (!user || !user.is_active) return unauthorizedResponse()
    return NextResponse.json({ user })
  } catch (error) {
    console.error("Error in /api/auth/me:", error)
    return NextResponse.json({ user: null }, { status: 500 })
  }
}



