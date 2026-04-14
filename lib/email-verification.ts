import { query } from "@/lib/db"
import * as crypto from "crypto"

type EmailVerificationTokenRow = {
  id: string
  user_id: string
  token: string
  new_email: string
  expires_at: string | Date
  used: boolean
  created_at: string | Date
}

/**
 * Ensures the email_verification_tokens table exists.
 * Safe to call on every request; used by user creation, send-otp, and verify-email flows.
 */
export async function ensureEmailVerificationTable(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS email_verification_tokens (
      id TEXT PRIMARY KEY DEFAULT md5(random()::text || clock_timestamp()::text),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token VARCHAR(255) UNIQUE NOT NULL,
      new_email VARCHAR(255) NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      used BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `)
  await query(`CREATE INDEX IF NOT EXISTS idx_email_tokens_user_id ON email_verification_tokens(user_id)`)
  await query(`CREATE INDEX IF NOT EXISTS idx_email_tokens_expires ON email_verification_tokens(expires_at)`)
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

function toDate(value: string | Date) {
  return value instanceof Date ? value : new Date(value)
}

export async function getLatestActiveEmailVerificationToken(userId: string, email?: string) {
  await ensureEmailVerificationTable()
  const params: Array<string | null> = [userId, email ? normalizeEmail(email) : null]
  const { rows } = await query<EmailVerificationTokenRow>(
    `SELECT id, user_id, token, new_email, expires_at, used, created_at
       FROM email_verification_tokens
      WHERE user_id = $1
        AND used = false
        AND expires_at >= NOW()
        AND ($2::text IS NULL OR LOWER(new_email) = $2)
      ORDER BY created_at DESC
      LIMIT 1`,
    params,
  )

  if (!rows.length) return null
  return {
    ...rows[0],
    new_email: normalizeEmail(rows[0].new_email),
    expires_at: toDate(rows[0].expires_at),
    created_at: toDate(rows[0].created_at),
  }
}

export async function issueEmailVerificationToken(input: {
  userId: string
  email: string
  ttlMinutes: number
}) {
  await ensureEmailVerificationTable()

  const normalizedEmail = normalizeEmail(input.email)
  const existing = await getLatestActiveEmailVerificationToken(input.userId, normalizedEmail)
  if (existing) {
    return {
      token: existing.token,
      newEmail: normalizedEmail,
      expiresAt: existing.expires_at,
      reused: true,
    }
  }

  await query(
    `DELETE FROM email_verification_tokens
      WHERE used = true
         OR expires_at < NOW()
         OR (user_id = $1 AND LOWER(new_email) <> $2)`,
    [input.userId, normalizedEmail],
  )

  const expiresAt = new Date(Date.now() + input.ttlMinutes * 60 * 1000)
  let otp = ""
  let inserted = false

  for (let i = 0; i < 5; i += 1) {
    otp = crypto.randomInt(100000, 1000000).toString()
    try {
      await query(
        `INSERT INTO email_verification_tokens (user_id, token, new_email, expires_at, used)
         VALUES ($1, $2, $3, $4, false)`,
        [input.userId, otp, normalizedEmail, expiresAt.toISOString()],
      )
      inserted = true
      break
    } catch (error: any) {
      if (error?.code === "23505") continue
      throw error
    }
  }

  if (!inserted) {
    throw new Error("Could not generate a unique verification code. Please try again.")
  }

  return {
    token: otp,
    newEmail: normalizedEmail,
    expiresAt,
    reused: false,
  }
}
