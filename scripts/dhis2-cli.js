#!/usr/bin/env node
const fs = require('fs')
const path = require('path')
// Optionally load .env.local if present (avoid dotenv due to ESM/CJS differences in some environments)
try {
  const envPath = path.resolve(process.cwd(), '.env.local')
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8')
    content.split(/\r?\n/).forEach(line => {
      const m = line.match(/^\s*([^=#]+)=\s*(.*)$/)
      if (m) {
        const k = m[1].trim(); let v = m[2].trim();
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
        if (!process.env[k]) process.env[k] = v
      }
    })
  }
} catch (e) {
  // ignore
}

// Load the CommonJS DHIS2 helper directly
(async () => {
  const dhis2Path = path.resolve(__dirname, '../lib/interop/dhis2.js')
  const dhis2Module = require(dhis2Path)
  const { buildDataValueSet, mapResourceToDataValues, pushDataValueSet } = dhis2Module
  const cmd = process.argv[2]
  if (cmd === 'test-patient') {
    const patient = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../tests/fixtures/patient.json'), 'utf8'))
    const dataValues = mapResourceToDataValues('Patient', patient, process.env.FACILITY_ID)
    const dvs = buildDataValueSet('202608', patient.orgUnit || 'UNKNOWN', dataValues)
    console.log('DRY RUN')
    console.log(JSON.stringify(await pushDataValueSet(dvs, { dryRun: true }), null, 2))
    return
  }
  console.log('Usage: node scripts/dhis2-cli.js test-patient')
})().catch(err => { console.error(err); process.exit(1) })
