import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifyToken, can } from "@/lib/security"
import { query, queryWithSession } from "@/lib/db"

async function ensureLabSchemaForMedical() {
  try {
    await query("ALTER TABLE lab_tests ADD COLUMN IF NOT EXISTS priority VARCHAR(20) DEFAULT 'Routine'")
    await query("ALTER TABLE lab_tests ADD COLUMN IF NOT EXISTS assigned_radiologist_id UUID REFERENCES users(id)")
    await query("ALTER TABLE lab_tests ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMP")
  } catch {
    // If this fails, we'll still attempt the main query and surface any real error there.
  }
}

export async function GET() {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    const auth = token ? verifyToken(token) : null
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!can(auth.role, "medical", "read")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    await ensureLabSchemaForMedical()

    const [records, prescriptions, labs] = await Promise.all([
      queryWithSession({ role: auth.role, userId: auth.userId },
        `SELECT mr.id, mr.patient_id, mr.doctor_id, mr.visit_date, mr.chief_complaint, mr.diagnosis, mr.treatment_plan, mr.notes,
                u.name AS doctor_name,
                TRIM(CONCAT(p.first_name, ' ', p.last_name)) AS patient_name,
                vs.blood_pressure_systolic, vs.blood_pressure_diastolic, vs.heart_rate, vs.temperature,
                vs.respiratory_rate, vs.oxygen_saturation
         FROM medical_records mr
         LEFT JOIN users u ON u.id = mr.doctor_id
         LEFT JOIN patients p ON p.id = mr.patient_id
         LEFT JOIN LATERAL (
           SELECT blood_pressure_systolic, blood_pressure_diastolic, heart_rate, temperature,
                  respiratory_rate, oxygen_saturation
           FROM vital_signs
           WHERE vital_signs.medical_record_id = mr.id
           ORDER BY recorded_at DESC NULLS LAST
           LIMIT 1
         ) vs ON true
         ORDER BY mr.visit_date DESC LIMIT 500`,
      ),
      queryWithSession({ role: auth.role, userId: auth.userId },
        `SELECT pr.id, pr.patient_id, pr.doctor_id, pr.medication_name, pr.dosage, pr.frequency, pr.duration, pr.instructions, pr.status, pr.created_at,
                u.name AS doctor_name,
                TRIM(CONCAT(p.first_name, ' ', p.last_name)) AS patient_name
         FROM prescriptions pr
         LEFT JOIN users u ON u.id = pr.doctor_id
         LEFT JOIN patients p ON p.id = pr.patient_id
         ORDER BY pr.created_at DESC LIMIT 500`,
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
    console.error("Error in /api/medical:", err)
    return NextResponse.json({ error: "Failed to fetch medical data" }, { status: 500 })
  }
}


