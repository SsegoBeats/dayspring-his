import { NextResponse } from "next/server"
import { query } from "@/lib/db"

export async function GET() {
  try {
    const { rows } = await query(
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


