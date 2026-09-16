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

  const from = fromParam ? new Date(fromParam) : null
  const to = toParam ? new Date(toParam) : null

  const session = { role: auth.role, userId: auth.userId }

  if (from && to) {
    const { rows: countRows } = await queryWithSession(
      session,
      `SELECT COUNT(*) AS assessments_count, COUNT(DISTINCT patient_id) AS patients_count
       FROM obstetric_assessments
       WHERE visit_date >= $1::timestamp AND visit_date <= $2::timestamp`,
      [from.toISOString(), to.toISOString()],
    )
    const assessmentsCount = parseInt(String(countRows[0]?.assessments_count ?? 0), 10)
    const patientsCount = parseInt(String(countRows[0]?.patients_count ?? 0), 10)
    return NextResponse.json({ assessmentsCount, patientsCount, from: fromParam, to: toParam })
  }

  const { rows: countRows } = await queryWithSession(
    session,
    `SELECT COUNT(*) AS total_assessments, COUNT(DISTINCT patient_id) AS total_patients FROM obstetric_assessments`,
  )
  const assessmentsCount = parseInt(String(countRows[0]?.total_assessments ?? 0), 10)
  const patientsCount = parseInt(String(countRows[0]?.total_patients ?? 0), 10)
  return NextResponse.json({ assessmentsCount, patientsCount })
}
