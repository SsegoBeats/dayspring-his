import { NextResponse } from 'next/server'
import { buildDataValueSet, postToDhis2 } from '../../../lib/dhis2/adapter'

export async function POST(request: Request) {
  const body = await request.json()
  // Expect body: { orgUnit, period, data: [{ dataElement, value }] , pushToDhis?: boolean }
  const { orgUnit, period, data, pushToDhis } = body
  if (!orgUnit || !period || !Array.isArray(data)) {
    return new Response('Invalid payload', { status: 400 })
  }

  const dvs = buildDataValueSet({ orgUnit, period, data })

  if (pushToDhis) {
    const dhisUrl = process.env.DHIS2_URL
    const dhisToken = process.env.DHIS2_TOKEN
    if (!dhisUrl || !dhisToken) {
      return new Response('DHIS2 credentials not configured', { status: 500 })
    }
    const res = await postToDhis2(dhisUrl, dhisToken, dvs)
    return NextResponse.json({ pushed: true, status: res.status })
  }

  return NextResponse.json({ dataValueSet: dvs })
}
