import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { z } from "zod"
import { verifyToken, can } from "@/lib/security"
import { queryWithSession } from "@/lib/db"
import { writeAuditLog } from "@/lib/audit"
import { rateLimitPg } from "@/lib/rate-limit-pg"
import { emailTemplates, sendEmail } from "@/lib/email-service"

const CreateAppt = z.object({
  patientId: z.string().uuid(),
  doctorId: z.string().uuid().nullable().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  department: z.string().min(2).max(100),
  reason: z.string().min(3).max(500).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
})

export async function POST(req: Request) {
  try {
    const ip = (req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "127.0.0.1").split(",")[0]
    if (!(await rateLimitPg(`appointments:${ip}`, 60, 60))) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 })
    }
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    const auth = token ? verifyToken(token) : null
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    if (!can(auth.role, "appointments", "create")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    const body = await req.json()
    const data = CreateAppt.parse(body)

    // Prevent double booking: same patient at same date+time
    const { rows: conflict } = await queryWithSession({ role: auth.role, userId: auth.userId },
      `SELECT 1 FROM appointments WHERE patient_id = $1 AND appointment_date = $2 AND appointment_time = $3 LIMIT 1`,
      [data.patientId, data.date, data.time],
    )
    if (conflict.length) {
      return NextResponse.json({ error: "Appointment already exists for this slot" }, { status: 409 })
    }

    const { rows } = await queryWithSession({ role: auth.role, userId: auth.userId },
      `INSERT INTO appointments (patient_id, doctor_id, appointment_date, appointment_time, department, reason, status, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,'Scheduled',$7,$8) RETURNING id`,
      [data.patientId, data.doctorId || null, data.date, data.time, data.department, data.reason || null, data.notes || null, auth.userId],
    )
    const id = rows[0].id as string

    // Fetch patient email for confirmation
    const { rows: patientRows } = await queryWithSession<{ email: string; first_name: string; last_name: string }>(
      `SELECT email, first_name, last_name FROM patients WHERE id = $1`,
      [data.patientId],
    )
    const patient = patientRows[0]
    if (patient?.email) {
      const html = emailTemplates.appointmentConfirmation(
        `${patient.first_name} ${patient.last_name}`,
        "",
        data.date,
        data.time,
        data.department,
      )
      await sendEmail(patient.email, html)
    }

    await writeAuditLog({ action: "appointment_created", entityType: "appointment", entityId: id, details: data, userId: auth.userId })
    return NextResponse.json({ id })
  } catch (err: any) {
    if (err?.name === "ZodError") return NextResponse.json({ error: "Validation error", details: err.issues }, { status: 400 })
    return NextResponse.json({ error: "Failed to create appointment" }, { status: 500 })
  }
}


