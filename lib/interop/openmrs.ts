export function buildPersonPayload(local: any) {
  const person: {
    names: Array<{ givenName: string; familyName: string }>
    gender: string
    birthdate: string | undefined
    addresses: Array<{ address1: string }>
    attributes: unknown[]
    identifiers?: Array<{ identifier: string; identifierType: string }>
  } = {
    names: [{ givenName: local.firstName || local.givenName, familyName: local.lastName || local.familyName }],
    gender: local.sex || local.gender || 'U',
    birthdate: local.dob || local.birthDate,
    addresses: local.address ? [{ address1: local.address }] : [],
    attributes: [],
  }
  if (local.identifiers) {
    person['identifiers'] = local.identifiers.map((id: any) => ({ identifier: id.value, identifierType: id.type || 'UNKNOWN' }))
  }
  return { person }
}

export async function pushOpenmrsPerson(payload: any) {
  const base = process.env.OPENMRS_BASE_URL
  const user = process.env.OPENMRS_USERNAME
  const pass = process.env.OPENMRS_PASSWORD
  if (!base) throw new Error('OPENMRS_BASE_URL not configured')

  const url = `${base.replace(/\/$/, '')}/ws/rest/v1/person`
  const headers: Record<string,string> = { 'Content-Type': 'application/json' }
  if (user && pass) headers['Authorization'] = `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`

  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(payload) })
  const text = await res.text()
  if (!res.ok) throw new Error(`OpenMRS push failed (${res.status}): ${text}`)
  try { return JSON.parse(text) } catch { return text }
}
