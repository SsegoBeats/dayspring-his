import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifyToken, can } from "@/lib/security"
import { queryWithSession } from "@/lib/db"

export async function GET() {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    const auth = token ? verifyToken(token) : null
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!can(auth.role, "pharmacy", "read")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    // Get medications needing reorder
    const { rows } = await queryWithSession(
      { role: auth.role, userId: auth.userId },
      `SELECT * FROM get_medications_needing_reorder()`,
    )

    return NextResponse.json({ suggestions: rows })
  } catch (err: any) {
    console.error("Error fetching reorder suggestions:", err)
    return NextResponse.json({ error: "Failed to fetch reorder suggestions" }, { status: 500 })
  }
}

