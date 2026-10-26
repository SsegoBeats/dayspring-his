import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifyToken, can } from "@/lib/security"
import { queryWithSession } from "@/lib/db"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    const auth = token ? verifyToken(token) : null
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!can(auth.role, "medical", "update")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const { id } = await params
    if (!id || !UUID_RE.test(id)) {
      return NextResponse.json({ error: "id must be a valid UUID" }, { status: 400 })
    }

    const existing = await queryWithSession<{ recorded_by: string }>(
      { role: auth.role, userId: auth.userId },
      `SELECT recorded_by FROM labor_vital_events WHERE id = $1`,
      [id],
    )

    if (!existing.rows[0]) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 })
    }
    if (existing.rows[0].recorded_by !== auth.userId && auth.role !== "Hospital Admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    await queryWithSession(
      { role: auth.role, userId: auth.userId },
      `DELETE FROM labor_vital_events WHERE id = $1`,
      [id],
    )

    return new NextResponse(null, { status: 204 })
  } catch (err) {
    console.error("DELETE /api/labor/vitals/[id] error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
