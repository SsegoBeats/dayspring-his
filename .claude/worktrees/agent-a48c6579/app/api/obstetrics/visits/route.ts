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

  const session = { role: auth.role, userId: auth.userId }

  if (fromParam && toParam) {
    const from = new Date(fromParam)
    const to = new Date(toParam)
    const { rows } = await queryWithSession(
      session,
      `SELECT
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
       LEFT JOIN users u ON u.id = oa.recorded_by
       WHERE oa.visit_date >= $1::timestamp AND oa.visit_date <= $2::timestamp
       ORDER BY oa.visit_date DESC
       LIMIT 500`,
      [from.toISOString(), to.toISOString()],
    )
    return NextResponse.json({ visits: rows })
  }

  const { rows } = await queryWithSession(
    session,
    `SELECT
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
     LEFT JOIN users u ON u.id = oa.recorded_by
     ORDER BY oa.visit_date DESC
     LIMIT 500`,
  )
  return NextResponse.json({ visits: rows })
}
