import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifyToken, can } from "@/lib/security"
import { query } from "@/lib/db"
import { z } from "zod"

const StatusSchema = z.object({
  status: z.enum(["triage", "consultation", "treatment", "discharged"]),
  triageId: z.string().uuid(),
})

export async function PATCH(req: Request) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    const auth = token ? verifyToken(token) : null
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    
    // Allow medical staff to update status
    if (!(can(auth.role, "medical", "update") || can(auth.role, "patients", "update"))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await req.json()
    const { status, triageId } = StatusSchema.parse(body)

    // Get patient ID from triage assessment
    const { rows: patientRows } = await query(
      `SELECT patient_id FROM triage_assessments WHERE id = $1`,
      [triageId]
    )

    if (patientRows.length === 0) {
      return NextResponse.json({ error: "Triage assessment not found" }, { status: 404 })
    }

    const patientId = patientRows[0].patient_id

    // Update patient status
    await query(
      `UPDATE patients 
       SET current_status = $1, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $2`,
      [status, patientId]
    )

    // Log status change
    await query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details) 
       VALUES ($1, $2, $3, $4, $5)`,
      [
        auth.userId,
        "UPDATE",
        "PatientStatus",
        patientId,
        JSON.stringify({ status, timestamp: new Date().toISOString() })
      ]
    )

    return NextResponse.json({ success: true, status })
  } catch (error: any) {
    console.error("Error updating patient status:", error)
    return NextResponse.json(
      { error: "Failed to update status", details: error.message },
      { status: 500 }
    )
  }
}
