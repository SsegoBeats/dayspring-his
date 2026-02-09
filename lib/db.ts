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
    
    // Determine SSL configuration based on sslmode and environment
    let ssl: any = false
    if (sslMode === "disable") {
      ssl = false
    } else if (process.env.NODE_ENV === "production") {
      // In production, SSL is typically required
      // For managed databases (Vercel Postgres, etc.), we may need to accept self-signed certs
      // Check if it's a cloud database URL (common patterns)
      const isCloudDb = url.hostname.includes(".vercel") || 
                       url.hostname.includes(".aws") || 
                       url.hostname.includes(".azure") ||
                       url.hostname.includes(".cloud")
      
      if (sslMode === "verify-full" || (!sslMode && isCloudDb)) {
        // For verify-full or cloud DBs without explicit mode, verify certificates
        ssl = { rejectUnauthorized: true }
      } else if (sslMode === "require" || sslMode === "prefer" || sslMode === "verify-ca" || isCloudDb) {
        // For require/prefer/verify-ca or cloud DBs, accept but verify when possible
        // Many cloud providers use self-signed certs, so we allow them
        ssl = { rejectUnauthorized: false }
      } else {
        // Default for production: require SSL but allow self-signed (common for managed DBs)
        ssl = { rejectUnauthorized: false }
      }
    } else {
      // In development, no SSL needed for local connections
      ssl = false
    }
    
    return { connectionString: cleanConnectionString, ssl }
  } catch {
    // If URL parsing fails, use original connection string with safe defaults
    return {
      connectionString,
      ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
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
    return await p.query(text, params)
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
  return withSession(session, (client) => client.query(text, params))
}


