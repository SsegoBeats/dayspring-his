import { NextResponse } from "next/server"
import { query } from "@/lib/db"
import { verifyToken } from "@/lib/security"
import { z } from "zod"

const UpdateReferralSchema = z.object({
  status: z.enum(['pending', 'accepted', 'completed', 'cancelled']).optional(),
  notes: z.string().optional(),
})

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
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
    const data = UpdateReferralSchema.parse(body)

    const updates: string[] = []
    const values: any[] = []
    let paramIndex = 1

    if (data.status) {
      updates.push(`status = $${paramIndex++}`)
      values.push(data.status)
    }
    if (data.notes !== undefined) {
      updates.push(`notes = $${paramIndex++}`)
      values.push(data.notes)
    }

    updates.push(`updated_at = now()`)
    values.push(params.id)

    if (updates.length === 1) {
      return NextResponse.json({ error: 'No updates provided' }, { status: 400 })
    }

    await query(
      `UPDATE referrals SET ${updates.join(', ')} WHERE id = $${paramIndex}`,
      values
    )

    return NextResponse.json({ success: true })
  } catch (error: any) {
    if (error?.name === 'ZodError') {
      return NextResponse.json({ error: 'Validation error', details: error.issues }, { status: 400 })
    }
    console.error('[referrals/:id] PATCH error:', error)
    return NextResponse.json({ error: 'Failed to update referral' }, { status: 500 })
  }
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
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

    const result = await query<any>(
      `SELECT r.*, 
              u1.name as referring_user_name,
              u2.name as receiving_user_name,
              p.first_name || ' ' || p.last_name as patient_name
       FROM referrals r
       LEFT JOIN users u1 ON r.referring_user_id = u1.id
       LEFT JOIN users u2 ON r.receiving_user_id = u2.id
       LEFT JOIN patients p ON r.patient_id = p.id
       WHERE r.id = $1`,
      [params.id]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Referral not found' }, { status: 404 })
    }

    return NextResponse.json({ referral: result.rows[0] })
  } catch (error: any) {
    console.error('[referrals/:id] GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch referral' }, { status: 500 })
  }
}
