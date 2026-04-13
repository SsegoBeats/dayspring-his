import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifyToken, can } from "@/lib/security"
import { queryWithSession } from "@/lib/db"

/**
 * GET /api/dental/summary?from=&to=
 * Returns dental visit counts and optional recent records for the current dentist.
 * When from/to provided: counts in that range for this dentist.
 * Always returns recentRecords: last 5 dental records by this dentist (for dashboard).
 */
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

  // Only dentists get "my" counts; others (e.g. Admin) get facility-wide counts
  const onlyMine = auth.role === "Dentist"

  let visitsCount = 0
  let patientsCount = 0

  if (fromParam && toParam) {
    const from = new Date(fromParam)
    const to = new Date(toParam)
    const countSql = onlyMine
      ? `SELECT COUNT(*) AS visits_count, COUNT(DISTINCT patient_id) AS patients_count
         FROM dental_records
         WHERE dentist_id = $1 AND visit_date >= $2::timestamp AND visit_date <= $3::timestamp`
      : `SELECT COUNT(*) AS visits_count, COUNT(DISTINCT patient_id) AS patients_count
         FROM dental_records
         WHERE visit_date >= $1::timestamp AND visit_date <= $2::timestamp`
    const countParams = onlyMine ? [auth.userId, from.toISOString(), to.toISOString()] : [from.toISOString(), to.toISOString()]
    const { rows: countRows } = await queryWithSession(session, countSql, countParams)
    visitsCount = parseInt(String(countRows[0]?.visits_count ?? 0), 10)
    patientsCount = parseInt(String(countRows[0]?.patients_count ?? 0), 10)
  }

  // Recent dental records for dashboard (last 5 by this dentist, or all if admin)
  const recentSql = onlyMine
    ? `SELECT dr.id, dr.patient_id, dr.visit_date, dr.diagnosis, dr.procedure_performed,
              p.patient_number, p.first_name, p.last_name
       FROM dental_records dr
       JOIN patients p ON p.id = dr.patient_id
       WHERE dr.dentist_id = $1
       ORDER BY dr.visit_date DESC
       LIMIT 5`
    : `SELECT dr.id, dr.patient_id, dr.visit_date, dr.diagnosis, dr.procedure_performed,
              p.patient_number, p.first_name, p.last_name
       FROM dental_records dr
       JOIN patients p ON p.id = dr.patient_id
       ORDER BY dr.visit_date DESC
       LIMIT 5`
  const recentParams = onlyMine ? [auth.userId] : []
  const { rows: recentRows } = await queryWithSession(session, recentSql, recentParams)
  const recentRecords = (recentRows || []).map((r: any) => ({
    id: r.id,
    patientId: r.patient_id,
    visitDate: r.visit_date,
    diagnosis: r.diagnosis,
    procedurePerformed: r.procedure_performed,
    patientNumber: r.patient_number,
    patientName: [r.first_name, r.last_name].filter(Boolean).join(" ").trim(),
  }))

  return NextResponse.json({
    visitsCount,
    patientsCount,
    recentRecords,
    ...(fromParam && toParam ? { from: fromParam, to: toParam } : {}),
  })
}
