// DHIS2 adapter utilities: build DataValueSet and POST helper

export type Dhis2Payload = {
  orgUnit: string
  period: string
  dataSet?: string
  dataValues: Array<{ dataElement: string; value: number | string | boolean | null; categoryOptionCombo?: string; comment?: string }>
}

export function normalizeDhis2Value(value: any) {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return null
    const maybeNumber = Number(trimmed)
    return Number.isFinite(maybeNumber) ? maybeNumber : trimmed
  }
  if (typeof value === 'boolean') return value
  return String(value)
}

export function buildDataValueSet({ orgUnit, period, data, dataSet = 'TODO_DATASET_ID' }: { orgUnit: string; period: string; data: Array<any>; dataSet?: string }): Dhis2Payload {
  const dataValues = (data || [])
    .map((entry) => {
      const dataElement = entry?.dataElement || entry?.dataelement || entry?.key
      if (!dataElement) return null
      const normalizedValue = normalizeDhis2Value(entry?.value)
      if (normalizedValue === null) return null

      return {
        dataElement,
        value: normalizedValue,
        ...(entry?.categoryOptionCombo ? { categoryOptionCombo: entry.categoryOptionCombo } : {}),
        ...(entry?.comment ? { comment: entry.comment } : {}),
      }
    })
    .filter(Boolean)

  return {
    dataSet,
    period,
    orgUnit,
    dataValues,
  }
}

export function mapResourceToDataValues(resourceType: string, resource: any, facilityId?: string, overrides: Record<string, string> = {}) {
  const payload = resource || {}
  const candidateMap = {
    Patient: [
      ['weight', overrides.weight || 'hP8Nw8b8'],
      ['visitCount', overrides.visitCount || 'xYz123'],
    ],
    Encounter: [
      ['visitType', overrides.visitType || 'eVt001'],
    ],
    LabResult: [
      ['hemoglobin', overrides.hemoglobin || 'lbHgb001'],
    ],
  } as Record<string, Array<[string, string]>>

  const rows = candidateMap[resourceType] || []
  const data = rows
    .map(([field, dataElement]) => {
      const value = payload[field]
      if (value === undefined || value === null) return null
      return { dataElement, value: normalizeDhis2Value(value), facilityId }
    })
    .filter(Boolean)

  return data
}

export async function postToDhis2(baseUrl: string, token: string, dataValueSet: any, options: { dryRun?: boolean; maxRetries?: number } = {}) {
  const dryRun = !!options.dryRun
  if (dryRun) {
    return {
      ok: true,
      dryRun: true,
      status: 200,
      data: dataValueSet,
    }
  }

  if (!baseUrl) {
    throw new Error('DHIS2 baseUrl is required unless dryRun is true')
  }

  const url = `${baseUrl.replace(/\/+$/, '')}/api/dataValueSets`
  const maxRetries = Math.max(1, options.maxRetries ?? 2)

  let lastResponse: Response | null = null
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(dataValueSet),
    })
    lastResponse = response

    if (response.ok || response.status === 409 || response.status === 412) {
      return response
    }

    if (attempt < maxRetries) {
      await new Promise((resolve) => setTimeout(resolve, 200 * attempt))
    }
  }

  return lastResponse
}
