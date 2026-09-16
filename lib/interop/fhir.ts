export function buildPatientResource(localPatient: any) {
  // Minimal FHIR Patient mapping (expand as needed)
  return {
    resourceType: 'Patient',
    identifier: localPatient.identifiers?.map((id: any) => ({ system: id.system, value: id.value })) || [],
    name: [{ family: localPatient.lastName || localPatient.familyName, given: [localPatient.firstName || localPatient.givenName] }],
    gender: localPatient.sex || localPatient.gender || 'unknown',
    birthDate: localPatient.birthDate || localPatient.dob,
    address: localPatient.address ? [{ text: localPatient.address }] : undefined,
    telecom: localPatient.phone ? [{ system: 'phone', value: localPatient.phone, use: 'mobile' }] : undefined,
  }
}

export async function pushResource(type: string, resource: any) {
  const base = process.env.FHIR_BASE_URL
  const token = process.env.FHIR_BEARER_TOKEN
  if (!base) throw new Error('FHIR_BASE_URL not configured')

  const url = `${base.replace(/\/$/, '')}/${type}`
  const headers: Record<string,string> = { 'Content-Type': 'application/fhir+json' }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(resource) })
  const text = await res.text()
  if (!res.ok) throw new Error(`FHIR push failed (${res.status}): ${text}`)
  try { return JSON.parse(text) } catch { return text }
}
