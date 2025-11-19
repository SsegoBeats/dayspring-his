import { NextResponse } from "next/server"
import { Pool } from "pg"

export async function GET() {
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

    // Create a connection pool
    pool = new Pool({
      connectionString: databaseUrl,
      ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
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
        error: error.message,
        details: {
          code: error.code,
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
