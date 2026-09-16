import { NextResponse } from 'next/server'
import { z } from 'zod'
import { verifyToken } from '@/lib/security'
import { queryWithSession } from '@/lib/db'

const UpdateMapping = z.object({ resourceType: z.string().optional(), field: z.string().optional(), dataElement: z.string().optional(), facilityId: z.union([z.string(), z.null()]).optional() })

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const authHeader = req.headers.get('authorization') || ''
    const token = authHeader.replace(/^Bearer\s+/i, '')
    const user = verifyToken(token)
    if (!user || (user.role !== 'Hospital Admin' && user.role !== 'admin')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await req.json()
    const parsed = UpdateMapping.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

    const cols: string[] = []
    const vals: any[] = []
    let idx = 1
    if (parsed.data.resourceType) { cols.push(`resource_type = $${idx++}`); vals.push(parsed.data.resourceType) }
    if (parsed.data.field) { cols.push(`field = $${idx++}`); vals.push(parsed.data.field) }
    if (parsed.data.dataElement) { cols.push(`data_element = $${idx++}`); vals.push(parsed.data.dataElement) }
    if (parsed.data.facilityId !== undefined) { cols.push(`facility_id = $${idx++}`); vals.push(parsed.data.facilityId) }
    if (cols.length === 0) return NextResponse.json({ error: 'No fields to update' }, { status: 400 })

    const sql = `UPDATE dhis2_mappings SET ${cols.join(', ')} WHERE id = $${idx} RETURNING id, resource_type as "resourceType", field, data_element as "dataElement", facility_id as "facilityId", created_at`
    vals.push(params.id)
    const { rows } = await queryWithSession({ role: user.role, userId: user.userId }, sql, vals)
    if (!rows || rows.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    try {
      await queryWithSession({ role: user.role, userId: user.userId }, 'INSERT INTO integration_mapping_audit (mapping_table, mapping_id, action, payload, performed_by) VALUES ($1,$2,$3,$4,$5)', ['dhis2_mappings', rows[0].id, 'update', JSON.stringify(rows[0]), user.userId])
    } catch (e) {}
    return NextResponse.json({ ok: true, mapping: rows[0] })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const authHeader = req.headers.get('authorization') || ''
    const token = authHeader.replace(/^Bearer\s+/i, '')
    const user = verifyToken(token)
    if (!user || (user.role !== 'Hospital Admin' && user.role !== 'admin')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const sql = 'DELETE FROM dhis2_mappings WHERE id = $1 RETURNING id'
    const { rows } = await queryWithSession({ role: user.role, userId: user.userId }, sql, [params.id])
    if (!rows || rows.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    try {
      await queryWithSession({ role: user.role, userId: user.userId }, 'INSERT INTO integration_mapping_audit (mapping_table, mapping_id, action, payload, performed_by) VALUES ($1,$2,$3,$4,$5)', ['dhis2_mappings', params.id, 'delete', null, user.userId])
    } catch (e) {}
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 })
  }
}
