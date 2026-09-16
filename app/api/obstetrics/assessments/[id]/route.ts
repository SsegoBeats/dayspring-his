import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifyToken, can } from "@/lib/security"
import { queryWithSession } from "@/lib/db"

function toInt(val: unknown): number | null {
  if (val === null || val === undefined) return null
  if (typeof val === "number") return Number.isFinite(val) ? Math.trunc(val) : null
  const m = String(val).match(/-?\d+/)
  return m ? parseInt(m[0], 10) : null
}

function toFloat(val: unknown): number | null {
  if (val === null || val === undefined) return null
  if (typeof val === "number") return Number.isFinite(val) ? val : null
  const m = String(val).replace(",", ".").match(/-?\d+(?:\.\d+)?/)
  return m ? parseFloat(m[0]) : null
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    const auth = token ? verifyToken(token) : null
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!can(auth.role, "medical", "update")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { id } = await params
    if (!id || !UUID_RE.test(id)) {
      return NextResponse.json({ error: "id must be a valid UUID" }, { status: 400 })
    }

    // Ownership check
    const existing = await queryWithSession(
      { role: auth.role, userId: auth.userId },
      `SELECT recorded_by FROM obstetric_assessments WHERE id = $1`,
      [id],
    )
    if (!existing.rows[0]) {
      return NextResponse.json({ error: "Assessment not found" }, { status: 404 })
    }
    if (existing.rows[0].recorded_by !== auth.userId && auth.role !== "Hospital Admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = (await req.json().catch(() => ({}))) as {
      visitDate?: string
      gravida?: unknown
      parity?: unknown
      gestationalAgeWeeks?: unknown
      edd?: string
      fundalHeightCm?: unknown
      fetalHeartRate?: unknown
      presentation?: string | null
      notes?: string | null
    }

    // Build SET clause — only update fields that were explicitly sent
    const fieldMap: Array<[string, unknown]> = [
      ["visit_date", body.visitDate !== undefined
        ? (body.visitDate && !Number.isNaN(new Date(body.visitDate).getTime())
            ? body.visitDate
            : null)
        : undefined],
      ["gravida", body.gravida !== undefined ? toInt(body.gravida) : undefined],
      ["parity", body.parity !== undefined ? toInt(body.parity) : undefined],
      ["gestational_age_weeks", body.gestationalAgeWeeks !== undefined ? toInt(body.gestationalAgeWeeks) : undefined],
      ["edd", body.edd !== undefined ? (body.edd || null) : undefined],
      ["fundal_height_cm", body.fundalHeightCm !== undefined ? toFloat(body.fundalHeightCm) : undefined],
      ["fetal_heart_rate", body.fetalHeartRate !== undefined ? toInt(body.fetalHeartRate) : undefined],
      ["presentation", body.presentation !== undefined ? (body.presentation || null) : undefined],
      ["notes", body.notes !== undefined ? (body.notes || null) : undefined],
    ].filter(([, v]) => v !== undefined) as Array<[string, unknown]>

    if (fieldMap.length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 })
    }

    const setClauses = fieldMap.map(([col], i) => `${col} = $${i + 2}`).join(", ")
    const values: unknown[] = [id, ...fieldMap.map(([, v]) => v)]

    const { rows } = await queryWithSession(
      { role: auth.role, userId: auth.userId },
      `UPDATE obstetric_assessments
       SET ${setClauses}, updated_at = NOW()
       WHERE id = $1
       RETURNING id, patient_id, visit_date, gravida, parity,
                 gestational_age_weeks, edd, fundal_height_cm,
                 fetal_heart_rate, presentation, notes, created_at`,
      values,
    )

    return NextResponse.json(rows[0])
  } catch (err) {
    console.error("PATCH /api/obstetrics/assessments/[id] error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    const auth = token ? verifyToken(token) : null
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!can(auth.role, "medical", "delete")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { id } = await params
    if (!id || !UUID_RE.test(id)) {
      return NextResponse.json({ error: "id must be a valid UUID" }, { status: 400 })
    }

    // Ownership check — only recorder or Hospital Admin may delete
    const existing = await queryWithSession(
      { role: auth.role, userId: auth.userId },
      `SELECT recorded_by FROM obstetric_assessments WHERE id = $1`,
      [id],
    )
    if (!existing.rows[0]) {
      return NextResponse.json({ error: "Assessment not found" }, { status: 404 })
    }
    if (existing.rows[0].recorded_by !== auth.userId && auth.role !== "Hospital Admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    await queryWithSession(
      { role: auth.role, userId: auth.userId },
      `DELETE FROM obstetric_assessments WHERE id = $1`,
      [id],
    )

    return new NextResponse(null, { status: 204 })
  } catch (err) {
    console.error("DELETE /api/obstetrics/assessments/[id] error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
