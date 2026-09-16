import { Client } from "pg"
import fs from "fs"
import path from "path"

async function runMigrations() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  })

  try {
    console.log("[v0] Connecting to database...")
    await client.connect()
    console.log("[v0] Connected successfully!")

    // Read and execute schema creation script
    console.log("[v0] Running 01-create-database-schema.sql...")
    const schemaSQL = fs.readFileSync(path.join(process.cwd(), "scripts", "01-create-database-schema.sql"), "utf-8")
    await client.query(schemaSQL)
    console.log("[v0] Schema created successfully!")

    // Read and execute seed data script
    console.log("[v0] Running 02-seed-initial-data.sql...")
    const seedSQL = fs.readFileSync(path.join(process.cwd(), "scripts", "02-seed-initial-data.sql"), "utf-8")
    await client.query(seedSQL)
    console.log("[v0] Seed data inserted successfully!")

    console.log("[v0] ✅ All migrations completed successfully!")
  } catch (error) {
    console.error("[v0] ❌ Migration failed:", error)
    throw error
  } finally {
    await client.end()
    console.log("[v0] Database connection closed")
  }
}

runMigrations()
