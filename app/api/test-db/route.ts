import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifyToken } from "@/lib/security"
import { Pool } from "pg"

const allowSelfSigned = process.env.DB_SSL_REJECT_UNAUTHORIZED === "false"

function parseConnectionString(connectionString: string): { connectionString: string; ssl?: any } {
  try {
    const url = new URL(connectionString)
    const params = new URLSearchParams(url.search)
    const sslMode = params.get("sslmode")
    params.delete("sslmode")
    url.search = params.toString()
    const cleanConnectionString = url.toString()

    let ssl: any = false
    if (sslMode === "disable") {
      ssl = false
    } else if (process.env.NODE_ENV === "production") {
      ssl = { rejectUnauthorized: !allowSelfSigned }
    } else {
      ssl = false
    }

    return { connectionString: cleanConnectionString, ssl }
  } catch {
    return {
      connectionString,
      ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: !allowSelfSigned } : false,
    }
  }
}

export async function GET() {
  const cookieStore = await cookies()
  const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
  const auth = token ? verifyToken(token) : null
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (auth.role !== "Hospital Admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  let pool: Pool | null = null

  try {
    const databaseUrl = process.env.DATABASE_URL

    if (!databaseUrl) {
      return NextResponse.json(
        {
          success: false,
          error: "DATABASE_URL environment variable is not set",
          details: "Please add DATABASE_URL to your environment variables",
        },
        { status: 500 },
      )
    }

    // Create a connection pool with proper SSL handling
    const connectionConfig = parseConnectionString(databaseUrl)
    pool = new Pool({
      connectionString: connectionConfig.connectionString,
      ssl: connectionConfig.ssl,
    })

    // Test the connection
    const client = await pool.connect()

    // Run a simple query to verify connection
    const result = await client.query("SELECT NOW() as current_time, version() as postgres_version")

    client.release()

    return NextResponse.json({
      success: true,
      message: "Database connection successful!",
      data: {
        currentTime: result.rows[0].current_time,
        postgresVersion: result.rows[0].postgres_version,
        databaseUrl: databaseUrl.replace(/:[^:@]+@/, ":****@"), // Hide password in response
      },
    })
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: "Database connection failed",
        details: {
          hint: getConnectionErrorHint(error.code),
        },
      },
      { status: 500 },
    )
  } finally {
    if (pool) {
      await pool.end()
    }
  }
}

function getConnectionErrorHint(code: string): string {
  switch (code) {
    case "ECONNREFUSED":
      return "PostgreSQL server is not running or not accepting connections on localhost:5432. Please start your PostgreSQL service."
    case "28P01":
      return "Authentication failed. Please check your database username and password."
    case "3D000":
      return 'Database does not exist. Please create the "dayspring_medical_center" database first.'
    case "ENOTFOUND":
      return "Database host not found. Please check your DATABASE_URL."
    default:
      return "Please check your database configuration and ensure PostgreSQL is running."
  }
}
