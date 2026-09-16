import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifyToken, can } from "@/lib/security"
import { queryWithSession } from "@/lib/db"

export async function GET(req: Request) {
  const cookieStore = await cookies()
  const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
  const auth = token ? verifyToken(token) : null
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!can(auth.role, "medical", "read")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const url = new URL(req.url)
  const fromParam = url.searchParams.get("from")?.trim() || null
  const toParam = url.searchParams.get("to")?.trim() || null
  const patientId = url.searchParams.get("patientId")?.trim() || null

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (patientId && !UUID_RE.test(patientId)) {
    return NextResponse.json({ error: "patientId must be a valid UUID" }, { status: 400 })
  }

  const session = { role: auth.role, userId: auth.userId }

  const baseSelect = `
    SELECT
      oa.id,
      oa.patient_id,
      oa.visit_date,
      oa.gravida,
      oa.parity,
      oa.gestational_age_weeks,
      oa.edd,
      oa.fundal_height_cm,
      oa.fetal_heart_rate,
      oa.presentation,
      oa.notes,
      p.patient_number,
      CONCAT(p.first_name, ' ', p.last_name) AS patient_name,
      u.name AS recorded_by
    FROM obstetric_assessments oa
    JOIN patients p ON p.id = oa.patient_id
    LEFT JOIN users u ON u.id = oa.recorded_by`

  const conditions: string[] = []
  const values: unknown[] = []

  if (fromParam && toParam) {
    values.push(new Date(fromParam).toISOString())
    values.push(new Date(toParam).toISOString())
    conditions.push(`oa.visit_date >= $${values.length - 1}::timestamp AND oa.visit_date <= $${values.length}::timestamp`)
  }
  if (patientId) {
    values.push(patientId)
    conditions.push(`oa.patient_id = $${values.length}`)
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : ""
  const { rows } = await queryWithSession(
    session,
    `${baseSelect} ${where} ORDER BY oa.visit_date DESC LIMIT 500`,
    values,
  )
  return NextResponse.json({ visits: rows })
}
