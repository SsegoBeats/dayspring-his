import { Client } from "pg"
import fs from "fs"
import path from "path"
import "dotenv/config"

async function runMigration() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  })

  try {
    console.log("🔧 Connecting to database...")
    await client.connect()
    console.log("✅ Connected successfully!")

    console.log("📄 Reading migration file...")
    const migrationPath = path.join(process.cwd(), "scripts", "migrations", "004-enhance-triage-opd.sql")
    const migrationSQL = fs.readFileSync(migrationPath, "utf-8")

    console.log("🚀 Executing migration 004: enhance-triage-opd...")
    await client.query(migrationSQL)
    console.log("✅ Migration completed successfully!")
    console.log("\n📋 Migration Summary:")
    console.log("   ✓ Added next_of_kin_relation to patients table")
    console.log("   ✓ Added next_of_kin_residence to patients table")
    console.log("   ✓ Ensured triage_assessments table exists with metadata column")
    console.log("   ✓ Updated triage_category constraints")
    console.log("   ✓ Removed current_status constraint for workflow support")
  } catch (error: any) {
    console.error("❌ Migration failed:", error.message)
    if (error.stack) {
      console.error(error.stack)
    }
    process.exit(1)
  } finally {
    await client.end()
    console.log("\n🔌 Database connection closed")
  }
}

runMigration()
