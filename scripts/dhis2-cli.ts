#!/usr/bin/env node
/**
 * Tiny CLI harness to exercise DHIS2 mapping and push logic in local dev.
 * Usage: node scripts/dhis2-cli.js test-patient
 */
import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

import { buildDataValueSet, mapResourceToDataValues, pushDataValueSet } from '@/lib/interop/dhis2'

async function run() {
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
}

run().catch(err => { console.error(err); process.exit(1) })
