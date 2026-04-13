import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifyToken, can } from "@/lib/security"
import { query } from "@/lib/db"

export async function GET() {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    const auth = token ? verifyToken(token) : null
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!can(auth.role, "exports", "read") && auth.role !== "Hospital Admin")
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const { rows } = await query(
      `SELECT COALESCE(AVG(rating), 0)::numeric(4,2) as avg_rating, COUNT(*)::int as total_responses
       FROM patient_feedback`
    ).catch(() => ({ rows: [{ avg_rating: null, total_responses: 0 }] }))

    const avg = rows[0]?.avg_rating != null ? Number(rows[0].avg_rating) : null
    const total = rows[0]?.total_responses ?? 0

    return NextResponse.json({
      avgRating: total > 0 ? avg : null,
      totalResponses: total,
    })
  } catch (err) {
    console.error("[patient-satisfaction]", err)
    return NextResponse.json({ avgRating: null, totalResponses: 0 })
  }
}
