import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifyToken, can } from "@/lib/security"
import { queryWithSession } from "@/lib/db"

/**
 * GET /api/dental/summary?from=&to=
 * Returns dental visit counts and optional recent records for the current dentist.
 * When from/to provided: counts in that range for this dentist.
 * Always returns recentRecords: last 8 dental records by this dentist (for dashboard).
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

  // Recent dental records for dashboard (last 8 by this dentist, or all if admin)
  const recentSql = onlyMine
    ? `SELECT dr.id, dr.patient_id, dr.visit_date, dr.diagnosis, dr.procedure_performed,
              p.patient_number, p.first_name, p.last_name
       FROM dental_records dr
       JOIN patients p ON p.id = dr.patient_id
       WHERE dr.dentist_id = $1
       ORDER BY dr.visit_date DESC
       LIMIT 8`
    : `SELECT dr.id, dr.patient_id, dr.visit_date, dr.diagnosis, dr.procedure_performed,
              p.patient_number, p.first_name, p.last_name
       FROM dental_records dr
       JOIN patients p ON p.id = dr.patient_id
       ORDER BY dr.visit_date DESC
       LIMIT 8`
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

  // Procedures this week (non-null procedure_performed, by this dentist, Mon–Sun)
  const weekStart = new Date()
  weekStart.setDate(weekStart.getDate() - weekStart.getDay() + (weekStart.getDay() === 0 ? -6 : 1))
  weekStart.setHours(0, 0, 0, 0)
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 6)
  weekEnd.setHours(23, 59, 59, 999)

  const { rows: procRows } = await queryWithSession(session,
    onlyMine
      ? `SELECT COUNT(*) AS cnt FROM dental_records
         WHERE dentist_id = $1 AND procedure_performed IS NOT NULL
           AND visit_date >= $2::timestamp AND visit_date <= $3::timestamp`
      : `SELECT COUNT(*) AS cnt FROM dental_records
         WHERE procedure_performed IS NOT NULL
           AND visit_date >= $1::timestamp AND visit_date <= $2::timestamp`,
    onlyMine
      ? [auth.userId, weekStart.toISOString(), weekEnd.toISOString()]
      : [weekStart.toISOString(), weekEnd.toISOString()]
  )
  const proceduresThisWeek = parseInt(String(procRows[0]?.cnt ?? 0), 10)

  // Pending follow-ups (dental dept appointments, status Scheduled, today or future)
  // Uses onlyMine branching: Dentist sees only their own patients (doctor_id match).
  const { rows: fuRows } = await queryWithSession(session,
    onlyMine
      ? `SELECT COUNT(*) AS cnt FROM appointments
         WHERE LOWER(department) = 'dental'
           AND status = 'Scheduled'
           AND appointment_date >= CURRENT_DATE
           AND doctor_id = $1`
      : `SELECT COUNT(*) AS cnt FROM appointments
         WHERE LOWER(department) = 'dental'
           AND status = 'Scheduled'
           AND appointment_date >= CURRENT_DATE`,
    onlyMine ? [auth.userId] : []
  )
  const pendingFollowUps = parseInt(String(fuRows[0]?.cnt ?? 0), 10)

  // Pending lab results (lab_tests ordered by this dentist, only genuinely in-flight statuses)
  // Valid lab_tests statuses: 'Pending', 'In Progress', 'Completed', 'Cancelled'.
  // Excludes 'Completed' (done) and 'Cancelled' (terminal/abandoned).
  const { rows: labRows } = await queryWithSession(session,
    onlyMine
      ? `SELECT COUNT(*) AS cnt FROM lab_tests
         WHERE doctor_id = $1 AND status IN ('Pending', 'In Progress')`
      : `SELECT COUNT(*) AS cnt FROM lab_tests WHERE status IN ('Pending', 'In Progress')`,
    onlyMine ? [auth.userId] : []
  )
  const pendingLabResults = parseInt(String(labRows[0]?.cnt ?? 0), 10)

  // Pending pre-auths — graceful fallback on RLS or schema errors.
  // Table: preauthorizations (not insurance_authorizations).
  // Columns: status ('Pending','Approved','Denied','Expired'), service_category (added at runtime by preauthorizations route).
  // NOTE: The preauth_rw RLS policy only permits 'Hospital Admin' and 'Receptionist' roles.
  // Dentist role is blocked entirely by RLS, so this will always return 0 for dentists (caught below).
  let pendingPreAuths = 0
  try {
    const { rows: paRows } = await queryWithSession(session,
      `SELECT COUNT(*) AS cnt FROM preauthorizations
       WHERE status = 'Pending'
         AND LOWER(service_category) LIKE '%dental%'`,
      []
    )
    pendingPreAuths = parseInt(String(paRows[0]?.cnt ?? 0), 10)
  } catch {
    // RLS blocks Dentist role from reading preauthorizations; returns 0 silently.
    pendingPreAuths = 0
  }

  return NextResponse.json({
    visitsCount,
    patientsCount,
    proceduresThisWeek,
    pendingFollowUps,
    pendingLabResults,
    pendingPreAuths,
    recentRecords,
    ...(fromParam && toParam ? { from: fromParam, to: toParam } : {}),
  })
}
