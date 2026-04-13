/**
 * Run Radiologist Portal lab_tests RLS migration (0020).
 * Adds Radiologist to lab_select, lab_insert, lab_update so the portal can load worklist, assign cases, submit reports, and add scans.
 * Usage: node scripts/run-radiologist-lab-rls.js
 * Requires: DATABASE_URL in environment or .env
 */
require("dotenv").config();
const { Client } = require("pg");
const fs = require("fs");
const path = require("path");

const MIGRATION = "0020_radiologist_lab_rls.sql";

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("❌ DATABASE_URL is not set. Add it to .env or the environment.");
    process.exit(1);
  }

  const client = new Client({
    connectionString: databaseUrl,
    connectionTimeoutMillis: 8000,
  });

  try {
    console.log("🔌 Connecting to database...");
    await client.connect();
    console.log("✅ Connected.\n");

    const filePath = path.join(process.cwd(), "migrations", MIGRATION);
    if (!fs.existsSync(filePath)) {
      console.error("❌ File not found: " + filePath);
      process.exit(1);
    }
    const sql = fs.readFileSync(filePath, "utf-8");
    console.log("📄 Running " + MIGRATION + "...");
    await client.query(sql);
    console.log("   ✅ " + MIGRATION + " completed.\n");
    console.log("✅ Radiologist lab_tests RLS migration completed successfully.");
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
