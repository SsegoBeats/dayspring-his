import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifyToken, can } from "@/lib/security"
import { queryWithSession } from "@/lib/db"

export async function GET(req: Request) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    const auth = token ? verifyToken(token) : null
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!can(auth.role, "medical", "read")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const url = new URL(req.url)
    const patientId = (url.searchParams.get("patientId") || "").trim()
    const medicationName = (url.searchParams.get("medicationName") || "").trim()
    const limitParam = url.searchParams.get("limit")
    const limit = Math.min(Math.max(Number(limitParam) || 100, 1), 500)

    if (!patientId) {
      return NextResponse.json({ error: "patientId is required" }, { status: 400 })
    }

    const params: any[] = [patientId]
    let where = "WHERE pr.patient_id = $1"

    if (medicationName) {
      where += " AND LOWER(pr.medication_name) LIKE $" + (params.length + 1)
      params.push(`%${medicationName.toLowerCase()}%`)
    }

    const { rows } = await queryWithSession(
      { role: auth.role, userId: auth.userId },
      `
        SELECT pr.id,
               pr.patient_id,
               pr.medication_name,
               pr.dosage,
               pr.frequency,
               pr.duration,
               pr.instructions,
               pr.quantity,
               pr.status,
               pr.priority,
               pr.expiry_date,
               pr.clinical_notes,
               pr.is_controlled_substance,
               pr.refills_authorized,
               pr.refills_remaining,
               pr.created_at,
               pr.dispensed_at,
               u1.name AS doctor_name,
               u2.name AS dispensed_by_name,
               p.first_name || ' ' || p.last_name AS patient_name
          FROM prescriptions pr
          LEFT JOIN users u1 ON u1.id = pr.doctor_id
          LEFT JOIN users u2 ON u2.id = pr.dispensed_by
          LEFT JOIN patients p ON p.id = pr.patient_id
          ${where}
         ORDER BY pr.created_at DESC
         LIMIT ${limit}
      `,
      params,
    )

    // Get refill history for each prescription
    const prescriptionsWithRefills = await Promise.all(
      rows.map(async (prescription) => {
        const { rows: refillRows } = await queryWithSession(
          { role: auth.role, userId: auth.userId },
          `SELECT id, refill_number, dispensed_at, dispensed_by, notes, created_at
           FROM prescription_refills
           WHERE prescription_id = $1
           ORDER BY refill_number ASC`,
          [prescription.id],
        )

        return {
          ...prescription,
          refills: refillRows,
        }
      }),
    )

    return NextResponse.json({ prescriptions: prescriptionsWithRefills })
  } catch (err: any) {
    console.error("Error fetching prescription history:", err)
    return NextResponse.json({ error: "Failed to fetch prescription history" }, { status: 500 })
  }
}

