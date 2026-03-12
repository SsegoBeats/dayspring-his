import { query } from "@/lib/db"

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
