export type UgandaHmisSnapshot = {
  facilityId?: string
  period: string
  metrics: Record<string, number>
}

export const UGANDA_HMIS_INDICATORS = [
  { code: 'outpatientVisits', label: 'Outpatient visits', source: 'DHIS2' },
  { code: 'emergencyVisits', label: 'Emergency visits', source: 'DHIS2' },
  { code: 'deliveries', label: 'Deliveries', source: 'DHIS2' },
  { code: 'antenatalVisits', label: 'ANC visits', source: 'OpenMRS' },
  { code: 'malariaCases', label: 'Malaria cases', source: 'FHIR' },
  { code: 'hivTests', label: 'HIV tests', source: 'OpenMRS' },
  { code: 'tbCases', label: 'TB cases', source: 'FHIR' },
  { code: 'referrals', label: 'Referrals', source: 'OpenMRS' },
  { code: 'facilityAdmissions', label: 'Admissions', source: 'FHIR' },
] as const

const DHIS2_MAPPING: Record<string, string> = {
  outpatientVisits: 'DE_OPD_VISITS',
  emergencyVisits: 'DE_EMERGENCY_VISITS',
  deliveries: 'DE_DELIVERIES',
  malariaCases: 'DE_MALARIA_CASES',
  tbCases: 'DE_TB_CASES',
  facilityAdmissions: 'DE_ADMISSIONS',
  referrals: 'DE_REFERRALS',
}

export function buildUgandaHmisSnapshot(input: Record<string, any> = {}): UgandaHmisSnapshot {
  const period = input.period || new Date().toISOString().slice(0, 7)
  const facilityId = input.facilityId || 'facility-001'

  const metrics: Record<string, number> = {
    outpatientVisits: Number(input.outpatientVisits ?? input.opdVisits ?? 0),
    emergencyVisits: Number(input.emergencyVisits ?? 0),
    deliveries: Number(input.deliveries ?? input.deliveryCount ?? 0),
    antenatalVisits: Number(input.antenatalVisits ?? 0),
    malariaCases: Number(input.malariaCases ?? 0),
    hivTests: Number(input.hivTests ?? 0),
    tbCases: Number(input.tbCases ?? 0),
    referrals: Number(input.referrals ?? 0),
    facilityAdmissions: Number(input.facilityAdmissions ?? 0),
  }

  return { facilityId, period, metrics }
}

export function buildDhis2HmisDataValueSet(snapshot: UgandaHmisSnapshot, orgUnit?: string) {
  const dataValues = Object.entries(snapshot.metrics)
    .filter(([key]) => DHIS2_MAPPING[key])
    .map(([key, value]) => ({ dataElement: DHIS2_MAPPING[key], value: Number(value) || 0 }))

  return {
    orgUnit: orgUnit || snapshot.facilityId || 'facility-001',
    period: snapshot.period,
    dataValues,
  }
}

export function buildFhirHmisBundle(snapshot: UgandaHmisSnapshot, facilityId?: string) {
  const entries = Object.entries(snapshot.metrics).map(([key, value]) => ({
    resource: {
      resourceType: 'Observation',
      status: 'final',
      code: { text: key },
      subject: { reference: `Location/${facilityId || snapshot.facilityId || 'facility-001'}` },
      effectiveDateTime: `${snapshot.period}-01`,
      valueQuantity: { value: Number(value) || 0, unit: 'count' },
    },
  }))

  return {
    resourceType: 'Bundle',
    type: 'collection',
    entry: entries,
  }
}

export function buildOpenmrsHmisPayload(snapshot: UgandaHmisSnapshot, facilityId?: string) {
  return {
    facilityId: facilityId || snapshot.facilityId || 'facility-001',
    period: snapshot.period,
    values: Object.entries(snapshot.metrics).map(([key, value]) => ({
      concept: `UGANDA_HMIS_${key.toUpperCase()}`,
      value: Number(value) || 0,
    })),
  }
}
