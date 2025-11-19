import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifyToken, can } from "@/lib/security"
import { query } from "@/lib/db"

export async function GET(req: Request) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    const auth = token ? verifyToken(token) : null
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    
    // Allow medical staff to view OPD queue
    if (!(can(auth.role, "medical", "read") || can(auth.role, "patients", "read"))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Get patients with their latest triage assessment
    const { rows } = await query(`
      SELECT 
        t.id,
        t.patient_id,
        p.patient_number,
        CONCAT(p.first_name, ' ', p.last_name) as patient_name,
        t.category as triage_category,
        t.chief_complaint,
        t.recorded_at,
        t.avpu,
        t.temperature,
        t.heart_rate,
        t.blood_pressure_systolic as systolic,
        t.blood_pressure_diastolic as diastolic,
        t.oxygen_saturation as spo2,
        COALESCE((t.metadata->>'painLevel')::int, 0) as pain_level,
        COALESCE(p.current_status, 'triage') as status
      FROM triage_assessments t
      JOIN patients p ON p.id = t.patient_id
      WHERE t.recorded_at >= CURRENT_DATE - INTERVAL '7 days'
        AND NOT EXISTS (
          SELECT 1 FROM triage_assessments t2 
          WHERE t2.patient_id = t.patient_id 
          AND t2.recorded_at > t.recorded_at
        )
      ORDER BY 
        CASE t.category
          WHEN 'Emergency' THEN 1
          WHEN 'Very Urgent' THEN 2
          WHEN 'Urgent' THEN 3
          WHEN 'Routine' THEN 4
          ELSE 5
        END,
        t.recorded_at ASC
    `)

    return NextResponse.json({ patients: rows })
  } catch (error: any) {
    console.error("Error fetching OPD queue:", error)
    return NextResponse.json(
      { error: "Failed to fetch OPD queue", details: error.message },
      { status: 500 }
    )
  }
}