import { Pool, type PoolClient } from "pg"
import { logSlowQuery, nowMs } from "@/lib/observability"

let pool: Pool | null = null

function parseConnectionString(connectionString: string): { connectionString: string; ssl?: any } {
  try {
    const url = new URL(connectionString)
    
    // Remove sslmode from query params if present to avoid warning
    // We'll handle SSL via the ssl option instead
    const params = new URLSearchParams(url.search)
    const sslMode = params.get("sslmode")
    params.delete("sslmode")
    
    // Rebuild URL without sslmode
    url.search = params.toString()
    const cleanConnectionString = url.toString()
    
    // Determine SSL configuration based on sslmode and environment.
    // DB_SSL_REJECT_UNAUTHORIZED=false is an escape hatch for managed DBs that issue
    // self-signed certificates (e.g. some on-premise deployments). Default is true.
    const allowSelfSigned = process.env.DB_SSL_REJECT_UNAUTHORIZED === "false"
    let ssl: any = false
    if (sslMode === "disable") {
      ssl = false
    } else if (sslMode === "verify-full") {
      ssl = { rejectUnauthorized: true }
    } else if (sslMode === "require" || sslMode === "prefer" || sslMode === "verify-ca") {
      ssl = { rejectUnauthorized: !allowSelfSigned }
    } else if (process.env.NODE_ENV === "production") {
      // Production default: require SSL and verify certificates.
      // Set DB_SSL_REJECT_UNAUTHORIZED=false only if your managed DB uses self-signed certs.
      ssl = { rejectUnauthorized: !allowSelfSigned }
    } else {
      // Development: no SSL needed for local connections
      ssl = false
    }
    
    return { connectionString: cleanConnectionString, ssl }
  } catch {
    // If URL parsing fails, use original connection string with safe defaults
    const allowSelfSigned = process.env.DB_SSL_REJECT_UNAUTHORIZED === "false"
    return {
      connectionString,
      ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: !allowSelfSigned } : false,
    }
  }
}

export function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL
    if (!connectionString) {
      throw new Error("DATABASE_URL is not set")
    }
    const { connectionString: cleanConnectionString, ssl } = parseConnectionString(connectionString)
    pool = new Pool({
      connectionString: cleanConnectionString,
      ssl,
    })
  }
  return pool
}

export async function withClient<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const p = getPool()
  const client = await p.connect()
  try {
    return await fn(client)
  } finally {
    client.release()
  }
}

export async function query<T = any>(text: string, params?: any[]): Promise<{ rows: T[] }> {
  const p = getPool()
  const start = nowMs()
  try {
    return await p.query(text, params) as unknown as { rows: T[] }
  } finally {
    logSlowQuery(text, nowMs() - start)
  }
}

export type DbSession = { role?: string; userId?: string }

export async function withSession<T>(session: DbSession, fn: (client: PoolClient) => Promise<T>): Promise<T> {
  return withClient(async (client) => {
    await client.query("BEGIN")
    if (session.role) {
      await client.query(`SELECT set_config('app.role', $1, true)`, [session.role])
    }
    if (session.userId) {
      await client.query(`SELECT set_config('app.user_id', $1, true)`, [session.userId])
    }
    try {
      const result = await fn(client)
      await client.query("COMMIT")
      return result
    } catch (e) {
      await client.query("ROLLBACK")
      throw e
    }
  })
}

export async function queryWithSession<T = any>(session: DbSession, text: string, params?: any[]): Promise<{ rows: T[] }> {
  return withSession(session, (client) => client.query(text, params)) as unknown as Promise<{ rows: T[] }>
}

