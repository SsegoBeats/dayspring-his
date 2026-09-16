// OpenMRS adapter mapping utilities (basic, extendable)

export function normalizeOpenMrsGender(value: string | null | undefined) {
  if (!value) return 'U'
  const normalized = String(value).toLowerCase()
  if (['m', 'male'].includes(normalized)) return 'M'
  if (['f', 'female'].includes(normalized)) return 'F'
  return 'U'
}

export function mapPatientToOpenMRS(local: any) {
  // Map local patient model to a simplified OpenMRS patient payload
  const name = local.name || {}
  const firstName = local.firstName || local.givenName || name.given || ''
  const lastName = local.lastName || local.familyName || name.family || ''

  return {
    resourceType: 'Patient',
    uuid: local.id,
    person: {
      names: [
        {
          givenName: firstName,
          familyName: lastName,
        },
      ],
      gender: normalizeOpenMrsGender(local.gender),
      birthdate: local.birthdate || local.birthDate,
      attributes: local.attributes || [],
    },
    identifiers: local.identifiers || [],
  }
}

export function mapOpenMRSToPatient(openmrs: any) {
  // Map a simplified OpenMRS patient payload into local patient model
  const person = openmrs.person || openmrs
  const name = (person.names && person.names[0]) || {}
  return {
    id: openmrs.uuid || openmrs.id || null,
    firstName: name.givenName || name.given || null,
    lastName: name.familyName || name.family || null,
    gender: normalizeOpenMrsGender(person.gender || openmrs.gender || null),
    birthDate: person.birthdate || openmrs.birthdate || null,
    identifiers: openmrs.identifiers || [],
  }
}

export function mapObservationToOpenMrsConcept(observation: any) {
  if (!observation) return null

  return {
    concept: observation.concept || observation.code || 'OBSERVATION',
    value: observation.value ?? observation.valueQuantity?.value ?? null,
    patientUuid: observation.patientId || observation.patientUuid || null,
    encounterUuid: observation.encounterId || observation.encounterUuid || null,
    observedAt: observation.recordedAt || observation.observedAt || new Date().toISOString(),
  }
}

export function buildOpenMrsEncounter(encounter: any) {
  return {
    resourceType: 'Encounter',
    uuid: encounter?.id || encounter?.uuid || null,
    patient: encounter?.patientId || encounter?.patientUuid || null,
    encounterType: encounter?.encounterType || 'OUTPATIENT',
    encounterDatetime: encounter?.encounterDate || encounter?.recordedAt || new Date().toISOString(),
    provider: encounter?.providerId || encounter?.providerUuid || null,
    location: encounter?.location || encounter?.facilityId || null,
  }
}
