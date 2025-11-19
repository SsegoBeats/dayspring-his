import { Pool, type PoolClient } from "pg"
import { logSlowQuery, nowMs } from "@/lib/observability"

let pool: Pool | null = null

export function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL
    if (!connectionString) {
      throw new Error("DATABASE_URL is not set")
    }
    pool = new Pool({
      connectionString,
      ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
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


