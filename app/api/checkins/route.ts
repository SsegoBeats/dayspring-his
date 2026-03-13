import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { z } from "zod"
import { verifyToken, can } from "@/lib/security"
import { queryWithSession } from "@/lib/db"
import { writeAuditLog } from "@/lib/audit"
import { ensureNotificationInfrastructure } from "@/lib/notifications"

const CreateCheckin = z.object({
  patientId: z.string().uuid(),
  appointmentId: z.string().uuid().nullable().optional(),
  department: z.string().min(2).max(100).optional(),
})

export async function GET(req: Request) {
  const cookieStore = await cookies()
  const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
  const auth = token ? verifyToken(token) : null
  if (!auth || !can(auth.role, "checkins", "read")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const url = new URL(req.url)
  const date = url.searchParams.get("date") || new Date().toISOString().slice(0, 10)
  const department = url.searchParams.get("department")

  const { rows } = await queryWithSession(
    { role: auth.role, userId: auth.userId },
    `SELECT c.id, c.status, c.created_at,
            p.id as patient_id, p.first_name, p.last_name, p.patient_number, p.phone,
            a.id as appointment_id, a.department, a.appointment_time
       FROM checkins c
       JOIN patients p ON p.id = c.patient_id
       LEFT JOIN appointments a ON a.id = c.appointment_id
      WHERE c.created_at::date = $1
        AND ($2::text IS NULL OR a.department = $2)
      ORDER BY c.created_at DESC`,
    [date, department]
  )
  return NextResponse.json({ checkins: rows })
}

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    const auth = token ? verifyToken(token) : null
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!can(auth.role, "checkins", "create")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const body = await req.json()
    const data = CreateCheckin.parse(body)
    let appointmentId = data.appointmentId || null

    if (!appointmentId) {
      const { rows: sameDayAppointments } = await queryWithSession<{ id: string }>(
        { role: auth.role, userId: auth.userId },
        `SELECT id
           FROM appointments
          WHERE patient_id = $1
            AND appointment_date = CURRENT_DATE
            AND status = 'Scheduled'
          ORDER BY appointment_time ASC
          LIMIT 1`,
        [data.patientId],
      )
      appointmentId = sameDayAppointments[0]?.id || null
    }

    // Insert into checkins using only columns that exist (supports older DBs)
    const colsRes = await queryWithSession<{ column_name: string }>(
      { role: auth.role, userId: auth.userId },
      `SELECT column_name FROM information_schema.columns WHERE table_name='checkins'`
    )
    const present = new Set((colsRes.rows || []).map((r) => r.column_name))
    const insertCols: string[] = []
    const values: any[] = []
    const placeholders: string[] = []
    const pushCol = (col: string, val: any) => {
      if (present.has(col)) { insertCols.push(col); values.push(val); placeholders.push(`$${values.length}`) }
    }
    pushCol('patient_id', data.patientId)
    if (appointmentId) pushCol('appointment_id', appointmentId)
    // Default status to 'Arrived' if status column exists
    if (present.has('status')) pushCol('status', 'Arrived')
    // Track receptionist if column exists
    if (present.has('receptionist_id')) pushCol('receptionist_id', auth.userId)
    const sql = `INSERT INTO checkins (${insertCols.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING id`
    const { rows } = await queryWithSession(
      { role: auth.role, userId: auth.userId },
      sql,
      values,
    )
    const id = rows[0]?.id as string

    // Optionally place into a department queue if provided
    if (data.department) {
      const qcols = await queryWithSession<{ column_name: string }>(
        { role: auth.role, userId: auth.userId },
        `SELECT column_name FROM information_schema.columns WHERE table_name='queues'`
      )
      const qset = new Set((qcols.rows || []).map((r) => r.column_name))
      const qc: string[] = []
      const qv: any[] = []
      const qp: string[] = []
      const pushQ = (col: string, val: any) => { if (qset.has(col)) { qc.push(col); qv.push(val); qp.push(`$${qv.length}`) } }
      pushQ('department', data.department)
      pushQ('checkin_id', id)
      if (qset.has('status')) pushQ('status', 'waiting')
      if (qset.has('priority')) pushQ('priority', 0)
      if (qset.has('position')) {
        // Compute position via subquery for waiting lane
        let deptClause = ""
        if (qset.has('department')) {
          const placeholder = `$${qv.length + 1}`
          qv.push(data.department)
          deptClause = `department=${placeholder} AND `
        }
        const posExpr = `(SELECT COALESCE(MAX(position),0)+1 FROM queues WHERE ${deptClause}${qset.has('status') ? "status='waiting'" : '1=1'})`
        qc.push('position')
        // For values array, we won't push a concrete value; we will inline the expression and adjust placeholders
        // Build INSERT with mixed expressions/params
        const colsSql = qc.join(', ')
        const valParts: string[] = []
        let paramIdx = 1
        for (let i = 0; i < qc.length; i++) {
          const col = qc[i]
          if (col === 'position') { valParts.push(posExpr) }
          else { valParts.push(`$${paramIdx++}`) }
        }
        await queryWithSession(
          { role: auth.role, userId: auth.userId },
          `INSERT INTO queues (${colsSql}) VALUES (${valParts.join(', ')})`,
          qv,
        )
      } else {
        await queryWithSession(
          { role: auth.role, userId: auth.userId },
          `INSERT INTO queues (${qc.join(', ')}) VALUES (${qp.join(', ')})`,
          qv,
        )
      }
    }

    try {
      await ensureNotificationInfrastructure()

      const { rows: contextRows } = await queryWithSession<{
        first_name: string
        last_name: string
        patient_number: string
        appointment_department: string | null
        doctor_id: string | null
        doctor_name: string | null
      }>(
        { role: auth.role, userId: auth.userId },
        `SELECT p.first_name,
                p.last_name,
                p.patient_number,
                a.department AS appointment_department,
                a.doctor_id,
                u.name AS doctor_name
           FROM patients p
           LEFT JOIN appointments a ON a.id = $2
           LEFT JOIN users u ON u.id = a.doctor_id
          WHERE p.id = $1
          LIMIT 1`,
        [data.patientId, appointmentId],
      )

      const context = contextRows[0]
      const patientName = context ? `${context.first_name} ${context.last_name}`.trim() : "Patient"
      const effectiveDepartment = data.department || context?.appointment_department || null
      const payload = JSON.stringify({
        patientId: data.patientId,
        checkinId: id,
        appointmentId,
        department: effectiveDepartment,
      })

      if (effectiveDepartment) {
        await queryWithSession(
          { role: auth.role, userId: auth.userId },
          `INSERT INTO notifications (user_id, department, role, title, message, type, priority, payload)
           VALUES (NULL, $1, NULL, $2, $3, $4, $5, $6)`,
          [
            effectiveDepartment,
            "Patient Arrived",
            `${patientName} has checked in${appointmentId ? " for a scheduled appointment" : ""}.`,
            "Patient Arrival",
            appointmentId ? "High" : "Normal",
            payload,
          ],
        )
      }

      if (context?.doctor_id) {
        await queryWithSession(
          { role: auth.role, userId: auth.userId },
          `INSERT INTO notifications (user_id, department, role, title, message, type, priority, payload)
           VALUES ($1, NULL, NULL, $2, $3, $4, $5, $6)`,
          [
            context.doctor_id,
            "Patient Arrived for Appointment",
            `${patientName} has checked in${effectiveDepartment ? ` at ${effectiveDepartment}` : ""}.`,
            "Patient Arrival",
            "High",
            payload,
          ],
        )
      }
    } catch {}

    await writeAuditLog({ userId: auth.userId, action: "CHECKIN_CREATE", entityType: "Checkin", entityId: id, details: { ...data, appointmentId } })
    return NextResponse.json({ id })
  } catch (err: any) {
    if (err?.name === "ZodError") return NextResponse.json({ error: "Validation error", details: err.issues }, { status: 400 })
    return NextResponse.json({ error: "Failed to create check-in" }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    const auth = token ? verifyToken(token) : null
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!can(auth.role, "checkins", "update")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const url = new URL(req.url)
    const id = url.searchParams.get("id")
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 })
    const body = await req.json()
    const Update = z.object({ status: z.enum(['Arrived','With Nurse','In Room','Complete','Cancelled']) })
    const data = Update.parse(body)

    await queryWithSession(
      { role: auth.role, userId: auth.userId },
      `UPDATE checkins SET status=$1, updated_at=NOW() WHERE id=$2`,
      [data.status, id]
    )
    await writeAuditLog({ userId: auth.userId, action: "CHECKIN_UPDATE", entityType: "Checkin", entityId: id, details: data })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    if (err?.name === "ZodError") return NextResponse.json({ error: "Validation error", details: err.issues }, { status: 400 })
    return NextResponse.json({ error: "Failed to update check-in" }, { status: 500 })
  }
}
