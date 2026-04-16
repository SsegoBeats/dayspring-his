import { NextResponse } from "next/server"
import { query } from "@/lib/db"
import { verifyToken } from "@/lib/security"
import { z } from "zod"

const AdministerDoseSchema = z.object({
  prescriptionId: z.string().uuid(),
  doseGiven: z.string().min(1),
  route: z.string().optional(),
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
    if (!payload || payload.role !== 'Nurse') {
      return NextResponse.json({ 
        error: "Only Nurses can record medication administration" 
      }, { status: 403 })
    }

    const body = await req.json()
    const data = AdministerDoseSchema.parse(body)

    const result = await query<{ id: string }>(
      `INSERT INTO prescription_administrations (
        prescription_id, administered_by, dose_given, route, notes
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING id`,
      [
        data.prescriptionId,
        payload.sub,
        data.doseGiven,
        data.route || null,
        data.notes || null,
      ]
    )

    return NextResponse.json({ id: result.rows[0].id, success: true })
  } catch (error: any) {
    if (error?.name === 'ZodError') {
      return NextResponse.json({ error: 'Validation error', details: error.issues }, { status: 400 })
    }
    console.error('[prescription-administrations] POST error:', error)
    return NextResponse.json({ error: 'Failed to record administration' }, { status: 500 })
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
    const searchParams = url.searchParams
    const prescriptionId = searchParams.get('prescriptionId')

    const patientId = searchParams.get("patientId")
    if (patientId) {
      const result = await query<{
        id: string; prescription_id: string; administered_at: string
        dose_given: string; route: string | null; notes: string | null
        nurse_name: string | null
      }>(
        `SELECT pa.id, pa.prescription_id, pa.administered_at, pa.dose_given, pa.route, pa.notes,
                u.name AS nurse_name
         FROM prescription_administrations pa
         LEFT JOIN users u ON u.id = pa.administered_by
         WHERE pa.prescription_id IN (
           SELECT id FROM prescriptions WHERE patient_id = $1
         )
         ORDER BY pa.administered_at DESC`,
        [patientId]
      )
      return NextResponse.json({ administrations: result.rows })
    }

    if (!prescriptionId) {
      return NextResponse.json({ error: 'Prescription ID required' }, { status: 400 })
    }

    const result = await query<any>(
      `SELECT pa.*, u.name as nurse_name
       FROM prescription_administrations pa
       LEFT JOIN users u ON pa.administered_by = u.id
       WHERE pa.prescription_id = $1
       ORDER BY pa.administered_at DESC`,
      [prescriptionId]
    )

    return NextResponse.json({ administrations: result.rows })
  } catch (error: any) {
    console.error('[prescription-administrations] GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch administrations' }, { status: 500 })
  }
}
