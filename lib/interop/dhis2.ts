export type DataValue = { dataElement: string; value: number | string }

export function buildDataValueSet(period: string, orgUnit: string, dataValues: DataValue[]) {
  return {
    dataValues: dataValues.map(dv => ({ dataElement: dv.dataElement, value: String(dv.value) })),
    period,
    orgUnit,
  }
}

// Map higher-level resources (Patient, Encounter, LabResult) to DHIS2 data elements.
// This uses configuration in `process.env.DHIS2_MAPPING_JSON` (JSON string) or
// the `dhis2_mappings` table if you implement DB-backed mappings later.
export function mapResourceToDataValues(resourceType: string, resource: any, facilityId?: string): DataValue[] {
  const raw = process.env.DHIS2_MAPPING_JSON || '{}'
  let cfg: Record<string, any> = {}
  try { cfg = JSON.parse(raw) } catch {
    // default empty
  }

  const mapForType = cfg[resourceType] || {}
  const out: DataValue[] = []

  // If DB-backed mappings are enabled, try to load them
  if (process.env.DHIS2_USE_DB === 'true' && process.env.DATABASE_URL) {
    try {
      // lazy import to avoid pulling pg in environments that don't need it
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { Client } = require('pg')
      const client = new Client({ connectionString: process.env.DATABASE_URL })
      // synchronous pattern: connect, query, then close
      // Note: this is intentionally simple; for production, use pooled client.
      // eslint-disable-next-line no-await-in-loop
      ;(async () => {
        await client.connect()
        const res = await client.query('SELECT field, data_element FROM dhis2_mappings WHERE resource_type = $1', [resourceType])
        for (const row of res.rows) {
          const val = resource[row.field]
          if (val !== undefined && val !== null) out.push({ dataElement: String(row.data_element), value: val })
        }
        await client.end()
      })()
    } catch (e) {
      // ignore DB errors and fall back to env/config mappings
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

export async function pushDataValueSet(dvs: any, opts?: { dryRun?: boolean; retries?: number }) {
  const base = process.env.DHIS2_BASE_URL
  const user = process.env.DHIS2_USERNAME
  const pass = process.env.DHIS2_PASSWORD
  if (!base) throw new Error('DHIS2_BASE_URL not configured in environment')
  if (opts?.dryRun) return { dryRun: true, payload: dvs }

  const url = `${base.replace(/\/+$/, '')}/api/dataValueSets`
  const headers: any = { 'Content-Type': 'application/json' }
  if (user && pass) headers['Authorization'] = 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64')

    // Support batching large payloads into multiple POSTs to avoid server limits
    const batchSize = opts.batchSize || 500
    const maxRetries = opts.maxRetries ?? 4
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
