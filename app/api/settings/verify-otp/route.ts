import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifyToken } from "@/lib/security"
import { z } from "zod"
import { query } from "@/lib/db"

const Schema = z.object({ otp: z.string().length(6) })

export async function POST(req: Request) {
  const cookieStore = await cookies()
  const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
  const auth = token ? verifyToken(token) : null
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const { otp } = Schema.parse(body)

  // Verify OTP - use UTC timestamps consistently
  const currentTimeUTC = new Date()
  
  const { rows } = await query(
    `SELECT id, user_id, new_email, expires_at, used, created_at FROM email_verification_tokens 
     WHERE user_id = $1 AND token = $2`,
    [auth.userId, otp]
  )

  const row = rows[0]
  
  // Provide more specific error messages
  if (!row) {
    console.error(`[OTP Verify] No matching token found for user ${auth.userId} with code ${otp}`)
    
    // Log all existing tokens for this user to debug
    const { rows: allTokens } = await query(
      `SELECT token, expires_at, used, created_at FROM email_verification_tokens WHERE user_id = $1`,
      [auth.userId]
    )
    console.error(`[OTP Verify] All tokens for user ${auth.userId}:`, allTokens)
    
    return NextResponse.json({ error: "Invalid verification code. Please request a new code." }, { status: 400 })
  }
  
  if (row.used) {
    console.error(`[OTP Verify] Code already used for user ${auth.userId}`)
    return NextResponse.json({ error: "This code has already been used. Please request a new code." }, { status: 400 })
  }
  
  // Parse the expires_at - PostgreSQL returns it as a string, we need to ensure UTC
  const expiresAtStr = String(row.expires_at)
  
  // Handle both ISO string format and PostgreSQL timestamp format
  let expiresAt: Date
  if (expiresAtStr.includes('T') && expiresAtStr.includes('Z')) {
    // Already in ISO format
    expiresAt = new Date(expiresAtStr)
  } else {
    // PostgreSQL timestamp format - append 'Z' to force UTC interpretation
    expiresAt = new Date(expiresAtStr + 'Z')
  }
  
  const timeDiff = expiresAt.getTime() - currentTimeUTC.getTime()
  
  console.log(`[OTP Verify] Raw expires_at from DB: ${expiresAtStr}`)
  console.log(`[OTP Verify] Parsed expires_at (UTC): ${expiresAt.toISOString()}`)
  console.log(`[OTP Verify] Current time (UTC): ${currentTimeUTC.toISOString()}`)
  console.log(`[OTP Verify] Time difference: ${timeDiff}ms (${Math.round(timeDiff / 1000)} seconds)`)
  
  if (timeDiff < 0) {
    console.error(`[OTP Verify] Code expired! Time difference: ${Math.round(timeDiff / 1000)} seconds`)
    return NextResponse.json({ error: "This code has expired. Please request a new code." }, { status: 400 })
  }
  
  console.log(`[OTP Verify] Code is valid! Time remaining: ${Math.round(timeDiff / 1000)} seconds`)

  // Get user's name and current email for the notifications
  const { rows: userRows } = await query(`SELECT name, email FROM users WHERE id = $1`, [auth.userId])
  const userName = userRows[0]?.name || "there"
  const oldEmail = userRows[0]?.email || ""

  // Update email and mark as verified
  console.log(`[OTP Verify] Updating email from ${oldEmail} to ${row.new_email}`)
  await query(`UPDATE users SET email = $1, email_verified_at = NOW() WHERE id = $2`, 
    [row.new_email, auth.userId])
  console.log(`[OTP Verify] Email updated in database`)
  
  await query(`UPDATE email_verification_tokens SET used = true WHERE user_id = $1 AND token = $2`, 
    [auth.userId, otp])
  await query(`INSERT INTO audit_logs (user_id, action, entity_type, details) VALUES ($1,$2,$3,$4)`,
    [auth.userId, 'email_verified', 'user', JSON.stringify({ new_email: row.new_email })])
  
  // Verify the update in database
  const { rows: verifyRows } = await query(`SELECT email, email_verified_at FROM users WHERE id = $1`, [auth.userId])
  if (verifyRows.length > 0) {
    console.log(`[OTP Verify] Database verification - Email: ${verifyRows[0].email}, Verified: ${verifyRows[0].email_verified_at}`)
  }

  // Send email notifications
  try {
    const { emailTemplates, sendEmailServer } = await import("@/lib/email-service")
    
    // Send change notification to OLD email (if different from new)
    if (oldEmail && oldEmail !== row.new_email) {
      const changeNotification = emailTemplates.emailChanged(userName, oldEmail, row.new_email)
      await sendEmailServer(oldEmail, changeNotification)
      console.log(`[OTP Verify] Change notification sent to old email: ${oldEmail}`)
    }
    
    // Send confirmation to NEW email
    const confirmationTemplate = emailTemplates.emailVerified(userName, row.new_email)
    await sendEmailServer(row.new_email, confirmationTemplate)
    console.log(`[OTP Verify] Confirmation email sent to new email: ${row.new_email}`)
  } catch (error) {
    console.error(`[OTP Verify] Failed to send email notifications:`, error)
    // Don't fail the verification if email sending fails
  }

  return NextResponse.json({ success: true, message: "Email verified successfully" })
}
