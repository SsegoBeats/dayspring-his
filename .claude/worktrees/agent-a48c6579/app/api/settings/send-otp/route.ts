import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifyToken } from "@/lib/security"
import { z } from "zod"
import { query } from "@/lib/db"
import { sendEmailServer } from "@/lib/email-service"
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

    const template = {
      subject: isInitialVerification
        ? `Verify Your Email - ${ORG_NAME}`
        : `Email Verification Code - ${ORG_NAME}`,
      html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f7fa; mso-line-height-rule: exactly;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f7fa; mso-line-height-rule: exactly; padding: 40px 20px;">
          <tr>
            <td align="center">
              <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-collapse: collapse; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
                <tr>
                  <td style="background-color: #2563eb; background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); padding: 32px 40px; border-radius: 12px 12px 0 0;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td>
                          <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">${isInitialVerification ? "Verify Your Email" : "Email Verification Code"}</h1>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 40px;">
                    <p style="margin: 0 0 16px 0; color: #374151; font-size: 16px; line-height: 24px;">
                      Hello <strong>${userName}</strong>,
                    </p>
                    <p style="margin: 0 0 24px 0; color: #374151; font-size: 16px; line-height: 24px;">
                      ${isInitialVerification
                        ? `To complete your ${ORG_NAME} account setup, please verify your email address using the code below.`
                        : `We received a request to change your email address for your ${ORG_NAME} account. To complete this change, please use the verification code below:`}
                    </p>

                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td align="center" style="padding: 0 0 32px 0;">
                          <div style="background-color: #f0f9ff; background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); border: 2px dashed #0ea5e9; border-radius: 12px; padding: 24px 32px; display: inline-block;">
                            <div style="font-size: 36px; font-weight: 700; color: #0369a1; letter-spacing: 8px; font-family: 'Courier New', monospace; line-height: 1.2;">
                              ${otp}
                            </div>
                          </div>
                        </td>
                      </tr>
                    </table>

                    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 8px; margin: 0 0 24px 0; padding: 16px;">
                      <tr>
                        <td>
                          <p style="margin: 0; color: #92400e; font-size: 14px; line-height: 20px;">
                            <strong>Important:</strong> This verification code will expire in <strong>10 minutes</strong> for your security.
                          </p>
                        </td>
                      </tr>
                    </table>

                    <p style="margin: 0 0 16px 0; color: #374151; font-size: 14px; line-height: 22px;">
                      Here's what to do next:
                    </p>
                    <ul style="margin: 0 0 24px 0; padding-left: 24px; color: #374151; font-size: 14px; line-height: 22px;">
                      <li style="margin: 0 0 8px 0;">Enter the 6-digit code above in the verification field</li>
                      <li style="margin: 0 0 8px 0;">${isInitialVerification ? "Your account will be verified and you can continue using the system." : "Your email address will be updated immediately upon verification."}</li>
                      <li style="margin: 0;">For your security, this code can only be used once</li>
                    </ul>

                    <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; border-radius: 8px; padding: 16px; margin: 0 0 32px 0;">
                      <p style="margin: 0; color: #991b1b; font-size: 14px; line-height: 20px;">
                        <strong>Security Notice:</strong> If you didn't request this email change, please ignore this message and contact our support team immediately. Your account remains secure.
                      </p>
                    </div>

                    <p style="margin: 0; color: #6b7280; font-size: 14px; line-height: 20px; text-align: center;">
                      Need help? Contact our support team at
                      <a href="mailto:${ORG_EMAIL}" style="color: #2563eb; text-decoration: none;"> ${ORG_EMAIL}</a>
                    </p>
                  </td>
                </tr>

                <tr>
                  <td style="background-color: #f9fafb; padding: 24px 40px; border-radius: 0 0 12px 12px; border-top: 1px solid #e5e7eb;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td align="center">
                          <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 12px; line-height: 18px;">
                            ${ORG_NAME} - ${ORG_SUBTITLE}
                          </p>
                          <p style="margin: 0; color: #9ca3af; font-size: 11px; line-height: 16px;">
                            (c) ${new Date().getFullYear()} ${ORG_NAME}. All rights reserved.
                          </p>
                          <p style="margin: 8px 0 0 0; color: #9ca3af; font-size: 11px; line-height: 16px;">
                            ${ORG_ADDRESS} | Trusted Healthcare Since 2024
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
