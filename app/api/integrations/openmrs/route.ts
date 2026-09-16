import { NextResponse } from 'next/server'
import { buildPersonPayload, pushOpenmrsPerson } from '@/lib/interop/openmrs'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    if (!body || !body.person) {
      return NextResponse.json({ error: 'Invalid payload: expect { person }' }, { status: 400 })
    }

    const payload = buildPersonPayload(body.person)
    const result = await pushOpenmrsPerson(payload)
    return NextResponse.json({ ok: true, result })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, info: 'OpenMRS integration endpoint. POST { person } to create a Person.' })
}
