import { SignJWT, jwtVerify } from "jose"
import bcrypt from "bcryptjs"

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "dev-secret-change-in-production-min-32-chars-required-for-security"
)

const ALGORITHM = "HS256"
const TOKEN_EXPIRY = "8h"

export function generateToken(userId: string, email: string, role: string): string {
  const payload = {
    sub: userId,
    email,
    role,
    iat: Math.floor(Date.now() / 1000),
  }

  return new SignJWT(payload)
    .setProtectedHeader({ alg: ALGORITHM })
    .setIssuedAt()
    .setExpirationTime(TOKEN_EXPIRY)
    .sign(JWT_SECRET)
    .then((token) => token)
    .catch(() => {
      throw new Error("Failed to generate JWT")
    })
}

export async function verifyToken(token: string): Promise<{ sub: string; email: string; role: string } | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET, {
      algorithms: [ALGORITHM],
    })
    return {
      sub: payload.sub as string,
      email: payload.email as string,
      role: payload.role as string,
    }
  } catch (error) {
    console.error("JWT verification failed:", error)
    return null
  }
}

export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 10
  return bcrypt.hash(password, saltRounds)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(password, hash)
  } catch (error) {
    console.error("Password verification error:", error)
    return false
  }
}

/**
 * CSRF token generation (UUID v4)
 */
export function generateCsrfToken(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID()
  }
  // Fallback for environments without crypto.randomUUID
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`
}

/**
 * Sanitize user input to prevent XSS
 */
export function sanitizeInput(input: string): string {
  return input
    .replace(/[<>"']/g, "")
    .trim()
    .substring(0, 10000)
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email) && email.length <= 255
}

/**
 * Generate secure random token for password reset / email verification
 */
export function generateSecureToken(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID().replace(/-/g, "")
  }
  return Array.from({ length: 32 }, () => Math.random().toString(36)[2]).join("")
}

/**
 * Rate limit key generation
 */
export function getRateLimitKey(prefix: string, identifier: string): string {
  return `${prefix}:${identifier}`.toLowerCase()
}

/**
 * Audit log sanitization - remove sensitive data before logging
 */
export function sanitizeForAudit(data: any): any {
  if (!data || typeof data !== "object") return data
  
  const sensitiveKeys = ["password", "password_hash", "token", "secret", "apiKey", "api_key"]
  const sanitized = Array.isArray(data) ? [...data] : { ...data }
  
  for (const key of Object.keys(sanitized)) {
    if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk))) {
      sanitized[key] = "[REDACTED]"
    } else if (typeof sanitized[key] === "object" && sanitized[key] !== null) {
      sanitized[key] = sanitizeForAudit(sanitized[key])
    }
  }
  
  return sanitized
}
