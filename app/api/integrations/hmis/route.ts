import { NextResponse } from 'next/server'
import { buildDhis2HmisDataValueSet, buildFhirHmisBundle, buildOpenmrsHmisPayload, buildUgandaHmisSnapshot } from '@/lib/uganda-hmis'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    if (!body) {
      return NextResponse.json({ error: 'Invalid payload: expect Uganda HMIS metrics' }, { status: 400 })
    }

    const facilityId = body.facilityId || body.facility_id || 'facility-001'
    const period = body.period || new Date().toISOString().slice(0, 7)
    const snapshot = buildUgandaHmisSnapshot({
      facilityId,
      period,
      ...body.metrics,
      ...body,
    })

    const result = {
      snapshot,
      dhis2: buildDhis2HmisDataValueSet(snapshot, facilityId),
      fhir: buildFhirHmisBundle(snapshot, facilityId),
      openmrs: buildOpenmrsHmisPayload(snapshot, facilityId),
    }

    return NextResponse.json({ ok: true, result })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    info: 'Uganda HMIS integration endpoint. POST a facilityId + period + metrics payload to build DHIS2/FHIR/OpenMRS structures.',
  })
}
