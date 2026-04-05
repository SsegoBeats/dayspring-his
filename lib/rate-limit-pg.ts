import { withClient } from "@/lib/db"

let ensuredRateLimitTable = false

async function ensureRateLimitTable(): Promise<void> {
  if (ensuredRateLimitTable) return
  await withClient(async (client) => {
    await client.query(`
      CREATE TABLE IF NOT EXISTS rate_limits (
        id BIGSERIAL PRIMARY KEY,
        key TEXT NOT NULL,
        window_seconds INTEGER NOT NULL,
        window_start TIMESTAMP NOT NULL,
        count INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_rate_limits_key ON rate_limits(key)`)
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_rate_limits_window_unique
      ON rate_limits(key, window_seconds, window_start)
    `)
  })
  ensuredRateLimitTable = true
}

export async function rateLimitPg(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  try {
    const now = new Date()
    const windowStart = new Date(Math.floor(now.getTime() / (windowSeconds * 1000)) * windowSeconds * 1000)
    await ensureRateLimitTable()
    return withClient(async (client) => {
      await client.query("BEGIN")
      try {
        const res = await client.query(
          `INSERT INTO rate_limits (key, window_seconds, window_start, count)
           VALUES ($1,$2,$3,1)
           ON CONFLICT (key, window_seconds, window_start)
           DO UPDATE SET count = rate_limits.count + 1
           RETURNING count`,
          [key, windowSeconds, windowStart.toISOString()],
        )
        await client.query("COMMIT")
        const count = Number(res.rows[0].count)
        return count <= limit
      } catch (error) {
        await client.query("ROLLBACK")
        throw error
      }
    })
  } catch (error) {
    // Fail closed: deny the request when rate-limit DB is unavailable.
    // Prevents brute-force attacks exploiting DB outages.
    console.error("[rate-limit] DB error, denying request:", error)
    return false
  }
}


