import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifyToken } from "@/lib/security"
import { z } from "zod"
import { query } from "@/lib/db"
import crypto from "crypto"
import { emailTemplates, sendEmailServer } from "@/lib/email-service"
import { rateLimitPg } from "@/lib/rate-limit-pg"

const Schema = z.object({ email: z.string().email() })

async function ensureEmailVerificationTable() {
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

export async function POST(req: Request) {
  try {
    const ip = (req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "127.0.0.1").split(",")[0]
    if (!(await rateLimitPg(`settings:otp:${ip}`, 5, 60))) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 })
    }

    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    const auth = token ? verifyToken(token) : null
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await req.json()
    const { email } = Schema.parse(body)

    // Ensure backing table exists (for environments where migrations didn't create it)
    await ensureEmailVerificationTable()

    // Always generate a NEW code and replace the old one
    const otp = crypto.randomInt(100000, 999999).toString()
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes from now

    console.log(`[OTP] Current time (UTC): ${new Date().toISOString()}`)
    console.log(`[OTP] Expires at (UTC): ${expiresAt.toISOString()}`)
    console.log(`[OTP] Code: ${otp}, Expires in: ${(expiresAt.getTime() - Date.now()) / 1000} seconds`)

    // Delete ALL existing OTPs for this user (including valid ones) - this invalidates the old code
    await query(`DELETE FROM email_verification_tokens WHERE user_id = $1`, [auth.userId])

    // Store the new OTP in database - use toISOString() to ensure UTC storage
    await query(
      `INSERT INTO email_verification_tokens (user_id, token, new_email, expires_at, used) 
       VALUES ($1, $2, $3, $4, false)`,
      [auth.userId, otp, email, expiresAt.toISOString()],
    )

    console.log(`[OTP] Generated new code ${otp} for user ${auth.userId}`)

    // Fetch user details for personalization
    const { rows: userRows } = await query(`SELECT name FROM users WHERE id = $1`, [auth.userId])
    const userName = userRows[0]?.name || "there"

    // Send OTP email with personalized and professional template
    const template = {
    subject: "Email Verification Code - Dayspring Medical Center",
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f7fa;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f7fa; padding: 40px 20px;">
          <tr>
            <td align="center">
              <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
                
                <!-- Header -->
                <tr>
                  <td style="background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); padding: 32px 40px; border-radius: 12px 12px 0 0;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td>
                          <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">Email Verification Code</h1>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                
                <!-- Content -->
                <tr>
                  <td style="padding: 40px;">
                    <p style="margin: 0 0 16px 0; color: #374151; font-size: 16px; line-height: 24px;">
                      Hello <strong>${userName}</strong>,
                    </p>
                    <p style="margin: 0 0 24px 0; color: #374151; font-size: 16px; line-height: 24px;">
                      We received a request to change your email address for your Dayspring Medical Center account. 
                      To complete this change, please use the verification code below:
                    </p>
                    
                    <!-- OTP Code Box -->
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td align="center" style="padding: 0 0 32px 0;">
                          <div style="background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); border: 2px dashed #0ea5e9; border-radius: 12px; padding: 24px 32px; display: inline-block;">
                            <div style="font-size: 36px; font-weight: 700; color: #0369a1; letter-spacing: 8px; font-family: 'Courier New', monospace; line-height: 1.2;">
                              ${otp}
                            </div>
                          </div>
                        </td>
                      </tr>
                    </table>
                    
                    <!-- Info Box -->
                    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 8px; margin: 0 0 24px 0; padding: 16px;">
                      <tr>
                        <td>
                          <p style="margin: 0; color: #92400e; font-size: 14px; line-height: 20px;">
                            ⏰ <strong>Important:</strong> This verification code will expire in <strong>10 minutes</strong> for your security.
                          </p>
                        </td>
                      </tr>
                    </table>
                    
                    <!-- Instructions -->
                    <p style="margin: 0 0 16px 0; color: #374151; font-size: 14px; line-height: 22px;">
                      Here's what to do next:
                    </p>
                    <ul style="margin: 0 0 24px 0; padding-left: 24px; color: #374151; font-size: 14px; line-height: 22px;">
                      <li style="margin: 0 0 8px 0;">Enter the 6-digit code above in the verification field</li>
                      <li style="margin: 0 0 8px 0;">Your email address will be updated immediately upon verification</li>
                      <li style="margin: 0;">For your security, this code can only be used once</li>
                    </ul>
                    
                    <!-- Security Notice -->
                    <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; border-radius: 8px; padding: 16px; margin: 0 0 32px 0;">
                      <p style="margin: 0; color: #991b1b; font-size: 14px; line-height: 20px;">
                        🔒 <strong>Security Notice:</strong> If you didn't request this email change, please ignore this message and contact our support team immediately. Your account remains secure.
                      </p>
                    </div>
                    
                    <!-- Support -->
                    <p style="margin: 0; color: #6b7280; font-size: 14px; line-height: 20px; text-align: center;">
                      Need help? Contact our support team at 
                      <a href="mailto:support@dayspringhospital.ug" style="color: #2563eb; text-decoration: none;">support@dayspringhospital.ug</a>
                    </p>
                  </td>
                </tr>
                
                <!-- Footer -->
                <tr>
                  <td style="background-color: #f9fafb; padding: 24px 40px; border-radius: 0 0 12px 12px; border-top: 1px solid #e5e7eb;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td align="center">
                          <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 12px; line-height: 18px;">
                            Dayspring Medical Center - Information System
                          </p>
                          <p style="margin: 0; color: #9ca3af; font-size: 11px; line-height: 16px;">
                            © ${new Date().getFullYear()} Dayspring Medical Center. All rights reserved.
                          </p>
                          <p style="margin: 8px 0 0 0; color: #9ca3af; font-size: 11px; line-height: 16px;">
                            Kampala, Uganda | Trusted Healthcare Since 2015
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `,
    }

    // Send the email with the new code (errors are logged inside sendEmailServer)
    await sendEmailServer(email, template)
    await query(`INSERT INTO audit_logs (user_id, action, entity_type, details) VALUES ($1,$2,$3,$4)`, [
      auth.userId,
      "otp_sent",
      "user",
      JSON.stringify({ email }),
    ])

    return NextResponse.json({ success: true, message: "Verification code sent" })
  } catch (err: any) {
    if (err?.name === "ZodError") {
      return NextResponse.json({ error: "Invalid email", details: err.issues }, { status: 400 })
    }
    console.error("Error in /api/settings/send-otp:", err)
    return NextResponse.json({ error: "Failed to send verification code" }, { status: 500 })
  }
}

