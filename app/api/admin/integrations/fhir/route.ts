import { NextResponse } from 'next/server'
import { z } from 'zod'
import { verifyToken } from '@/lib/security'
import { queryWithSession } from '@/lib/db'

const Mapping = z.object({ resourceType: z.string(), field: z.string(), fhirElement: z.string(), facilityId: z.string().optional() })

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get('authorization') || ''
    const token = authHeader.replace(/^Bearer\s+/i, '')
    const user = verifyToken(token)
    if (!user || (user.role !== 'Hospital Admin' && user.role !== 'admin')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { rows } = await queryWithSession({ role: user.role, userId: user.userId }, 'SELECT id, resource_type as "resourceType", field, fhir_element as "fhirElement", facility_id as "facilityId", created_at FROM fhir_mappings ORDER BY id DESC')
    return NextResponse.json({ ok: true, rows })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('authorization') || ''
    const token = authHeader.replace(/^Bearer\s+/i, '')
    const user = verifyToken(token)
    if (!user || (user.role !== 'Hospital Admin' && user.role !== 'admin')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await req.json()
    const parsed = Mapping.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

    const { resourceType, field, fhirElement, facilityId } = parsed.data
    const sql = 'INSERT INTO fhir_mappings (resource_type, field, fhir_element, facility_id) VALUES ($1,$2,$3,$4) RETURNING id, resource_type as "resourceType", field, fhir_element as "fhirElement", facility_id as "facilityId", created_at'
    const params = [resourceType, field, fhirElement, facilityId || null]
    const { rows } = await queryWithSession({ role: user.role, userId: user.userId }, sql, params)
    try {
      await queryWithSession({ role: user.role, userId: user.userId }, 'INSERT INTO integration_mapping_audit (mapping_table, mapping_id, action, payload, performed_by) VALUES ($1,$2,$3,$4,$5)', ['fhir_mappings', rows[0].id, 'create', JSON.stringify(rows[0]), user.userId])
    } catch (e) { }
    return NextResponse.json({ ok: true, mapping: rows[0] })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 })
  }
}

export async function PUT(req: Request) {
  return NextResponse.json({ error: 'PUT not implemented for FHIR mappings — use specific id route' }, { status: 400 })
}

export async function DELETE(req: Request) {
  return NextResponse.json({ error: 'DELETE not implemented for FHIR mappings — use specific id route' }, { status: 400 })
}
