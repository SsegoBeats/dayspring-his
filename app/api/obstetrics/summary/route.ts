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

  // Active pregnancies: patients with EDD in the next 40 weeks
  const { rows: activeRows } = await queryWithSession(
    session,
    `SELECT COUNT(DISTINCT patient_id) AS active_pregnancies
     FROM obstetric_assessments
     WHERE edd IS NOT NULL
       AND edd >= CURRENT_DATE
       AND edd <= CURRENT_DATE + INTERVAL '40 weeks'`,
  )
  const activePregnancies = parseInt(String(activeRows[0]?.active_pregnancies ?? 0), 10)

  // Upcoming deliveries: EDDs within the next 4 weeks
  const { rows: upcomingRows } = await queryWithSession(
    session,
    `SELECT COUNT(DISTINCT patient_id) AS upcoming_deliveries
     FROM obstetric_assessments
     WHERE edd IS NOT NULL
       AND edd >= CURRENT_DATE
       AND edd <= CURRENT_DATE + INTERVAL '4 weeks'`,
  )
  const upcomingDeliveries = parseInt(String(upcomingRows[0]?.upcoming_deliveries ?? 0), 10)

  if (fromParam && toParam) {
    const from = new Date(fromParam)
    const to = new Date(toParam)
    const { rows: countRows } = await queryWithSession(
      session,
      `SELECT COUNT(*) AS assessments_count, COUNT(DISTINCT patient_id) AS patients_count
       FROM obstetric_assessments
       WHERE visit_date >= $1::timestamp AND visit_date <= $2::timestamp`,
      [from.toISOString(), to.toISOString()],
    )
    const assessmentsCount = parseInt(String(countRows[0]?.assessments_count ?? 0), 10)
    const patientsCount = parseInt(String(countRows[0]?.patients_count ?? 0), 10)
    return NextResponse.json({
      assessmentsCount,
      patientsCount,
      activePregnancies,
      upcomingDeliveries,
      from: fromParam,
      to: toParam,
    })
  }

  const { rows: countRows } = await queryWithSession(
    session,
    `SELECT COUNT(*) AS total_assessments, COUNT(DISTINCT patient_id) AS total_patients
     FROM obstetric_assessments`,
  )
  const assessmentsCount = parseInt(String(countRows[0]?.total_assessments ?? 0), 10)
  const patientsCount = parseInt(String(countRows[0]?.total_patients ?? 0), 10)
  return NextResponse.json({ assessmentsCount, patientsCount, activePregnancies, upcomingDeliveries })
}
