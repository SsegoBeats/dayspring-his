// Simple DB helpers (stubs) for facility/ward model. Replace with real DB access.

export async function getFacilityById(id: string) {
  // TODO: implement real DB query using pg client or ORM
  return { id, name: 'Demo Facility', code: 'FAC-001' }
}

export async function listFacilities() {
  return [{ id: 'fac-1', name: 'Demo Facility', code: 'FAC-001' }]
}

export async function createFacility(payload: any) {
  // persist to DB and return created row
  return { id: 'fac-' + Date.now(), ...payload }
}
