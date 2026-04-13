import { NextResponse } from "next/server"
import { query } from "@/lib/db"
import { verifyToken } from "@/lib/security"

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

    // Get referrals directed to this user (internal referrals only)
    const result = await query<any>(
      `SELECT r.*, 
              u.name as referring_user_name,
              p.first_name || ' ' || p.last_name as patient_name,
              p.patient_number
       FROM referrals r
       INNER JOIN users u ON r.referring_user_id = u.id
       INNER JOIN patients p ON r.patient_id = p.id
       WHERE r.receiving_user_id = $1 AND r.type = 'internal'
       ORDER BY r.created_at DESC`,
      [payload.sub]
    )

    return NextResponse.json({ referrals: result.rows })
  } catch (error: any) {
    console.error('[referrals/incoming] GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch incoming referrals' }, { status: 500 })
  }
}
