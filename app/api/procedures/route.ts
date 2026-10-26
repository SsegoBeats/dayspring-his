import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { queryWithSession } from "@/lib/db"
import { can, verifyToken } from "@/lib/security"
import { z } from "zod"

const CreateProcedureSchema = z.object({
  patientId: z.string().uuid(),
  procedureName: z.string().min(1),
  procedureType: z.string().min(1).optional(),
  status: z.enum(["ordered", "completed"]).default("ordered"),
  procedureDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  procedureTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  performedBy: z.string().optional(),
  reasonIndication: z.string().optional(),
  findings: z.string().optional(),
  procedureNotes: z.string().optional(),
  outcome: z.string().optional(),
  followUpInstructions: z.string().optional(),
  isOtherProcedure: z.boolean().optional(),
  otherProcedureName: z.string().optional(),
  notes: z.string().optional(),
})

const CompleteProcedureSchema = z.object({
  procedureId: z.string().uuid(),
  procedureDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  procedureTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  performedBy: z.string().trim().max(200).optional(),
  reasonIndication: z.string().trim().max(2000).optional(),
  findings: z.string().trim().max(5000).optional(),
  procedureNotes: z.string().trim().max(5000).optional(),
  outcome: z.string().trim().max(2000).optional(),
  followUpInstructions: z.string().trim().max(2000).optional(),
})

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (!can(payload.role, "medical", "create")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await req.json()
    
    // Check if this is a completion request
    if (body.procedureId) {
      const data = CompleteProcedureSchema.parse(body)
      
      const datePart = data.procedureDate || new Date().toISOString().slice(0, 10)
      const timePart = data.procedureTime || new Date().toTimeString().slice(0, 5)
      const performedAt = new Date(`${datePart}T${timePart}:00`)
      if (Number.isNaN(performedAt.getTime())) {
        return NextResponse.json({ error: "Invalid procedure date or time" }, { status: 400 })
      }

      const result = await queryWithSession<{ id: string }>(
        { role: payload.role, userId: payload.userId },
        `UPDATE procedures 
         SET status = 'completed',
             completed_at = now(),
             completed_by = $1,
             performed_at = $2,
             performed_by_name = COALESCE(NULLIF($3, ''), (SELECT name FROM users WHERE id = $1)),
             reason_indication = COALESCE(NULLIF($4, ''), reason_indication),
             findings = COALESCE(NULLIF($5, ''), findings),
             procedure_notes = COALESCE(NULLIF($6, ''), procedure_notes),
             notes = COALESCE(NULLIF($6, ''), notes),
             outcome = COALESCE(NULLIF($7, ''), outcome),
             follow_up_instructions = COALESCE(NULLIF($8, ''), follow_up_instructions)
         WHERE id = $9 AND status IN ('ordered', 'in_progress')
         RETURNING id`,
        [
          payload.sub,
          performedAt.toISOString(),
          data.performedBy || null,
          data.reasonIndication || null,
          data.findings || null,
          data.procedureNotes || null,
          data.outcome || null,
          data.followUpInstructions || null,
          data.procedureId,
        ],
      )
      if (!result.rows[0]) {
        return NextResponse.json({ error: "Procedure order not found or already completed" }, { status: 409 })
      }

      return NextResponse.json({ success: true, id: result.rows[0].id })
    }

    // Create new procedure order
    const data = CreateProcedureSchema.parse(body)
    
    if (!can(payload.role, "medical", "create")) {
      return NextResponse.json({ 
        error: "Only authorized healthcare workers can record procedures"
      }, { status: 403 })
    }

    const normalizedProcedureName = data.procedureName.trim()
    const normalizedOtherProcedureName = (data.otherProcedureName || "").trim() || null
    const isOtherProcedure = data.isOtherProcedure === true || normalizedProcedureName.toLowerCase() === "other"
    const procedureName = isOtherProcedure
      ? normalizedOtherProcedureName || normalizedProcedureName
      : normalizedProcedureName

    if (isOtherProcedure && !normalizedOtherProcedureName) {
      return NextResponse.json({ error: "otherProcedureName is required when selecting Other Procedure" }, { status: 400 })
    }

    const procedureType = (data.procedureType || "Clinical Procedure").trim() || "Clinical Procedure"
    const performedBy = (data.performedBy || "").trim() || null
    const reasonIndication = (data.reasonIndication || "").trim() || null
    const findings = (data.findings || "").trim() || null
    const procedureNotes = (data.procedureNotes || data.notes || "").trim() || null
    const outcome = (data.outcome || "").trim() || null
    const followUpInstructions = (data.followUpInstructions || "").trim() || null
    const procedureDate = (data.procedureDate || "").trim() || null
    const procedureTime = (data.procedureTime || "").trim() || null
    const status = data.status

    let performedAt: string | null = null
    if (procedureDate || procedureTime) {
      const datePart = procedureDate || new Date().toISOString().slice(0, 10)
      const timePart = procedureTime || "00:00"
      const candidate = new Date(`${datePart}T${timePart}:00`)
      if (!Number.isNaN(candidate.getTime())) {
        performedAt = candidate.toISOString()
      }
    }

    const result = await queryWithSession<{ id: string }>(
      { role: payload.role, userId: payload.userId },
      `INSERT INTO procedures (
          patient_id,
          ordered_by,
          procedure_name,
          procedure_type,
          notes,
          performed_at,
          performed_by_name,
          reason_indication,
          findings,
          procedure_notes,
          outcome,
          follow_up_instructions,
          is_other_procedure,
          other_procedure_name,
          status,
          completed_at,
          completed_by
       )
       VALUES ($1, $2, $3, $4, $5, CASE WHEN $15 = 'completed' THEN COALESCE($6, now()) ELSE $6 END, $7, $8, $9, $10, $11, $12, $13, $14, $15, CASE WHEN $15 = 'completed' THEN now() END, CASE WHEN $15 = 'completed' THEN $16::uuid END)
       RETURNING id`,
      [
        data.patientId,
        payload.sub,
        procedureName,
        procedureType,
        procedureNotes,
        performedAt,
        performedBy,
        reasonIndication,
        findings,
        procedureNotes,
        outcome,
        followUpInstructions,
        isOtherProcedure,
        normalizedOtherProcedureName,
        status,
        payload.sub,
      ],
    )

    return NextResponse.json({ id: result.rows[0].id, success: true })
  } catch (error: any) {
    if (error?.name === 'ZodError') {
      return NextResponse.json({ error: 'Validation error', details: error.issues }, { status: 400 })
    }
    console.error('[procedures] POST error:', error)
    return NextResponse.json({ error: 'Failed to process procedure' }, { status: 500 })
  }
}

export async function GET(req: Request) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const url = new URL(req.url)
    const patientId = url.searchParams.get('patientId')

    if (!patientId) {
      return NextResponse.json({ error: 'Patient ID required' }, { status: 400 })
    }

    const result = await queryWithSession<any>(
      { role: payload.role, userId: payload.userId },
      `SELECT p.*,
              COALESCE(p.performed_at::date::text, p.ordered_at::date::text) AS procedure_date,
              COALESCE(to_char(p.performed_at, 'HH24:MI'), to_char(p.ordered_at, 'HH24:MI')) AS procedure_time,
              COALESCE(p.performed_by_name, u2.name, u1.name) AS performer_name,
              COALESCE(p.procedure_notes, p.notes) AS procedure_notes,
              u1.name as ordered_by_name,
              u2.name as completed_by_name
       FROM procedures p
       LEFT JOIN users u1 ON p.ordered_by = u1.id
       LEFT JOIN users u2 ON p.completed_by = u2.id
       WHERE p.patient_id = $1
       ORDER BY p.ordered_at DESC`,
      [patientId],
    )

    return NextResponse.json({ procedures: result.rows })
  } catch (error: any) {
    console.error('[procedures] GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch procedures' }, { status: 500 })
  }
}
