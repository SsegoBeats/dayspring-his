import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { z } from "zod"
import { verifyToken, can } from "@/lib/security"
import { queryWithSession } from "@/lib/db"

const UpdateDentalSchema = z.object({
  diagnosis: z.string().optional().nullable(),
  procedurePerformed: z.string().optional().nullable(),
  toothChart: z.record(z.string(), z.any()).optional().nullable(),
  notes: z.string().optional().nullable(),
  visitDate: z.string().datetime().optional().nullable(),
})

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    const auth = token ? verifyToken(token) : null
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!can(auth.role, "medical", "update")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const id = params.id
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 })

    const body = await req.json().catch(() => ({}))
    const input = UpdateDentalSchema.parse(body)

    const updates: string[] = []
    const values: unknown[] = []
    let idx = 1
    if (input.diagnosis !== undefined) {
      updates.push(`diagnosis = $${idx++}`)
      values.push(input.diagnosis)
    }
    if (input.procedurePerformed !== undefined) {
      updates.push(`procedure_performed = $${idx++}`)
      values.push(input.procedurePerformed)
    }
    if (input.toothChart !== undefined) {
      updates.push(`tooth_chart = $${idx++}::jsonb`)
      values.push(JSON.stringify(input.toothChart))
    }
    if (input.notes !== undefined) {
      updates.push(`notes = $${idx++}`)
      values.push(input.notes)
    }
    if (input.visitDate !== undefined && input.visitDate !== null) {
      updates.push(`visit_date = $${idx++}::timestamp`)
      values.push(input.visitDate)
    }
    updates.push(`updated_at = CURRENT_TIMESTAMP`)
    values.push(id)
    const { rows } = await queryWithSession(
      { role: auth.role, userId: auth.userId },
      `UPDATE dental_records SET ${updates.join(", ")} WHERE id = $${idx} RETURNING id, patient_id, dentist_id, visit_date, diagnosis, procedure_performed, tooth_chart, notes`,
      values,
    )
    if (!rows.length) return NextResponse.json({ error: "Not found" }, { status: 404 })
    return NextResponse.json({ record: rows[0] })
  } catch (err: any) {
    if (err?.name === "ZodError") {
      return NextResponse.json({ error: "Validation error", details: err.issues }, { status: 400 })
    }
    return NextResponse.json({ error: "Failed to update dental record" }, { status: 500 })
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } },
) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    const auth = token ? verifyToken(token) : null
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!can(auth.role, "medical", "update")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const id = params.id
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 })

    const { rows } = await queryWithSession(
      { role: auth.role, userId: auth.userId },
      `DELETE FROM dental_records WHERE id = $1 RETURNING id`,
      [id],
    )
    if (!rows.length) return NextResponse.json({ error: "Not found" }, { status: 404 })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: "Failed to delete dental record" }, { status: 500 })
  }
}
