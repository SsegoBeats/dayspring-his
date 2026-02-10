/**
 * Run dental records UPDATE/DELETE RLS migration (0019).
 * Usage: node scripts/run-dental-update-delete-rls.js
 * Requires: DATABASE_URL in environment or .env
 */
require("dotenv").config();
const { Client } = require("pg");
const fs = require("fs");
const path = require("path");

const MIGRATION = "0019_dental_update_delete_rls.sql";

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

    const filePath = path.join(process.cwd(), "migrations", MIGRATION);
    if (!fs.existsSync(filePath)) {
      console.error("❌ File not found: " + filePath);
      process.exit(1);
    }
    const sql = fs.readFileSync(filePath, "utf-8");
    console.log("📄 Running " + MIGRATION + "...");
    await client.query(sql);
    console.log("   ✅ " + MIGRATION + " completed.\n");
    console.log("✅ Migration completed successfully.");
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
