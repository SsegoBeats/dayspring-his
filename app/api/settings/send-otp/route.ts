import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifyToken } from "@/lib/security"
import { z } from "zod"
import { query } from "@/lib/db"
import { sendEmailServer, emailTemplates } from "@/lib/email-service"
import { rateLimitPg } from "@/lib/rate-limit-pg"
import { ORG_NAME, ORG_SUBTITLE, ORG_EMAIL, ORG_ADDRESS } from "@/lib/org-constants"
import { issueEmailVerificationToken } from "@/lib/email-verification"

const Schema = z.object({ email: z.string().email() })

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

    const issued = await issueEmailVerificationToken({
      userId: auth.userId,
      email,
      ttlMinutes: 10,
    })
    const otp = issued.token

    const { rows: userRows } = await query(`SELECT name, email, email_verified_at FROM users WHERE id = $1`, [auth.userId])
    const userName = userRows[0]?.name || "there"
    const currentEmail = (userRows[0]?.email || "").trim().toLowerCase()
    const normalizedEmail = email.trim().toLowerCase()
    const isInitialVerification = !userRows[0]?.email_verified_at && currentEmail === normalizedEmail

    const { rows: existingUsers } = await query(
      `SELECT id FROM users WHERE LOWER(email) = $1 AND id <> $2 LIMIT 1`,
      [normalizedEmail, auth.userId],
    )
    if (existingUsers.length > 0) {
      return NextResponse.json({ error: "That email address is already in use by another account." }, { status: 409 })
    }

    // Use the dedicated verificationCode template for initial email verification,
    // and an inline template for email-change verification
    const template = isInitialVerification
      ? emailTemplates.verificationCode(userName, otp)
      : {
          subject: `Email Change Verification - ${ORG_NAME}`,
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
              <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
                <tr>
                  <td style="background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); padding: 32px 40px; border-radius: 12px 12px 0 0;">
                    <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">Email Change Verification</h1>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 40px;">
                    <p style="margin: 0 0 16px 0; color: #374151; font-size: 16px; line-height: 24px;">Hello <strong>${userName}</strong>,</p>
                    <p style="margin: 0 0 24px 0; color: #374151; font-size: 16px; line-height: 24px;">
                      We received a request to change the email address on your ${ORG_NAME} account. Use the code below to confirm this change.
                    </p>
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td align="center" style="padding: 0 0 32px 0;">
                          <div style="background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); border: 2px dashed #0ea5e9; border-radius: 12px; padding: 24px 32px; display: inline-block;">
                            <p style="margin: 0 0 12px 0; color: #0369a1; font-size: 14px; font-weight: 600;">Your Verification Code:</p>
                            <div style="font-size: 36px; font-weight: 700; color: #0369a1; letter-spacing: 8px; font-family: 'Courier New', monospace;">${otp}</div>
                          </div>
                        </td>
                      </tr>
                    </table>
                    <table width="100%" cellpadding="16" cellspacing="0" style="background-color: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 8px; margin: 0 0 24px 0;">
                      <tr><td><p style="margin: 0; color: #92400e; font-size: 14px; line-height: 20px;"><strong>Important:</strong> This code expires in <strong>10 minutes</strong>.</p></td></tr>
                    </table>
                    <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; border-radius: 8px; padding: 16px; margin: 0 0 32px 0;">
                      <p style="margin: 0; color: #991b1b; font-size: 14px; line-height: 20px;">
                        <strong>Security Notice:</strong> If you did not request this change, please contact our support team immediately.
                      </p>
                    </div>
                    <p style="margin: 0; color: #6b7280; font-size: 14px; line-height: 20px; text-align: center;">
                      Need help? Contact us at <a href="mailto:${ORG_EMAIL}" style="color: #2563eb; text-decoration: none;">${ORG_EMAIL}</a>
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="background-color: #f9fafb; padding: 24px 40px; border-radius: 0 0 12px 12px; border-top: 1px solid #e5e7eb;">
                    <p style="margin: 0; color: #9ca3af; font-size: 11px; line-height: 16px; text-align: center;">
                      ${ORG_NAME} - ${ORG_SUBTITLE}<br>
                      © ${new Date().getFullYear()} ${ORG_NAME}. All rights reserved.<br>
                      ${ORG_ADDRESS} | Trusted Healthcare Since 2024
                    </p>
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

    const delivery = await sendEmailServer(normalizedEmail, template)
    await query(`INSERT INTO audit_logs (user_id, action, entity_type, details) VALUES ($1,$2,$3,$4)`, [
      auth.userId,
      "otp_sent",
      "user",
      JSON.stringify({
        email: normalizedEmail,
        provider: delivery.provider,
        messageId: delivery.messageId || null,
        reused: issued.reused,
      }),
    ])

    return NextResponse.json({
      success: true,
      message: issued.reused ? "Active verification code re-sent" : "Verification code sent",
      reused: issued.reused,
      expiresAt: issued.expiresAt.toISOString(),
      delivery: { provider: delivery.provider, messageId: delivery.messageId || null },
    })
  } catch (err: any) {
    if (err?.name === "ZodError") {
      return NextResponse.json({ error: "Invalid email", details: err.issues }, { status: 400 })
    }
    console.error("Error in /api/settings/send-otp:", err)
    const message = String(err?.message || "")
    let reason = "delivery_failed"
    let providerMessage = ""
    if (message.startsWith("PROVIDER_NOT_CONFIGURED:")) {
      reason = "provider_not_configured"
      providerMessage = message.replace("PROVIDER_NOT_CONFIGURED:", "").trim()
    } else if (message.startsWith("RESEND_REJECTED:")) {
      reason = "resend_rejected"
      providerMessage = message.replace("RESEND_REJECTED:", "").trim()
    } else if (message.startsWith("SMTP_FAILED:")) {
      reason = "smtp_failed"
      providerMessage = message.replace("SMTP_FAILED:", "").trim()
    }
    const payload: Record<string, any> = { error: "Failed to send verification code", reason }
    if (providerMessage) payload.providerMessage = providerMessage.slice(0, 280)
    if (process.env.NODE_ENV === "development") payload.details = String(err?.message || "")
    return NextResponse.json(payload, { status: 500 })
  }
}
