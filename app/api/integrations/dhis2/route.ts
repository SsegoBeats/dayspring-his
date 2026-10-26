import { NextResponse } from 'next/server'
import { buildDataValueSet, pushDataValueSet, mapResourceToDataValues } from '@/lib/interop/dhis2'
import { verifyRequestToken } from '@/lib/security'
import { queryWithSession } from '@/lib/db'

export async function POST(req: Request) {
  try {
    const user = verifyRequestToken(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    // support two modes: direct DataValueSet or high-level resource mapping
    if (body && body.resourceType && body.resource) {
      const { resourceType, resource, period, orgUnit, dryRun, batchSize, maxRetries } = body
      if (!period || !orgUnit) return NextResponse.json({ error: 'Missing period or orgUnit' }, { status: 400 })
      const { rows } = await queryWithSession<{ facility_id: string | null }>(
        { role: user.role, userId: user.userId },
        'SELECT facility_id FROM users WHERE id = $1',
        [user.userId],
      )
      const dataValues = await mapResourceToDataValues(resourceType, resource, rows[0]?.facility_id ?? undefined)
      const dvs = buildDataValueSet(period, orgUnit, dataValues)
      const result = await pushDataValueSet(dvs, { dryRun: !!dryRun, batchSize: batchSize || undefined, maxRetries: maxRetries || undefined })
      return NextResponse.json({ ok: true, result })
    }

    const { period, orgUnit, dataValues } = body
    if (!period || !orgUnit || !Array.isArray(dataValues)) {
      return NextResponse.json({ error: 'Invalid payload: expect { period, orgUnit, dataValues[] }' }, { status: 400 })
    }

    const { batchSize, maxRetries, dryRun } = body
    const dvs = buildDataValueSet(period, orgUnit, dataValues)
    const result = await pushDataValueSet(dvs, { dryRun: !!dryRun, batchSize: batchSize || undefined, maxRetries: maxRetries || undefined })
    return NextResponse.json({ ok: true, result })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, info: 'DHIS2 integration endpoint. POST a DataValueSet payload to send.' })
}
