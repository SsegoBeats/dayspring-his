import { query } from "@/lib/db"

/**
 * Ensures the email_verification_tokens table exists.
 * Safe to call on every request; used by user creation, send-otp, and verify-email flows.
 */
export async function ensureEmailVerificationTable(): Promise<void> {
  try {
    await query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`)
  } catch {
    // Extension may already exist or DB may not allow creation
  }
  await query(`
    CREATE TABLE IF NOT EXISTS email_verification_tokens (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token VARCHAR(255) UNIQUE NOT NULL,
      new_email VARCHAR(255) NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      used BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `)
}
