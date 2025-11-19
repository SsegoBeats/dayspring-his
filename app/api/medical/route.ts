import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifyToken, can } from "@/lib/security"
import { queryWithSession } from "@/lib/db"

export async function GET() {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    const auth = token ? verifyToken(token) : null
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!can(auth.role, "medical", "read")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    const [records, prescriptions, labs] = await Promise.all([
      queryWithSession({ role: auth.role, userId: auth.userId },
        `SELECT id, patient_id, doctor_id, visit_date, chief_complaint, diagnosis, treatment_plan, notes FROM medical_records ORDER BY visit_date DESC LIMIT 500`,
      ),
      queryWithSession({ role: auth.role, userId: auth.userId },
        `SELECT id, patient_id, doctor_id, medication_name, dosage, frequency, duration, instructions, status, created_at FROM prescriptions ORDER BY created_at DESC LIMIT 500`,
      ),
      queryWithSession(
        { role: auth.role, userId: auth.userId },
        `SELECT lt.id,
                lt.patient_id,
                lt.doctor_id,
                lt.test_name AS test_type,
                lt.priority,
                lt.status,
                lt.results,
                lt.notes,
                lt.ordered_at AS ordered_date,
                lt.completed_at AS completed_date,
                lt.assigned_radiologist_id,
                ar.name AS assigned_radiologist_name
           FROM lab_tests lt
           LEFT JOIN users ar ON ar.id = lt.assigned_radiologist_id
          ORDER BY lt.ordered_at DESC
          LIMIT 500`,
      ),
    ])
    return NextResponse.json({ medicalRecords: records.rows, prescriptions: prescriptions.rows, labResults: labs.rows })
  } catch (err: any) {
    return NextResponse.json({ error: "Failed to fetch medical data" }, { status: 500 })
  }
}


