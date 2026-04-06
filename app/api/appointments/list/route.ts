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
    if (!can(auth.role, "appointments", "read")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const { rows } = await queryWithSession(
      { role: auth.role, userId: auth.userId },
      `SELECT a.id, a.appointment_date, a.appointment_time, a.department, a.reason, a.status, a.notes,
              p.id as patient_id, p.first_name, p.last_name,
              u.name as doctor_name
       FROM appointments a
       JOIN patients p ON p.id = a.patient_id
       LEFT JOIN users u ON u.id = a.doctor_id
       ORDER BY a.appointment_date DESC, a.appointment_time DESC
       LIMIT 500`,
    )
    return NextResponse.json({ appointments: rows })
  } catch (err: any) {
    return NextResponse.json({ error: "Failed to fetch appointments" }, { status: 500 })
  }
}


