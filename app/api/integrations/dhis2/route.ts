import { NextResponse } from 'next/server'
import { buildDataValueSet, pushDataValueSet, mapResourceToDataValues } from '@/lib/interop/dhis2'
import { verifyToken } from '@/lib/security'

export async function POST(req: Request) {
  try {
    const auth = req.headers.get('authorization') || ''
    const token = auth.replace(/^Bearer\s+/i, '')
    const user = await verifyToken(token)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    // support two modes: direct DataValueSet or high-level resource mapping
    if (body && body.resourceType && body.resource) {
      const { resourceType, resource, period, orgUnit, dryRun, batchSize, maxRetries } = body
      if (!period || !orgUnit) return NextResponse.json({ error: 'Missing period or orgUnit' }, { status: 400 })
      const dataValues = mapResourceToDataValues(resourceType, resource, user.facilityId)
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
