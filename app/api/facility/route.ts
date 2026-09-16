import { NextResponse } from 'next/server'
import { getFacilityById, listFacilities, createFacility } from '../../../lib/facility/model'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const path = url.pathname.replace(/\/+$/, '')
  const idMatch = path.match(/\/api\/facility\/(.+)$/)
  if (idMatch) {
    const id = idMatch[1]
    const f = await getFacilityById(id)
    if (!f) return new Response('Not Found', { status: 404 })
    return NextResponse.json(f)
  }

  const list = await listFacilities()
  return NextResponse.json(list)
}

export async function POST(request: Request) {
  const body = await request.json()
  const created = await createFacility(body)
  return NextResponse.json(created, { status: 201 })
}
