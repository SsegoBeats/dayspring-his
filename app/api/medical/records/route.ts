import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifyToken, can } from "@/lib/security"
import { queryWithSession } from "@/lib/db"

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    const auth = token ? verifyToken(token) : null
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!can(auth.role, "medical", "create")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const body = (await req.json().catch(() => ({}))) as {
      patientId?: string
      chiefComplaint?: string
      diagnosis?: string
      treatmentPlan?: string
      notes?: string
    }

    const patientId = (body.patientId || "").trim()
    if (!patientId) {
      return NextResponse.json({ error: "patientId is required" }, { status: 400 })
    }

    const chiefComplaint = body.chiefComplaint || null
    const diagnosis = body.diagnosis || null
    const treatmentPlan = body.treatmentPlan || null
    const notes = body.notes || null

    const { rows } = await queryWithSession(
      { role: auth.role, userId: auth.userId },
      `INSERT INTO medical_records (
         patient_id, doctor_id, chief_complaint, diagnosis, treatment_plan, notes
       ) VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING id, patient_id, doctor_id, visit_date, chief_complaint, diagnosis, treatment_plan, notes`,
      [patientId, auth.userId, chiefComplaint, diagnosis, treatmentPlan, notes],
    )

    return NextResponse.json({ record: rows[0] })
  } catch (err: any) {
    return NextResponse.json({ error: "Failed to create medical record" }, { status: 500 })
  }
}

