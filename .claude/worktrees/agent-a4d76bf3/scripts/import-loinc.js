/**
 * Import the full LOINC core table into the application database.
 * Usage: node scripts/import-loinc.js
 */
const fs = require("fs")
const path = require("path")
const { parse } = require("csv-parse")
const { Pool } = require("pg")
require("dotenv").config()

async function main() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) throw new Error("DATABASE_URL is required")

  const filePath = path.join(process.cwd(), "data", "LoincTableCore.csv")
  if (!fs.existsSync(filePath)) throw new Error(`LOINC file not found at ${filePath}`)

  const pool = new Pool({ connectionString: databaseUrl })
  const client = await pool.connect()

  try {
    console.log("Ensuring loinc_tests table exists...")
    await client.query(`
      CREATE TABLE IF NOT EXISTS loinc_tests (
        loinc_code VARCHAR(20) PRIMARY KEY,
        component TEXT,
        property TEXT,
        time_aspct TEXT,
        system TEXT,
        scale_typ TEXT,
        method_typ TEXT,
        class TEXT,
        classtype INTEGER,
        long_common_name TEXT,
        shortname TEXT,
        units TEXT,
        example_units TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `)

    const { rows } = await client.query("SELECT COUNT(*)::int AS count FROM loinc_tests")
    if (rows[0].count > 0) {
      console.log(`loinc_tests already has ${rows[0].count} rows. Skipping import.`)
      return
    }

    console.log("Importing LOINC from", filePath)
    const stream = fs.createReadStream(filePath).pipe(
      parse({
        columns: true,
        relax_quotes: true,
        skip_empty_lines: true,
        trim: true,
      })
    )

    const batchSize = 1000
    let batch = []
    let total = 0

    for await (const record of stream) {
      batch.push([
        record["LOINC_NUM"],
        record["COMPONENT"],
        record["PROPERTY"],
        record["TIME_ASPCT"],
        record["SYSTEM"],
        record["SCALE_TYP"],
        record["METHOD_TYP"],
        record["CLASS"],
        record["CLASSTYPE"] ? Number(record["CLASSTYPE"]) : null,
        record["LONG_COMMON_NAME"],
        record["SHORTNAME"],
        record["EXAMPLE_UCUM_UNITS"] || record["EXAMPLE_SI_UCUM_UNITS"] || null,
        record["EXAMPLE_UCUM_UNITS"] || null,
      ])

      if (batch.length >= batchSize) {
        await insertBatch(client, batch)
        total += batch.length
        console.log(`Imported ${total} rows...`)
        batch = []
      }
    }

    if (batch.length) {
      await insertBatch(client, batch)
      total += batch.length
    }

    console.log(`LOINC import complete. Total rows inserted: ${total}`)
  } finally {
    client.release()
    await pool.end()
  }
}

async function insertBatch(client, rows) {
  const values = []
  const params = []
  rows.forEach((r, idx) => {
    const offset = idx * 13
    values.push(
      `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9}, $${offset + 10}, $${offset + 11}, $${offset + 12}, $${offset + 13})`
    )
    params.push(...r)
  })
  const sql = `
    INSERT INTO loinc_tests (
      loinc_code, component, property, time_aspct, system, scale_typ, method_typ, class, classtype,
      long_common_name, shortname, units, example_units
    ) VALUES ${values.join(", ")}
    ON CONFLICT (loinc_code) DO UPDATE SET
      component = EXCLUDED.component,
      property = EXCLUDED.property,
      time_aspct = EXCLUDED.time_aspct,
      system = EXCLUDED.system,
      scale_typ = EXCLUDED.scale_typ,
      method_typ = EXCLUDED.method_typ,
      class = EXCLUDED.class,
      classtype = EXCLUDED.classtype,
      long_common_name = EXCLUDED.long_common_name,
      shortname = EXCLUDED.shortname,
      units = EXCLUDED.units,
      example_units = EXCLUDED.example_units;
  `
  await client.query(sql, params)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
