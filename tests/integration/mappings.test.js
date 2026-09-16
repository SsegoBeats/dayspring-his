const assert = require('assert')
const path = require('path')

async function getFetch() {
  if (typeof fetch !== 'undefined') return fetch
  const mod = await import('node-fetch')
  return mod.default || mod
}

async function run() {
  console.log('Integration mapping tests: ensure auth and DB are configured before running')
  const token = process.env.TEST_ADMIN_TOKEN
  if (!token) { console.log('TEST_ADMIN_TOKEN not set — skipping'); return }
  try {
    const f = await getFetch()

    const adminRes = await f('http://localhost:3000/api/admin/integrations/dhis2', { headers: { Authorization: `Bearer ${token}` } })
    const adminJson = await adminRes.json()
    assert(adminJson.ok === true, 'expected ok response')
    console.log('OK: DHIS2 mappings list returned', Array.isArray(adminJson.rows) ? adminJson.rows.length : 'unknown')

    const hmisRes = await f('http://localhost:3000/api/integrations/hmis', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        facilityId: 'facility-001',
        period: '2026-09',
        metrics: {
          outpatientVisits: 420,
          emergencyVisits: 78,
          deliveries: 34,
          antenatalVisits: 120,
          malariaCases: 24,
          hivTests: 95,
          tbCases: 7,
          referrals: 12,
          facilityAdmissions: 18,
        },
      }),
    })

    const hmisJson = await hmisRes.json()
    assert(hmisRes.status === 200, 'expected HMIS endpoint to respond 200')
    assert(hmisJson.ok === true, 'expected HMIS response ok')
    assert(Array.isArray(hmisJson.result?.dhis2?.dataValues), 'expected DHIS2 data values array')
    assert(Array.isArray(hmisJson.result?.fhir?.entry), 'expected FHIR bundle entries array')
    assert(Array.isArray(hmisJson.result?.openmrs?.values), 'expected OpenMRS values array')
    console.log('OK: HMIS payload generation returned DHIS2/FHIR/OpenMRS structures')
  } catch (err) {
    console.error('Integration test failed:', err.message || err)
    process.exit(2)
  }
}

run().catch(err => { console.error(err); process.exit(1) })
