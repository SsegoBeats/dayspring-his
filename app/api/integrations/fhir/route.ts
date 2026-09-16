import { NextResponse } from 'next/server'
import { buildPatientResource, pushResource } from '@/lib/interop/fhir'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    if (!body || !body.patient) {
      return NextResponse.json({ error: 'Invalid payload: expect { patient }' }, { status: 400 })
    }

    const patient = buildPatientResource(body.patient)
    const result = await pushResource('Patient', patient)
    return NextResponse.json({ ok: true, result })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, info: 'FHIR integration endpoint. POST { patient } to create a Patient resource.' })
}
