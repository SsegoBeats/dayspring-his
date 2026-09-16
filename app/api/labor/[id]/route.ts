// app/api/labor/[id]/route.ts
import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifyToken, can } from "@/lib/security"
import { queryWithSession } from "@/lib/db"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

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

export async function PATCH(
  req: Request,
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

    const existing = await queryWithSession(
      { role: auth.role, userId: auth.userId },
      `SELECT midwife_id FROM labor_delivery_records WHERE id = $1`,
      [id],
    )
    if (!existing.rows[0]) return NextResponse.json({ error: "Record not found" }, { status: 404 })
    if (existing.rows[0].midwife_id !== auth.userId && auth.role !== "Hospital Admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>

    const fieldMap: Array<[string, unknown]> = ([
      ["admission_date", body.admissionDate],
      ["onset_of_labor", body.onsetOfLabor],
      ["delivery_date", body.deliveryDate],
      ["delivery_type", body.deliveryType],
      ["duration_of_labor_hours", body.durationOfLaborHours !== undefined ? toFloat(body.durationOfLaborHours) : undefined],
      ["presentation", body.presentation],
      ["rupture_of_membranes", body.ruptureOfMembranes],
      ["placenta_delivery", body.placentaDelivery],
      ["blood_loss_ml", body.bloodLossMl !== undefined ? toInt(body.bloodLossMl) : undefined],
      ["complications", body.complications],
      ["notes", body.notes],
      ["baby_sex", body.babySex],
      ["baby_birth_weight_g", body.babyBirthWeightG !== undefined ? toInt(body.babyBirthWeightG) : undefined],
      ["baby_apgar_1min", body.babyApgar1min !== undefined ? toInt(body.babyApgar1min) : undefined],
      ["baby_apgar_5min", body.babyApgar5min !== undefined ? toInt(body.babyApgar5min) : undefined],
      ["baby_condition", body.babyCondition],
      ["baby_notes", body.babyNotes],
    ] as Array<[string, unknown]>).filter(([, v]) => v !== undefined)

    if (fieldMap.length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 })
    }

    const setClauses = fieldMap.map(([col], i) => `${col} = $${i + 2}`).join(", ")
    const values: unknown[] = [id, ...fieldMap.map(([, v]) => v)]

    const { rows } = await queryWithSession(
      { role: auth.role, userId: auth.userId },
      `UPDATE labor_delivery_records SET ${setClauses}, updated_at = NOW() WHERE id = $1 RETURNING *`,
      values,
    )
    return NextResponse.json(rows[0])
  } catch (err) {
    console.error("PATCH /api/labor/[id] error:", err)
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
    if (!can(auth.role, "medical", "update")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const { id } = await params
    if (!id || !UUID_RE.test(id)) {
      return NextResponse.json({ error: "id must be a valid UUID" }, { status: 400 })
    }

    const existing = await queryWithSession(
      { role: auth.role, userId: auth.userId },
      `SELECT midwife_id FROM labor_delivery_records WHERE id = $1`,
      [id],
    )
    if (!existing.rows[0]) return NextResponse.json({ error: "Record not found" }, { status: 404 })
    if (existing.rows[0].midwife_id !== auth.userId && auth.role !== "Hospital Admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    await queryWithSession(
      { role: auth.role, userId: auth.userId },
      `DELETE FROM labor_delivery_records WHERE id = $1`,
      [id],
    )
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    console.error("DELETE /api/labor/[id] error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
