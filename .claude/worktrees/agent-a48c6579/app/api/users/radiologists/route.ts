import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifyToken, can } from "@/lib/security"
import { queryWithSession } from "@/lib/db"

export async function GET() {
  const cookieStore = await cookies()
  const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
  const auth = token ? verifyToken(token) : null
  if (!auth || !can(auth.role, "medical", "read")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const { rows } = await queryWithSession(
    { role: auth.role, userId: auth.userId },
    `SELECT id, name, email, role
       FROM users
      WHERE role = 'Radiologist'
        AND is_active = true
      ORDER BY name ASC`,
  )
  return NextResponse.json({ radiologists: rows })
}

