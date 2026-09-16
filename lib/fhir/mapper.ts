// Lightweight mapper between local models and FHIR R4 resources.

export function capabilityStatement() {
  return {
    resourceType: 'CapabilityStatement',
    status: 'active',
    date: new Date().toISOString(),
    kind: 'instance',
    software: { name: 'Dayspring-HIS', version: '0.1.0' },
    format: ['json'],
    rest: [
      {
        mode: 'server',
        resource: [
          { type: 'Patient', interaction: [{ code: 'read' }, { code: 'create' }] },
          { type: 'Observation', interaction: [{ code: 'create' }] },
        ],
      },
    ],
  }
}

export function mapToFHIRPatient(local: any) {
  return {
    resourceType: 'Patient',
    id: local.id,
    identifier: local.identifiers || [],
    name: [
      {
        family: local.familyName || local.lastName,
        given: [local.givenName || local.firstName],
      },
    ],
    gender: local.gender,
    birthDate: local.birthDate,
  }
}

export function mapToFHIRObservation(local: any) {
  return {
    resourceType: 'Observation',
    id: local.id,
    status: local.status || 'final',
    category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: 'vital-signs' }] }],
    code: local.code || { text: local.display || 'vital' },
    subject: { reference: `Patient/${local.patientId}` },
    effectiveDateTime: local.recordedAt || new Date().toISOString(),
    valueQuantity: local.value ? { value: local.value, unit: local.unit } : undefined,
  }
}
