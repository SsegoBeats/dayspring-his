import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifyToken } from "@/lib/security"
import { queryWithSession } from "@/lib/db"

export async function GET(req: Request) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    const auth = token ? verifyToken(token) : null
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (auth.role !== "Hospital Admin") {
      return NextResponse.json({ error: "Only Hospital Admin can export the controlled drugs register", code: "FORBIDDEN" }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const from = searchParams.get("from")
    const to = searchParams.get("to")
    const medicationId = searchParams.get("medication_id")

    let where = "WHERE 1=1"
    const params: any[] = []
    let idx = 1
    if (medicationId) { where += ` AND cdr.medication_id = $${idx++}`; params.push(medicationId) }
    if (from) { where += ` AND cdr.dispensed_at >= $${idx++}`; params.push(from) }
    if (to) { where += ` AND cdr.dispensed_at <= $${idx++}`; params.push(to) }

    const { rows } = await queryWithSession({ role: auth.role, userId: auth.userId },
      `SELECT cdr.dispensed_at, m.name AS medication_name, m.schedule_class,
              p.first_name || ' ' || p.last_name AS patient_name,
              cdr.prescriber_name, cdr.prescriber_registration_number,
              cdr.quantity_dispensed, cdr.batch_number, cdr.running_balance,
              u.name AS dispensed_by_name, cdr.witness_name, cdr.notes
         FROM controlled_drug_register cdr
    LEFT JOIN medications m ON m.id = cdr.medication_id
    LEFT JOIN patients p ON p.id = cdr.patient_id
    LEFT JOIN users u ON u.id = cdr.dispensed_by
        ${where}
     ORDER BY m.name ASC, cdr.dispensed_at ASC`,
      params
    )

    // Return as JSON — frontend generates the PDF using jspdf (same pattern as financial reports)
    return NextResponse.json({ entries: rows, generated_at: new Date().toISOString(), generated_by: auth.userId })
  } catch (err: any) {
    return NextResponse.json({ error: "Failed to export controlled drugs register" }, { status: 500 })
  }
}
