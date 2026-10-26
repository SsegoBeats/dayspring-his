import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifyToken, can } from "@/lib/security"
import { queryWithSession } from "@/lib/db"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function canAccessFamilyPlanningEventByFacility(auth: { role: string; userId: string }, eventId: string) {
  if (auth.role === "Hospital Admin") return true

  const userRes = await queryWithSession<{ facility_id?: string }>(
    { role: auth.role, userId: auth.userId },
    `SELECT facility_id FROM users WHERE id = $1 LIMIT 1`,
    [auth.userId],
  )
  const facilityId = userRes.rows[0]?.facility_id
  if (!facilityId) return true

  const eventRes = await queryWithSession(
    { role: auth.role, userId: auth.userId },
    `SELECT 1
       FROM family_planning_events fpe
       JOIN patients p ON p.id = fpe.patient_id
      WHERE fpe.id = $1 AND p.facility_id::text = $2
      LIMIT 1`,
    [eventId, String(facilityId)],
  )
  return eventRes.rows.length > 0
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    const auth = token ? verifyToken(token) : null
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!can(auth.role, "medical", "read")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const { id } = await params
    if (!id || !UUID_RE.test(id)) {
      return NextResponse.json({ error: "id must be a valid UUID" }, { status: 400 })
    }

    if (!(await canAccessFamilyPlanningEventByFacility({ role: auth.role, userId: auth.userId }, id))) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 })
    }

    const { rows } = await queryWithSession(
      { role: auth.role, userId: auth.userId },
      `SELECT
         fpe.*,
         CONCAT(p.first_name, ' ', p.last_name) AS patient_name,
         p.patient_number,
         u.name AS recorded_by_name
       FROM family_planning_events fpe
       JOIN patients p ON p.id = fpe.patient_id
       LEFT JOIN users u ON u.id = fpe.recorded_by
       WHERE fpe.id = $1`,
      [id],
    )

    if (!rows[0]) return NextResponse.json({ error: "Event not found" }, { status: 404 })
    return NextResponse.json(rows[0])
  } catch (err) {
    console.error("GET /api/family-planning/[id] error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
