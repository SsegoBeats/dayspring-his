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
    if (!can(auth.role, "pharmacy", "read")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const { searchParams } = new URL(req.url)
    const medicationId = searchParams.get("medication_id")
    const from = searchParams.get("from")
    const to = searchParams.get("to")
    const page = parseInt(searchParams.get("page") || "1")
    const limit = 50
    const offset = (page - 1) * limit

    let where = "WHERE 1=1"
    const params: any[] = []
    let idx = 1
    if (medicationId) { where += ` AND cdr.medication_id = $${idx++}`; params.push(medicationId) }
    if (from) { where += ` AND cdr.dispensed_at >= $${idx++}`; params.push(from) }
    if (to) { where += ` AND cdr.dispensed_at <= $${idx++}`; params.push(to) }

    const { rows } = await queryWithSession({ role: auth.role, userId: auth.userId },
      `SELECT cdr.*,
              m.name AS medication_name, m.schedule_class,
              p.first_name || ' ' || p.last_name AS patient_name,
              u.full_name AS dispensed_by_name
         FROM controlled_drug_register cdr
    LEFT JOIN medications m ON m.id = cdr.medication_id
    LEFT JOIN patients p ON p.id = cdr.patient_id
    LEFT JOIN users u ON u.id = cdr.dispensed_by
        ${where}
     ORDER BY cdr.dispensed_at DESC
        LIMIT $${idx++} OFFSET $${idx++}`,
      [...params, limit, offset]
    )

    const { rows: [{ total }] } = await queryWithSession({ role: auth.role, userId: auth.userId },
      `SELECT COUNT(*) AS total FROM controlled_drug_register cdr ${where}`, params
    )

    return NextResponse.json({ entries: rows, total: Number(total), page, limit })
  } catch (err: any) {
    return NextResponse.json({ error: "Failed to fetch controlled drugs register" }, { status: 500 })
  }
}
