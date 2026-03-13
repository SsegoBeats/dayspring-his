const fs = require("fs")
const path = require("path")
const crypto = require("crypto")
const dotenv = require("dotenv")
const bcrypt = require("bcryptjs")
const { Pool } = require("pg")

const rootDir = path.resolve(__dirname, "..")
const envPath = path.join(rootDir, ".env")
const envLocalPath = path.join(rootDir, ".env.local")

dotenv.config({ path: envPath })
dotenv.config({ path: envLocalPath, override: true })

function parseConnectionString(connectionString) {
  try {
    const url = new URL(connectionString)
    const params = new URLSearchParams(url.search)
    const sslMode = params.get("sslmode")
    params.delete("sslmode")
    url.search = params.toString()

    let ssl = false
    if (sslMode === "disable") ssl = false
    else if (sslMode) ssl = { rejectUnauthorized: false }

    return {
      connectionString: url.toString(),
      ssl,
    }
  } catch {
    return {
      connectionString,
      ssl: false,
    }
  }
}

function randomPassword() {
  return `DayspringE2E!${crypto.randomBytes(8).toString("hex")}`
}

function upsertEnvValue(source, key, value) {
  const line = `${key}=${value}`
  const pattern = new RegExp(`^${key}=.*$`, "m")
  if (pattern.test(source)) return source.replace(pattern, line)
  const trimmed = source.trimEnd()
  return trimmed ? `${trimmed}\n${line}\n` : `${line}\n`
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set. Load .env or .env.local before running this script.")
  }

  const parsedDb = parseConnectionString(databaseUrl)
  const email = process.env.E2E_ADMIN_EMAIL || "e2e-admin@dayspring.local"
  const password = process.env.E2E_ADMIN_PASSWORD || randomPassword()
  const name = "Dayspring E2E Admin"
  const phone = "+256700000101"
  const passwordHash = await bcrypt.hash(password, 10)

  const pool = new Pool({
    connectionString: parsedDb.connectionString,
    ssl: parsedDb.ssl,
  })

  try {
    const userId = crypto.randomUUID()
    const { rows } = await pool.query(
      `
        INSERT INTO users (
          id,
          email,
          password_hash,
          name,
          role,
          phone,
          is_active,
          failed_login_attempts,
          locked_until,
          created_at,
          updated_at,
          email_verified_at,
          department
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          'Hospital Admin',
          $5,
          true,
          0,
          NULL,
          NOW(),
          NOW(),
          NOW(),
          'Quality Assurance'
        )
        ON CONFLICT (email) DO UPDATE
        SET
          password_hash = EXCLUDED.password_hash,
          name = EXCLUDED.name,
          role = 'Hospital Admin',
          phone = EXCLUDED.phone,
          is_active = true,
          failed_login_attempts = 0,
          locked_until = NULL,
          updated_at = NOW(),
          email_verified_at = COALESCE(users.email_verified_at, NOW()),
          department = EXCLUDED.department
        RETURNING id, email, role
      `,
      [userId, email, passwordHash, name, phone],
    )

    const currentEnvLocal = fs.existsSync(envLocalPath) ? fs.readFileSync(envLocalPath, "utf8") : ""
    let nextEnvLocal = upsertEnvValue(currentEnvLocal, "E2E_ADMIN_EMAIL", email)
    nextEnvLocal = upsertEnvValue(nextEnvLocal, "E2E_ADMIN_PASSWORD", password)
    fs.writeFileSync(envLocalPath, nextEnvLocal, "utf8")

    console.log(`E2E Admin ready: ${rows[0].email} (${rows[0].role})`)
    console.log(`Credentials stored in ${path.relative(rootDir, envLocalPath)}`)
  } finally {
    await pool.end()
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
