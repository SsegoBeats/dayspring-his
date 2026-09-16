import { NextResponse } from 'next/server'
import { verifyToken } from '@/lib/security'
import { queryWithSession } from '@/lib/db'

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get('authorization') || ''
    const token = authHeader.replace(/^Bearer\s+/i, '')
    const user = verifyToken(token)
    if (!user || (user.role !== 'Hospital Admin' && user.role !== 'admin')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { rows } = await queryWithSession(
      { role: user.role, userId: user.userId },
      'SELECT id, mapping_table as "mappingTable", mapping_id as "mappingId", action, payload, performed_by as "performedBy", performed_at as "performedAt" FROM integration_mapping_audit ORDER BY performed_at DESC LIMIT 200'
    )

    return NextResponse.json({ ok: true, rows })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 })
  }
}
