import { NextResponse } from 'next/server'
import { mapPatientToOpenMRS, mapOpenMRSToPatient } from '../../../lib/openmrs/adapter'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const path = url.pathname.replace(/\/+$/, '')

  const patientMatch = path.match(/\/api\/openmrs\/patient\/(.+)$/i)
  if (patientMatch) {
    const id = patientMatch[1]
    // TODO: replace with real DB read
    const localPatient = {
      id,
      firstName: 'Test',
      lastName: 'Patient',
      gender: 'M',
      birthdate: '1980-01-01',
      identifiers: [{ identifier: 'P-001', identifierType: 'NationalID' }],
    }
    const omrs = mapPatientToOpenMRS(localPatient)
    return NextResponse.json(omrs)
  }

  return new Response('Not Found', { status: 404 })
}

export async function POST(request: Request) {
  // Accept OpenMRS-style patient JSON and map into local model (upsert)
  const body = await request.json()
  const local = mapOpenMRSToPatient(body)
  // TODO: persist local patient to DB
  return NextResponse.json({ upserted: true, local })
}
