import { query } from "@/lib/db"

export type DataValue = { dataElement: string; value: number | string }

export function buildDataValueSet(period: string, orgUnit: string, dataValues: DataValue[]) {
  return {
    dataValues: dataValues.map(dv => ({ dataElement: dv.dataElement, value: String(dv.value) })),
    period,
    orgUnit,
  }
}

// Map higher-level resources (Patient, Encounter, LabResult) to DHIS2 data elements.
// This uses configuration in `process.env.DHIS2_MAPPING_JSON` or the `dhis2_mappings` table.
export async function mapResourceToDataValues(resourceType: string, resource: any, facilityId?: string): Promise<DataValue[]> {
  const raw = process.env.DHIS2_MAPPING_JSON || '{}'
  let cfg: Record<string, any> = {}
  try { cfg = JSON.parse(raw) } catch {
    // default empty
  }

  const mapForType = cfg[resourceType] || {}
  const out: DataValue[] = []

  // If DB-backed mappings are enabled, load them before building the payload.
  if (process.env.DHIS2_USE_DB === 'true' && process.env.DATABASE_URL) {
    const { rows } = await query<{ field: string; data_element: string }>(
      'SELECT field, data_element FROM dhis2_mappings WHERE resource_type = $1 AND (facility_id IS NULL OR facility_id = $2)',
      [resourceType, facilityId ?? null],
    )
    for (const row of rows) {
      const val = resource[row.field]
      if (val !== undefined && val !== null) out.push({ dataElement: String(row.data_element), value: val })
    }
  }

  // Example mappings: mapForType = { "weight": "DE_WEIGHT_ID", "visitCount": "DE_VISIT_ID" }
  for (const [key, de] of Object.entries(mapForType)) {
    const val = resource[key]
    if (val !== undefined && val !== null) out.push({ dataElement: String(de), value: val })
  }

  // Allow resource authors to pass a `dhis2DataValues` array directly
  if (Array.isArray(resource.dhis2DataValues)) {
    for (const dv of resource.dhis2DataValues) {
      if (dv.dataElement && dv.value !== undefined) out.push({ dataElement: dv.dataElement, value: dv.value })
    }
  }

  // Include facility-scoped data element if configured
  if (facilityId && cfg.__facilityMappings) {
    for (const fm of cfg.__facilityMappings) {
      // fm: { dataElement, facilityId, value }
      if (!fm.facilityId || fm.facilityId === facilityId) out.push({ dataElement: fm.dataElement, value: fm.value })
    }
  }

  return out
}

export async function pushDataValueSet(
  dvs: any,
  opts: { dryRun?: boolean; retries?: number; batchSize?: number; maxRetries?: number } = {},
) {
  const base = process.env.DHIS2_BASE_URL
  const user = process.env.DHIS2_USERNAME
  const pass = process.env.DHIS2_PASSWORD
  if (!base) throw new Error('DHIS2_BASE_URL not configured in environment')
  if (opts?.dryRun) return { dryRun: true, payload: dvs }

  const url = `${base.replace(/\/+$/, '')}/api/dataValueSets`
  const headers: any = { 'Content-Type': 'application/json' }
  if (user && pass) headers['Authorization'] = 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64')

    // Support batching large payloads into multiple POSTs to avoid server limits
    const batchSize = Math.max(1, opts.batchSize ?? 500)
    const maxRetries = Math.max(0, opts.maxRetries ?? opts.retries ?? 4)
    const batches: any[] = []
    for (let i = 0; i < dvs.dataValues.length; i += batchSize) {
      const slice = dvs.dataValues.slice(i, i + batchSize)
      batches.push({ ...dvs, dataValues: slice })
    }

    const results: any[] = []
    for (let b = 0; b < batches.length; b++) {
      const payload = batches[b]
      let attempt = 0
      let lastErr: any = null
      while (attempt <= maxRetries) {
        try {
          attempt++
          const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(payload) })
          const text = await res.text()
          if (res.ok) { results.push({ ok: true, status: res.status }); break }
          // Treat 409/412 as idempotent conflict; record and continue
          if (res.status === 409 || res.status === 412) { results.push({ ok: true, status: res.status, note: 'idempotent conflict' }); break }
          lastErr = new Error(`DHIS2 push failed (${res.status}): ${text}`)
          if (attempt > maxRetries) throw lastErr
          // exponential backoff with jitter
          const backoff = Math.min(30000, 500 * Math.pow(2, attempt))
          await new Promise(r => setTimeout(r, backoff + Math.floor(Math.random() * 200)))
        } catch (err) {
          lastErr = err
          if (attempt > maxRetries) throw err
          const backoff = Math.min(30000, 500 * Math.pow(2, attempt))
          await new Promise(r => setTimeout(r, backoff + Math.floor(Math.random() * 200)))
        }
      }
    }
    return { ok: true, batches: results }
}
