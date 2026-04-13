import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { z } from "zod"
import { verifyToken, can } from "@/lib/security"
import { queryWithSession } from "@/lib/db"

const UpdateSchema = z.object({
  visitDate: z.string().optional().nullable(),
  gravida: z.number().int().nonnegative().optional().nullable(),
  parity: z.number().int().nonnegative().optional().nullable(),
  gestationalAgeWeeks: z.number().int().nonnegative().optional().nullable(),
  edd: z.string().optional().nullable(),
  fundalHeightCm: z.number().nonnegative().optional().nullable(),
  fetalHeartRate: z.number().int().nonnegative().optional().nullable(),
  presentation: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
})

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    if (!id) return NextResponse.json({ error: "Assessment id required" }, { status: 400 })

    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    const auth = token ? verifyToken(token) : null
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!can(auth.role, "medical", "update")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const body = await req.json().catch(() => ({}))
    const input = UpdateSchema.parse(body)

    const updates: string[] = []
    const values: any[] = []
    let pos = 1

    if (input.visitDate !== undefined) {
      const d = input.visitDate ? new Date(input.visitDate) : null
      updates.push(`visit_date = $${pos++}`)
      values.push(d ? d.toISOString() : null)
    }
    if (input.gravida !== undefined) {
      updates.push(`gravida = $${pos++}`)
      values.push(input.gravida)
    }
    if (input.parity !== undefined) {
      updates.push(`parity = $${pos++}`)
      values.push(input.parity)
    }
    if (input.gestationalAgeWeeks !== undefined) {
      updates.push(`gestational_age_weeks = $${pos++}`)
      values.push(input.gestationalAgeWeeks)
    }
    if (input.edd !== undefined) {
      updates.push(`edd = $${pos++}`)
      values.push(input.edd ? new Date(input.edd).toISOString().slice(0, 10) : null)
    }
    if (input.fundalHeightCm !== undefined) {
      updates.push(`fundal_height_cm = $${pos++}`)
      values.push(input.fundalHeightCm)
    }
    if (input.fetalHeartRate !== undefined) {
      updates.push(`fetal_heart_rate = $${pos++}`)
      values.push(input.fetalHeartRate)
    }
    if (input.presentation !== undefined) {
      updates.push(`presentation = $${pos++}`)
      values.push(input.presentation)
    }
    if (input.notes !== undefined) {
      updates.push(`notes = $${pos++}`)
      values.push(input.notes)
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 })
    }
    updates.push(`updated_at = CURRENT_TIMESTAMP`)

    values.push(id)
    const setClause = updates.join(", ")
    const sql = `UPDATE obstetric_assessments SET ${setClause} WHERE id = $${pos} RETURNING id, patient_id, recorded_by, visit_date, gravida, parity, gestational_age_weeks, edd, fundal_height_cm, fetal_heart_rate, presentation, notes`

    const { rows } = await queryWithSession(
      { role: auth.role, userId: auth.userId },
      sql,
      values,
    )

    if (rows.length === 0) {
      return NextResponse.json({ error: "Assessment not found or access denied" }, { status: 404 })
    }
    return NextResponse.json({ assessment: rows[0] })
  } catch (error: any) {
    if (error?.name === "ZodError") {
      return NextResponse.json({ error: "Validation error", details: error.issues }, { status: 400 })
    }
    return NextResponse.json({ error: "Failed to update obstetric assessment" }, { status: 500 })
  }
}
