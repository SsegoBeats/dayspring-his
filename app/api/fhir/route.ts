import { NextResponse } from 'next/server'
import { mapToFHIRPatient, mapToFHIRObservation, capabilityStatement } from '../../../lib/fhir/mapper'

// Basic FHIR endpoint handler. This file implements a small but complete adapter
// surface: CapabilityStatement, Patient read/create, Observation create.

export async function GET(request: Request) {
  const url = new URL(request.url)
  const path = url.pathname.replace(/\/+$/, '')

  if (path.endsWith('/api/fhir/metadata') || path.endsWith('/api/fhir/CapabilityStatement')) {
    return NextResponse.json(capabilityStatement())
  }

  // Example: /api/fhir/Patient/:id
  const patientMatch = path.match(/\/api\/fhir\/Patient\/(.+)$/)
  if (patientMatch) {
    const id = patientMatch[1]
    // NOTE: Replace this stub with real DB lookup
    const localPatient = {
      id,
      givenName: 'Test',
      familyName: 'Patient',
      gender: 'male',
      birthDate: '1980-01-01',
      identifiers: [{ system: 'urn:uganda:facility', value: 'FAC-001' }],
    }
    const fhir = mapToFHIRPatient(localPatient)
    return NextResponse.json(fhir)
  }

  return new Response('Not Found', { status: 404 })
}

export async function POST(request: Request) {
  const url = new URL(request.url)
  const path = url.pathname.replace(/\/+$/, '')

  // Create/Receive FHIR Patient resource (server-side import)
  if (path.endsWith('/api/fhir/Patient')) {
    const body = await request.json()
    // Here we would map and upsert into local DB. For now, echo mapped resource.
    // A real implementation should validate the FHIR payload and persist.
    // Provide a simple server-side mapping from FHIR -> local model (not implemented).
    return NextResponse.json({ received: true, resource: body })
  }

  // Create Observation
  if (path.endsWith('/api/fhir/Observation')) {
    const body = await request.json()
    // Map or persist observation; stub returns created resource with server id
    const created = { ...body, id: `obs-${Date.now()}` }
    return NextResponse.json(created, { status: 201 })
  }

  return new Response('Not Found', { status: 404 })
}
