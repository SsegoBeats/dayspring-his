const assert = require('assert')
const fetch = require('node-fetch')
const path = require('path')

async function run() {
  console.log('Integration mapping tests: ensure auth and DB are configured before running')
  // This is a smoke test placeholder that attempts to list DHIS2 mappings using local dev token
  const token = process.env.TEST_ADMIN_TOKEN
  if (!token) { console.log('TEST_ADMIN_TOKEN not set — skipping'); return }
  const res = await fetch('http://localhost:3000/api/admin/integrations/dhis2', { headers: { Authorization: `Bearer ${token}` } })
  const json = await res.json()
  assert(json.ok === true, 'expected ok response')
  console.log('OK: DHIS2 mappings list returned', Array.isArray(json.rows) ? json.rows.length : 'unknown')
}

run().catch(err => { console.error(err); process.exit(1) })
