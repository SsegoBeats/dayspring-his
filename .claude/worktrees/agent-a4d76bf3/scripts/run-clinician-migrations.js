/**
 * Run Clinician Portal migrations: 0015 (Clinician RLS) and 0016 (vital_signs link).
 * Usage: node scripts/run-clinician-migrations.js
 * Requires: DATABASE_URL in environment or .env
 */
require("dotenv").config();
const { Client } = require("pg");
const fs = require("fs");
const path = require("path");

const MIGRATIONS = [
  "0015_clinician_rls.sql",
  "0016_medical_record_vital_signs.sql",
  "0017_doctor_to_clinician_and_schedule_crud.sql",
];

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("❌ DATABASE_URL is not set. Add it to .env or the environment.");
    process.exit(1);
  }

  const client = new Client({ connectionString: databaseUrl });

  try {
    console.log("🔌 Connecting to database...");
    await client.connect();
    console.log("✅ Connected.\n");

    const migrationsDir = path.join(process.cwd(), "migrations");

    for (const name of MIGRATIONS) {
      const filePath = path.join(migrationsDir, name);
      if (!fs.existsSync(filePath)) {
        console.error(`❌ File not found: ${filePath}`);
        process.exit(1);
      }
      const sql = fs.readFileSync(filePath, "utf-8");
      console.log(`📄 Running ${name}...`);
      await client.query(sql);
      console.log(`   ✅ ${name} completed.\n`);
    }

    console.log("✅ All migrations completed successfully.");
  } catch (err) {
    console.error("❌ Migration failed:", err.message);
    if (err.detail) console.error("   Detail:", err.detail);
    process.exit(1);
  } finally {
    await client.end();
    console.log("🔌 Connection closed.");
  }
}

main();
