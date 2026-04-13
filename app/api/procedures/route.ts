import { NextResponse } from "next/server"
import { query } from "@/lib/db"
import { verifyToken } from "@/lib/security"
import { z } from "zod"

const CreateProcedureSchema = z.object({
  patientId: z.string().uuid(),
  procedureName: z.string().min(1),
  procedureType: z.string().min(1),
  notes: z.string().optional(),
})

const CompleteProcedureSchema = z.object({
  procedureId: z.string().uuid(),
  notes: z.string().optional(),
})

export async function POST(req: Request) {
  try {
    const token = req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1] || 
                  req.headers.get("cookie")?.match(/session_dev=([^;]+)/)?.[1]
    
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    
    // Check if this is a completion request
    if (body.procedureId) {
      const data = CompleteProcedureSchema.parse(body)
      
      if (payload.role !== 'Nurse') {
        return NextResponse.json({ 
          error: "Only Nurses can mark procedures as completed" 
        }, { status: 403 })
      }

      await query(
        `UPDATE procedures 
         SET status = 'completed', completed_at = now(), completed_by = $1, notes = COALESCE($2, notes)
         WHERE id = $3`,
        [payload.sub, data.notes || null, data.procedureId]
      )

      return NextResponse.json({ success: true })
    }

    // Create new procedure order
    const data = CreateProcedureSchema.parse(body)
    
    if (!['Clinician', 'Hospital Admin'].includes(payload.role)) {
      return NextResponse.json({ 
        error: "Only Clinicians and Admins can order procedures" 
      }, { status: 403 })
    }

    const result = await query<{ id: string }>(
      `INSERT INTO procedures (patient_id, ordered_by, procedure_name, procedure_type, notes)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [data.patientId, payload.sub, data.procedureName, data.procedureType, data.notes || null]
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
    const token = req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1] || 
                  req.headers.get("cookie")?.match(/session_dev=([^;]+)/)?.[1]
    
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

    const result = await query<any>(
      `SELECT p.*, 
              u1.name as ordered_by_name,
              u2.name as completed_by_name
       FROM procedures p
       LEFT JOIN users u1 ON p.ordered_by = u1.id
       LEFT JOIN users u2 ON p.completed_by = u2.id
       WHERE p.patient_id = $1
       ORDER BY p.ordered_at DESC`,
      [patientId]
    )

    return NextResponse.json({ procedures: result.rows })
  } catch (error: any) {
    console.error('[procedures] GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch procedures' }, { status: 500 })
  }
}
