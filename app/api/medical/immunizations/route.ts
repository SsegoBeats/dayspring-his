import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifyToken, can } from "@/lib/security"
import { queryWithSession } from "@/lib/db"

async function getAuth() {
  const cookieStore = await cookies()
  const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
  const auth = token ? verifyToken(token) : null
  return auth
}

export async function GET(req: Request) {
  try {
    const auth = await getAuth()
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!can(auth.role, "medical", "read")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const { searchParams } = new URL(req.url)
    const patientId = searchParams.get("patientId")

    const whereClause = patientId ? "WHERE pi.patient_id = $1" : ""
    const params = patientId ? [patientId] : []

    const { rows } = await queryWithSession(
      { role: auth.role, userId: auth.userId },
      `SELECT pi.id, pi.patient_id, pi.vaccine_name, pi.date_administered,
              pi.next_due_date, pi.administered_by, pi.batch_number, pi.notes, pi.created_at
       FROM patient_immunizations pi
       ${whereClause}
       ORDER BY pi.date_administered DESC`,
      params,
    )

    return NextResponse.json({ immunizations: rows })
  } catch (err) {
    console.error("Error fetching immunizations:", err)
    return NextResponse.json({ error: "Failed to fetch immunizations" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const auth = await getAuth()
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!can(auth.role, "medical", "create")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const body = (await req.json().catch(() => ({}))) as {
      patientId?: string
      vaccineName?: string
      dateAdministered?: string
      nextDueDate?: string
      administeredBy?: string
      batchNumber?: string
      notes?: string
    }

    const patientId = (body.patientId || "").trim()
    const vaccineName = (body.vaccineName || "").trim()
    const dateAdministered = (body.dateAdministered || "").trim()

    if (!patientId || !vaccineName || !dateAdministered) {
      return NextResponse.json({ error: "patientId, vaccineName, and dateAdministered are required" }, { status: 400 })
    }

    const { rows } = await queryWithSession(
      { role: auth.role, userId: auth.userId },
      `INSERT INTO patient_immunizations (patient_id, vaccine_name, date_administered, next_due_date, administered_by, batch_number, notes, recorded_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, patient_id, vaccine_name, date_administered, next_due_date, administered_by, batch_number, notes, created_at`,
      [
        patientId,
        vaccineName,
        dateAdministered,
        body.nextDueDate || null,
        body.administeredBy || null,
        body.batchNumber || null,
        body.notes || null,
        auth.userId,
      ],
    )

    return NextResponse.json({ immunization: rows[0] })
  } catch (err) {
    console.error("Error creating immunization:", err)
    return NextResponse.json({ error: "Failed to create immunization" }, { status: 500 })
  }
}
