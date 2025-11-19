 

import { Resend } from "resend"

// Email configuration from environment variables
const resend = new Resend(process.env.RESEND_API_KEY)

const SMTP_CONFIG = {
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: Number.parseInt(process.env.SMTP_PORT || "465"),
  secure: process.env.SMTP_SECURE === "true",
  from: process.env.SMTP_FROM || "Dayspring HIS <dayspringmedicalcenter@gmail.com>",
  user: process.env.SMTP_USER || "dayspringmedicalcenter@gmail.com",
  pass: process.env.SMTP_PASS || "",
}

// Email Templates
export const emailTemplates = {
  // Welcome email for new users
  welcome: (name: string, email: string, password: string, role: string, verificationCode?: string) => ({
    subject: "Welcome to Dayspring Medical Center HIS",
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
                          <h1 style="margin: 0 0 8px 0; color: #ffffff; font-size: 24px; font-weight: 600;">🏥 Welcome to Dayspring Medical Center</h1>
                          <p style="margin: 0; color: #ffffff; font-size: 16px; opacity: 0.95;">Hospital Information System</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                
                <!-- Content -->
                <tr>
                  <td style="padding: 40px;">
                    <p style="margin: 0 0 16px 0; color: #374151; font-size: 16px; line-height: 24px;">
                      Hello <strong>${name}</strong>,
                    </p>
                    <p style="margin: 0 0 32px 0; color: #374151; font-size: 16px; line-height: 24px;">
                      Your account has been successfully created in the Dayspring Medical Center Hospital Information System. 
                      We're excited to have you join our team!
                    </p>
                    
                    <!-- Credentials Box -->
                    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f0f9ff; border-left: 4px solid #2563eb; border-radius: 8px; padding: 24px; margin: 0 0 24px 0;">
                      <tr>
                        <td>
                          <h3 style="margin: 0 0 16px 0; color: #1e40af; font-size: 18px;">Your Login Credentials</h3>
                          <table width="100%" cellpadding="8" cellspacing="0">
                            <tr>
                              <td style="color: #64748b; font-size: 14px; padding: 8px 0; border-bottom: 1px solid #dbeafe;"><strong>Email:</strong></td>
                              <td style="color: #1e40af; font-size: 14px; padding: 8px 0; border-bottom: 1px solid #dbeafe; font-family: 'Courier New', monospace;">${email}</td>
                            </tr>
                            <tr>
                              <td style="color: #64748b; font-size: 14px; padding: 8px 0; border-bottom: 1px solid #dbeafe;"><strong>Password:</strong></td>
                              <td style="color: #1e40af; font-size: 14px; padding: 8px 0; border-bottom: 1px solid #dbeafe; font-family: 'Courier New', monospace;">${password}</td>
                            </tr>
                            <tr>
                              <td style="color: #64748b; font-size: 14px; padding: 8px 0;"><strong>Role:</strong></td>
                              <td style="color: #1e40af; font-size: 14px; padding: 8px 0;">${role}</td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                    
                    ${verificationCode ? `
                    <!-- Email Verification Code -->
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td align="center" style="padding: 0 0 24px 0;">
                          <div style="background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); border: 2px dashed #0ea5e9; border-radius: 12px; padding: 24px 32px; display: inline-block;">
                            <p style="margin: 0 0 12px 0; color: #0369a1; font-size: 14px; font-weight: 600;">Email Verification Code:</p>
                            <div style="font-size: 36px; font-weight: 700; color: #0369a1; letter-spacing: 8px; font-family: 'Courier New', monospace; line-height: 1.2;">
                              ${verificationCode}
                            </div>
                          </div>
                        </td>
                      </tr>
                    </table>
                    
                    <!-- Verification Instructions -->
                    <table width="100%" cellpadding="16" cellspacing="0" style="background-color: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 8px; margin: 0 0 24px 0;">
                      <tr>
                        <td>
                          <p style="margin: 0 0 8px 0; color: #92400e; font-size: 14px; line-height: 20px; font-weight: 600;">
                            🔐 Email Verification Required:
                          </p>
                          <ul style="margin: 0; color: #92400e; font-size: 14px; line-height: 20px; padding-left: 20px;">
                            <li>Use the code above to verify your email on first login</li>
                            <li>This code expires in 24 hours</li>
                            <li>You must verify your email before accessing the system</li>
                          </ul>
                        </td>
                      </tr>
                    </table>
                    ` : ''}
                    
                    <!-- Security Notice -->
                    <table width="100%" cellpadding="16" cellspacing="0" style="background-color: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 8px; margin: 0 0 24px 0;">
                      <tr>
                        <td>
                          <p style="margin: 0; color: #92400e; font-size: 14px; line-height: 20px;">
                            ⚠️ <strong>Important Security Notice:</strong> Please change your password immediately after your first login. This temporary password should not be shared with anyone.
                          </p>
                        </td>
                      </tr>
                    </table>
                    
                    <!-- CTA Button -->
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td align="center" style="padding: 0 0 24px 0;">
                          <a href="${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}" 
                             style="display: inline-block; background: #2563eb; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600;">
                            Login to Your Account
                          </a>
                        </td>
                      </tr>
                    </table>
                    
                    <!-- Getting Started -->
                    <p style="margin: 0 0 16px 0; color: #374151; font-size: 16px; line-height: 22px; font-weight: 600;">
                      Getting Started:
                    </p>
                    <ol style="margin: 0 0 24px 0; padding-left: 24px; color: #374151; font-size: 14px; line-height: 22px;">
                      <li style="margin: 0 0 8px 0;">Click the button above to access the login page</li>
                      <li style="margin: 0 0 8px 0;">Enter your email and temporary password</li>
                      <li style="margin: 0 0 8px 0;">Change your password in your profile settings</li>
                      <li style="margin: 0;">Explore your dashboard and familiarize yourself with the system</li>
                    </ol>
                    
                    <!-- Support -->
                    <p style="margin: 0; color: #6b7280; font-size: 14px; line-height: 20px;">
                      If you have any questions or need assistance, please contact the Hospital Administrator.
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
                            Wanyange, Uganda | Trusted Healthcare Since 2024
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
    `
  }),

  // Email verification code for new users
  verificationCode: (name: string, code: string) => ({
    subject: "Verify Your Email - Dayspring Medical Center",
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
                          <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">Verify Your Email Address</h1>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Content -->
                <tr>
                  <td style="padding: 40px;">
                    <p style="margin: 0 0 16px 0; color: #374151; font-size: 16px; line-height: 24px;">
                      Hello <strong>${name}</strong>,
                    </p>
                    <p style="margin: 0 0 24px 0; color: #374151; font-size: 16px; line-height: 24px;">
                      Thank you for joining Dayspring Medical Center. To complete your account setup and start using the Hospital Information System, please verify your email address using the code below.
                    </p>

                    <!-- Verification Code Box -->
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td align="center" style="padding: 0 0 32px 0;">
                          <div style="background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); border: 2px dashed #0ea5e9; border-radius: 12px; padding: 24px 32px; display: inline-block;">
                            <p style="margin: 0 0 12px 0; color: #0369a1; font-size: 14px; font-weight: 600;">Your Verification Code:</p>
                            <div style="font-size: 36px; font-weight: 700; color: #0369a1; letter-spacing: 8px; font-family: 'Courier New', monospace; line-height: 1.2;">
                              ${code}
                            </div>
                          </div>
                        </td>
                      </tr>
                    </table>

                    <!-- Instructions Box -->
                    <table width="100%" cellpadding="16" cellspacing="0" style="background-color: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 8px; margin: 0 0 24px 0;">
                      <tr>
                        <td>
                          <p style="margin: 0 0 8px 0; color: #92400e; font-size: 14px; line-height: 20px; font-weight: 600;">
                            🔐 How to verify your email:
                          </p>
                          <ol style="margin: 0; color: #92400e; font-size: 14px; line-height: 22px; padding-left: 20px;">
                            <li style="margin: 0 0 8px 0;">Visit the login page</li>
                            <li style="margin: 0 0 8px 0;">Enter your email and password to sign in</li>
                            <li style="margin: 0;">You'll be prompted to enter this verification code</li>
                          </ol>
                        </td>
                      </tr>
                    </table>

                    <!-- Expiration Notice -->
                    <table width="100%" cellpadding="16" cellspacing="0" style="background-color: #fee2e2; border-left: 4px solid #ef4444; border-radius: 8px; margin: 0 0 24px 0;">
                      <tr>
                        <td>
                          <p style="margin: 0; color: #991b1b; font-size: 14px; line-height: 20px;">
                            ⏰ <strong>Important:</strong> This verification code will expire in <strong>24 hours</strong>. If you don't verify within this time, please contact your administrator to resend the code.
                          </p>
                        </td>
                      </tr>
                    </table>

                    <!-- Security Notice -->
                    <table width="100%" cellpadding="16" cellspacing="0" style="background-color: #fef2f2; border-left: 4px solid #ef4444; border-radius: 8px; margin: 0 0 32px 0;">
                      <tr>
                        <td>
                          <p style="margin: 0; color: #991b1b; font-size: 14px; line-height: 20px;">
                            🔒 <strong>Security Notice:</strong> Never share this verification code with anyone. Our support team will never ask for your verification code.
                          </p>
                        </td>
                      </tr>
                    </table>

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
                            Wanyange, Uganda | Trusted Healthcare Since 2024
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
    `
  }),

  // Password reset request
  passwordReset: (name: string, resetToken: string) => ({
    subject: "Password Reset Request - Dayspring Medical Center",
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
                    <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">🔒 Password Reset Request</h1>
                  </td>
                </tr>
                
                <!-- Content -->
                <tr>
                  <td style="padding: 40px;">
                    <p style="margin: 0 0 16px 0; color: #374151; font-size: 16px; line-height: 24px;">
                      Hello <strong>${name}</strong>,
                    </p>
                    <p style="margin: 0 0 32px 0; color: #374151; font-size: 16px; line-height: 24px;">
                      We received a request to reset your password for your Dayspring Medical Center HIS account. 
                      Click the button below to create a new password.
                    </p>
                    
                    <!-- Reset Button -->
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td align="center" style="padding: 0 0 32px 0;">
                          <a href="${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/reset-password?token=${resetToken}" 
                             style="display: inline-block; background: #2563eb; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600;">
                            Reset Your Password
                          </a>
                        </td>
                      </tr>
                    </table>
                    
                    <!-- Alternative Link -->
                    <table width="100%" cellpadding="16" cellspacing="0" style="background-color: #f0f9ff; border-left: 4px solid #0ea5e9; border-radius: 8px; margin: 0 0 24px 0;">
                      <tr>
                        <td>
                          <p style="margin: 0 0 8px 0; color: #0c4a6e; font-size: 12px; font-weight: 600;">Can't click the button?</p>
                          <p style="margin: 0; color: #0369a1; font-size: 11px; word-break: break-all; font-family: 'Courier New', monospace;">
                            ${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/reset-password?token=${resetToken}
                          </p>
                          <p style="margin: 8px 0 0 0; color: #0c4a6e; font-size: 12px;">This link expires in 1 hour</p>
                        </td>
                      </tr>
                    </table>
                    
                    <!-- Security Notice -->
                    <table width="100%" cellpadding="16" cellspacing="0" style="background-color: #fee2e2; border-left: 4px solid #ef4444; border-radius: 8px; margin: 0 0 24px 0;">
                      <tr>
                        <td>
                          <p style="margin: 0; color: #991b1b; font-size: 14px; line-height: 20px;">
                            ⚠️ <strong>Didn't request this?</strong> If you didn't request a password reset, please ignore this email. Your password will not be changed.
                          </p>
                        </td>
                      </tr>
                    </table>
                    
                    <!-- Security Tips -->
                    <p style="margin: 0 0 16px 0; color: #374151; font-size: 14px; line-height: 22px; font-weight: 600;">
                      For your security:
                    </p>
                    <ul style="margin: 0 0 24px 0; padding-left: 24px; color: #374151; font-size: 14px; line-height: 22px;">
                      <li style="margin: 0 0 8px 0;">This link expires in 1 hour</li>
                      <li style="margin: 0 0 8px 0;">The link can only be used once</li>
                      <li style="margin: 0;">Never share this link with anyone</li>
                    </ul>
                    
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
                            Wanyange, Uganda | Trusted Healthcare Since 2024
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
    `
  }),

  // Password changed confirmation
  passwordChanged: (name: string) => ({
    subject: "Password Changed Successfully - Dayspring Medical Center",
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
                  <td style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 32px 40px; border-radius: 12px 12px 0 0;">
                    <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">✅ Password Changed Successfully</h1>
                  </td>
                </tr>
                
                <!-- Content -->
                <tr>
                  <td style="padding: 40px;">
                    <p style="margin: 0 0 16px 0; color: #374151; font-size: 16px; line-height: 24px;">
                      Hello <strong>${name}</strong>,
                    </p>
                    <p style="margin: 0 0 32px 0; color: #374151; font-size: 16px; line-height: 24px;">
                      Your password has been successfully changed. Your account is now secured with your new password.
                    </p>
                    
                    <!-- Success Box -->
                    <table width="100%" cellpadding="16" cellspacing="0" style="background-color: #d1fae5; border-left: 4px solid #10b981; border-radius: 8px; margin: 0 0 24px 0;">
                      <tr>
                        <td>
                          <p style="margin: 0 0 8px 0; color: #065f46; font-size: 16px; font-weight: 600;">✓ Password Changed Successfully</p>
                          <p style="margin: 0; color: #047857; font-size: 14px;">Date: ${new Date().toLocaleString()}</p>
                        </td>
                      </tr>
                    </table>
                    
                    <!-- Warning Box -->
                    <table width="100%" cellpadding="16" cellspacing="0" style="background-color: #fee2e2; border-left: 4px solid #ef4444; border-radius: 8px; margin: 0 0 24px 0;">
                      <tr>
                        <td>
                          <p style="margin: 0; color: #991b1b; font-size: 14px; line-height: 20px;">
                            ⚠️ <strong>Didn't make this change?</strong> If you did not change your password, please contact the Hospital Administrator immediately. Your account may have been compromised.
                          </p>
                        </td>
                      </tr>
                    </table>
                    
                    <!-- Security Tips -->
                    <p style="margin: 0 0 16px 0; color: #374151; font-size: 14px; line-height: 22px; font-weight: 600;">
                      Security Tips:
                    </p>
                    <ul style="margin: 0 0 24px 0; padding-left: 24px; color: #374151; font-size: 14px; line-height: 22px;">
                      <li style="margin: 0 0 8px 0;">Never share your password with anyone</li>
                      <li style="margin: 0 0 8px 0;">Use a strong, unique password</li>
                      <li style="margin: 0 0 8px 0;">Change your password regularly</li>
                      <li style="margin: 0;">Log out when using shared computers</li>
                    </ul>
                    
                    <!-- Support -->
                    <p style="margin: 0; color: #6b7280; font-size: 14px; line-height: 20px; text-align: center;">
                      Questions? Contact us at 
                      <a href="mailto:support@dayspringhospital.ug" style="color: #10b981; text-decoration: none;">support@dayspringhospital.ug</a>
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
                            Wanyange, Uganda | Trusted Healthcare Since 2024
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
    `
  }),

  // Appointment confirmation
  appointmentConfirmation: (
    patientName: string,
    doctorName: string,
    date: string,
    time: string,
    department: string,
  ) => ({
    subject: "Appointment Confirmation - Dayspring Medical Center",
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
                    <h1 style="margin: 0 0 8px 0; color: #ffffff; font-size: 24px; font-weight: 600;">📅 Appointment Confirmed</h1>
                    <p style="margin: 0; color: #ffffff; font-size: 16px; opacity: 0.95;">Dayspring Medical Center</p>
                  </td>
                </tr>
                
                <!-- Content -->
                <tr>
                  <td style="padding: 40px;">
                    <p style="margin: 0 0 16px 0; color: #374151; font-size: 16px; line-height: 24px;">
                      Hello <strong>${patientName}</strong>,
                    </p>
                    <p style="margin: 0 0 32px 0; color: #374151; font-size: 16px; line-height: 24px;">
                      Your appointment has been successfully scheduled at Dayspring Medical Center. 
                      Please find your appointment details below:
                    </p>
                    
                    <!-- Appointment Details Card -->
                    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f0f9ff; border-left: 4px solid #2563eb; border-radius: 8px; padding: 24px; margin: 0 0 24px 0;">
                      <tr>
                        <td>
                          <h3 style="margin: 0 0 16px 0; color: #1e40af; font-size: 18px;">Appointment Details</h3>
                          <table width="100%" cellpadding="8" cellspacing="0">
                            <tr>
                              <td style="color: #64748b; font-size: 14px; padding: 8px 0; border-bottom: 1px solid #dbeafe;"><strong>Doctor:</strong></td>
                              <td style="color: #1e40af; font-size: 14px; padding: 8px 0; border-bottom: 1px solid #dbeafe;">Dr. ${doctorName}</td>
                            </tr>
                            <tr>
                              <td style="color: #64748b; font-size: 14px; padding: 8px 0; border-bottom: 1px solid #dbeafe;"><strong>Department:</strong></td>
                              <td style="color: #1e40af; font-size: 14px; padding: 8px 0; border-bottom: 1px solid #dbeafe;">${department}</td>
                            </tr>
                            <tr>
                              <td style="color: #64748b; font-size: 14px; padding: 8px 0; border-bottom: 1px solid #dbeafe;"><strong>Date:</strong></td>
                              <td style="color: #1e40af; font-size: 14px; padding: 8px 0; border-bottom: 1px solid #dbeafe;">${date}</td>
                            </tr>
                            <tr>
                              <td style="color: #64748b; font-size: 14px; padding: 8px 0;"><strong>Time:</strong></td>
                              <td style="color: #1e40af; font-size: 14px; padding: 8px 0;">${time}</td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                    
                    <!-- Info Box -->
                    <table width="100%" cellpadding="16" cellspacing="0" style="background-color: #dbeafe; border-left: 4px solid #3b82f6; border-radius: 8px; margin: 0 0 24px 0;">
                      <tr>
                        <td>
                          <p style="margin: 0 0 12px 0; color: #1e3a8a; font-size: 16px; font-weight: 600;">📋 Please Remember:</p>
                          <ul style="margin: 0 0 0 0; padding-left: 24px; color: #1e3a8a; font-size: 14px; line-height: 22px;">
                            <li style="margin: 0 0 6px 0;">Arrive 15 minutes before your appointment time</li>
                            <li style="margin: 0 0 6px 0;">Bring your ID and any relevant medical records</li>
                            <li style="margin: 0;">If you need to reschedule, please contact us at least 24 hours in advance</li>
                          </ul>
                        </td>
                      </tr>
                    </table>
                    
                    <!-- Location -->
                    <p style="margin: 0 0 32px 0; color: #374151; font-size: 14px; line-height: 20px;">
                      <strong>📍 Location:</strong> Dayspring Medical Center<br>
                      <strong>📞 Contact:</strong> +256 XXX XXX XXX
                    </p>
                    
                    <!-- Support -->
                    <p style="margin: 0; color: #6b7280; font-size: 14px; line-height: 20px; text-align: center;">
                      Questions? Contact us at 
                      <a href="mailto:appointments@dayspringhospital.ug" style="color: #2563eb; text-decoration: none;">appointments@dayspringhospital.ug</a>
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
                            Wanyange, Uganda | Trusted Healthcare Since 2024
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
    `
  }),

  // Lab results ready
  labResultsReady: (patientName: string, testName: string) => ({
    subject: "Lab Results Ready - Dayspring Medical Center",
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
                  <td style="background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); padding: 32px 40px; border-radius: 12px 12px 0 0;">
                    <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">🔬 Lab Results Ready</h1>
                  </td>
                </tr>
                
                <!-- Content -->
                <tr>
                  <td style="padding: 40px;">
                    <p style="margin: 0 0 16px 0; color: #374151; font-size: 16px; line-height: 24px;">
                      Hello <strong>${patientName}</strong>,
                    </p>
                    <p style="margin: 0 0 32px 0; color: #374151; font-size: 16px; line-height: 24px;">
                      Your lab test results are now available and ready for collection.
                    </p>
                    
                    <!-- Results Box -->
                    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3e8ff; border-left: 4px solid #8b5cf6; border-radius: 8px; padding: 24px; margin: 0 0 24px 0;">
                      <tr>
                        <td>
                          <h3 style="margin: 0 0 16px 0; color: #6b21a8; font-size: 18px;">Test Information</h3>
                          <table width="100%" cellpadding="8" cellspacing="0">
                            <tr>
                              <td style="color: #64748b; font-size: 14px; padding: 8px 0; border-bottom: 1px solid #d8b4fe;"><strong>Test Name:</strong></td>
                              <td style="color: #6b21a8; font-size: 14px; padding: 8px 0; border-bottom: 1px solid #d8b4fe;">${testName}</td>
                            </tr>
                            <tr>
                              <td style="color: #64748b; font-size: 14px; padding: 8px 0; border-bottom: 1px solid #d8b4fe;"><strong>Status:</strong></td>
                              <td style="color: #10b981; font-size: 14px; padding: 8px 0; border-bottom: 1px solid #d8b4fe;">✓ Completed</td>
                            </tr>
                            <tr>
                              <td style="color: #64748b; font-size: 14px; padding: 8px 0;"><strong>Date:</strong></td>
                              <td style="color: #6b21a8; font-size: 14px; padding: 8px 0;">${new Date().toLocaleDateString()}</td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                    
                    <!-- Important Notice -->
                    <table width="100%" cellpadding="16" cellspacing="0" style="background-color: #dbeafe; border-left: 4px solid #3b82f6; border-radius: 8px; margin: 0 0 24px 0;">
                      <tr>
                        <td>
                          <p style="margin: 0; color: #1e3a8a; font-size: 14px; line-height: 20px;">
                            ⚠️ <strong>Important:</strong> Lab results should be reviewed by a qualified healthcare professional. Please schedule a follow-up appointment with your doctor to discuss your results.
                          </p>
                        </td>
                      </tr>
                    </table>
                    
                    <p style="margin: 0 0 8px 0; color: #374151; font-size: 14px; line-height: 20px;">
                      Please visit the hospital to collect your results or consult with your doctor.
                    </p>
                    
                    <!-- Support -->
                    <p style="margin: 0; color: #6b7280; font-size: 14px; line-height: 20px; text-align: center;">
                      Questions? Contact us at 
                      <a href="mailto:lab@dayspringhospital.ug" style="color: #8b5cf6; text-decoration: none;">lab@dayspringhospital.ug</a>
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
                            Wanyange, Uganda | Trusted Healthcare Since 2024
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
    `
  }),

  // Prescription ready
  prescriptionReady: (patientName: string, medications: string[]) => ({
    subject: "Prescription Ready for Pickup - Dayspring Medical Center",
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
                  <td style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 32px 40px; border-radius: 12px 12px 0 0;">
                    <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">💊 Prescription Ready</h1>
                  </td>
                </tr>
                
                <!-- Content -->
                <tr>
                  <td style="padding: 40px;">
                    <p style="margin: 0 0 16px 0; color: #374151; font-size: 16px; line-height: 24px;">
                      Hello <strong>${patientName}</strong>,
                    </p>
                    <p style="margin: 0 0 32px 0; color: #374151; font-size: 16px; line-height: 24px;">
                      Your prescription has been processed and is ready for pickup at the pharmacy.
                    </p>
                    
                    <!-- Prescription Box -->
                    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f0fdf4; border-left: 4px solid #10b981; border-radius: 8px; padding: 24px; margin: 0 0 24px 0;">
                      <tr>
                        <td>
                          <h3 style="margin: 0 0 16px 0; color: #065f46; font-size: 18px;">Medications Ready</h3>
                          <table width="100%" cellpadding="8" cellspacing="0" style="background-color: #d1fae5; border-radius: 6px; padding: 12px;">
                            <tr>
                              <td>
                                <ul style="margin: 0; padding-left: 24px; color: #065f46; font-size: 14px; line-height: 22px;">
                                  ${medications.map((med) => `<li style="margin: 0 0 6px 0;">${med}</li>`).join("")}
                                </ul>
                              </td>
                            </tr>
                          </table>
                          <p style="margin: 16px 0 0 0; color: #065f46; font-size: 14px;">
                            <strong>📍 Pickup Location:</strong> Dayspring Medical Center Pharmacy<br>
                            <strong>🕒 Pharmacy Hours:</strong> Monday - Friday: 8:00 AM - 6:00 PM | Saturday: 9:00 AM - 2:00 PM
                          </p>
                        </td>
                      </tr>
                    </table>
                    
                    <!-- What to Bring -->
                    <p style="margin: 0 0 16px 0; color: #374151; font-size: 14px; line-height: 22px; font-weight: 600;">
                      Please bring:
                    </p>
                    <ul style="margin: 0 0 24px 0; padding-left: 24px; color: #374151; font-size: 14px; line-height: 22px;">
                      <li style="margin: 0 0 8px 0;">Your payment receipt</li>
                      <li style="margin: 0 0 8px 0;">Valid ID</li>
                      <li style="margin: 0;">Prescription slip (if provided)</li>
                    </ul>
                    
                    <p style="margin: 0 0 32px 0; color: #374151; font-size: 14px; line-height: 20px;">
                      If you have any questions about your medications, our pharmacists are available to assist you.
                    </p>
                    
                    <!-- Support -->
                    <p style="margin: 0; color: #6b7280; font-size: 14px; line-height: 20px; text-align: center;">
                      Questions? Contact us at 
                      <a href="mailto:pharmacy@dayspringhospital.ug" style="color: #10b981; text-decoration: none;">pharmacy@dayspringhospital.ug</a>
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
                            Wanyange, Uganda | Trusted Healthcare Since 2024
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
    `
  }),

  // Payment receipt
  paymentReceipt: (
    patientName: string,
    receiptNumber: string,
    amount: number,
    items: Array<{ description: string; amount: number }>,
  ) => ({
    subject: `Payment Receipt #${receiptNumber} - Dayspring Medical Center`,
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
                    <h1 style="margin: 0 0 8px 0; color: #ffffff; font-size: 24px; font-weight: 600;">🧾 Payment Receipt</h1>
                    <p style="margin: 0; color: #ffffff; font-size: 16px; opacity: 0.95;">Receipt #${receiptNumber}</p>
                  </td>
                </tr>
                
                <!-- Content -->
                <tr>
                  <td style="padding: 40px;">
                    <p style="margin: 0 0 16px 0; color: #374151; font-size: 16px; line-height: 24px;">
                      Hello <strong>${patientName}</strong>,
                    </p>
                    <p style="margin: 0 0 32px 0; color: #374151; font-size: 16px; line-height: 24px;">
                      Thank you for your payment. Please find your payment receipt below.
                    </p>
                    
                    <!-- Receipt Card -->
                    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f0f9ff; border: 2px solid #dbeafe; border-radius: 8px; padding: 24px; margin: 0 0 24px 0;">
                      <tr>
                        <td align="center" style="border-bottom: 2px solid #2563eb; padding-bottom: 16px; margin-bottom: 20px;">
                          <h2 style="margin: 0 0 8px 0; color: #2563eb; font-size: 20px;">Dayspring Medical Center</h2>
                          <p style="margin: 0 0 4px 0; color: #64748b; font-size: 14px;">Official Payment Receipt</p>
                          <p style="margin: 0; color: #9ca3af; font-size: 12px;">Receipt #${receiptNumber}</p>
                        </td>
                      </tr>
                      
                      <!-- Receipt Details -->
                      <tr>
                        <td style="padding: 20px 0 0 0;">
                          <table width="100%" cellpadding="8" cellspacing="0">
                            <tr>
                              <td style="color: #64748b; font-size: 14px; padding: 8px 0; border-bottom: 1px solid #e5e7eb;"><strong>Patient Name:</strong></td>
                              <td style="color: #1e40af; font-size: 14px; padding: 8px 0; border-bottom: 1px solid #e5e7eb; text-align: right;">${patientName}</td>
                            </tr>
                            <tr>
                              <td style="color: #64748b; font-size: 14px; padding: 8px 0; border-bottom: 1px solid #e5e7eb;"><strong>Date:</strong></td>
                              <td style="color: #1e40af; font-size: 14px; padding: 8px 0; border-bottom: 1px solid #e5e7eb; text-align: right;">${new Date().toLocaleString()}</td>
                            </tr>
                            <tr>
                              <td style="color: #64748b; font-size: 14px; padding: 8px 0; border-bottom: 2px solid #dbeafe;"><strong>Payment Method:</strong></td>
                              <td style="color: #1e40af; font-size: 14px; padding: 8px 0; border-bottom: 2px solid #dbeafe; text-align: right;">Cash</td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                      
                      <!-- Items List -->
                      <tr>
                        <td style="padding: 24px 0 0 0;">
                          <h3 style="margin: 0 0 16px 0; color: #1e40af; font-size: 16px;">Items</h3>
                          ${items.map((item) => `
                            <table width="100%" cellpadding="8" cellspacing="0">
                              <tr>
                                <td style="color: #374151; font-size: 14px; padding: 8px 0; border-bottom: 1px solid #e5e7eb;">${item.description}</td>
                                <td style="color: #1e40af; font-size: 14px; padding: 8px 0; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 600;">UGX ${item.amount.toLocaleString()}</td>
                              </tr>
                            </table>
                          `).join("")}
                        </td>
                      </tr>
                      
                      <!-- Total -->
                      <tr>
                        <td style="padding: 16px 0 0 0; border-top: 2px solid #2563eb; margin-top: 16px;">
                          <table width="100%" cellpadding="8" cellspacing="0">
                            <tr>
                              <td style="color: #1e40af; font-size: 18px; font-weight: 700; padding: 12px 0;">TOTAL PAID</td>
                              <td style="color: #2563eb; font-size: 18px; font-weight: 700; padding: 12px 0; text-align: right;">UGX ${amount.toLocaleString()}</td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                    
                    <!-- Thank You Message -->
                    <p style="margin: 0 0 8px 0; color: #374151; font-size: 16px; line-height: 24px; text-align: center;">
                      Thank you for choosing Dayspring Medical Center
                    </p>
                    <p style="margin: 0 0 32px 0; color: #64748b; font-size: 14px; text-align: center;">
                      Please keep this receipt for your records
                    </p>
                    
                    <!-- Support -->
                    <p style="margin: 0; color: #6b7280; font-size: 14px; line-height: 20px; text-align: center;">
                      Questions? Contact us at 
                      <a href="mailto:billing@dayspringhospital.ug" style="color: #2563eb; text-decoration: none;">billing@dayspringhospital.ug</a>
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
                            Wanyange, Uganda | Trusted Healthcare Since 2024
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
    `
  }),

  // Low stock alert
  lowStockAlert: (medicationName: string, currentStock: number, reorderLevel: number) => ({
    subject: `⚠️ Low Stock Alert: ${medicationName} - Dayspring Medical Center`,
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
                  <td style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 32px 40px; border-radius: 12px 12px 0 0;">
                    <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">⚠️ Low Stock Alert</h1>
                  </td>
                </tr>
                
                <!-- Content -->
                <tr>
                  <td style="padding: 40px;">
                    <p style="margin: 0 0 16px 0; color: #374151; font-size: 16px; line-height: 24px;">
                      Hello,
                    </p>
                    <p style="margin: 0 0 32px 0; color: #374151; font-size: 16px; line-height: 24px;">
                      This is an automated alert from the Dayspring Medical Center inventory management system.
                    </p>
                    
                    <!-- Alert Box -->
                    <table width="100%" cellpadding="20" cellspacing="0" style="background-color: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 8px; margin: 0 0 24px 0;">
                      <tr>
                        <td>
                          <h2 style="margin: 0 0 8px 0; color: #d97706; font-size: 18px;">Immediate Action Required</h2>
                          <p style="margin: 0; color: #92400e; font-size: 14px; line-height: 20px;">
                            The following medication has reached low stock levels and requires immediate reordering.
                          </p>
                        </td>
                      </tr>
                    </table>
                    
                    <!-- Stock Info -->
                    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 8px; padding: 24px; margin: 0 0 24px 0;">
                      <tr>
                        <td>
                          <h3 style="margin: 0 0 16px 0; color: #d97706; font-size: 18px;">Medication Details</h3>
                          <table width="100%" cellpadding="8" cellspacing="0">
                            <tr>
                              <td style="color: #92400e; font-size: 14px; padding: 8px 0; border-bottom: 1px solid #fde68a;"><strong>Medication:</strong></td>
                              <td style="color: #92400e; font-size: 14px; padding: 8px 0; border-bottom: 1px solid #fde68a; font-weight: 600;">${medicationName}</td>
                            </tr>
                            <tr>
                              <td style="color: #92400e; font-size: 14px; padding: 8px 0; border-bottom: 1px solid #fde68a;"><strong>Current Stock:</strong></td>
                              <td style="color: #dc2626; font-size: 14px; padding: 8px 0; border-bottom: 1px solid #fde68a; font-weight: 600;">${currentStock} units</td>
                            </tr>
                            <tr>
                              <td style="color: #92400e; font-size: 14px; padding: 8px 0; border-bottom: 1px solid #fde68a;"><strong>Reorder Level:</strong></td>
                              <td style="color: #92400e; font-size: 14px; padding: 8px 0; border-bottom: 1px solid #fde68a; font-weight: 600;">${reorderLevel} units</td>
                            </tr>
                            <tr>
                              <td style="color: #92400e; font-size: 14px; padding: 8px 0;"><strong>Status:</strong></td>
                              <td style="color: #dc2626; font-size: 14px; padding: 8px 0; font-weight: 700;">⚠️ LOW STOCK</td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                    
                    <!-- Action Required -->
                    <p style="margin: 0 0 16px 0; color: #374151; font-size: 14px; line-height: 22px; font-weight: 600;">
                      Action Required:
                    </p>
                    <ul style="margin: 0 0 24px 0; padding-left: 24px; color: #374151; font-size: 14px; line-height: 22px;">
                      <li style="margin: 0 0 8px 0;">Review current stock levels in the pharmacy system</li>
                      <li style="margin: 0 0 8px 0;">Place an order with the supplier immediately</li>
                      <li style="margin: 0 0 8px 0;">Update the inventory once new stock arrives</li>
                      <li style="margin: 0;">Consider increasing reorder levels if this occurs frequently</li>
                    </ul>
                    
                    <p style="margin: 0 0 32px 0; color: #991b1b; font-size: 14px; line-height: 20px;">
                      Please address this issue as soon as possible to avoid stock-outs that could affect patient care.
                    </p>
                    
                    <!-- Support -->
                    <p style="margin: 0; color: #6b7280; font-size: 14px; line-height: 20px; text-align: center;">
                      Questions? Contact us at 
                      <a href="mailto:inventory@dayspringhospital.ug" style="color: #f59e0b; text-decoration: none;">inventory@dayspringhospital.ug</a>
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
                            Wanyange, Uganda | Trusted Healthcare Since 2024
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
    `
  }),

  // Email change notification (to old email)
  emailChanged: (name: string, oldEmail: string, newEmail: string) => ({
    subject: "Email Address Changed - Dayspring Medical Center",
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
                  <td style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 32px 40px; border-radius: 12px 12px 0 0;">
                    <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">⚠️ Email Address Changed</h1>
                  </td>
                </tr>
                
                <!-- Content -->
                <tr>
                  <td style="padding: 40px;">
                    <p style="margin: 0 0 16px 0; color: #374151; font-size: 16px; line-height: 24px;">
                      Hello <strong>${name}</strong>,
                    </p>
                    <p style="margin: 0 0 32px 0; color: #374151; font-size: 16px; line-height: 24px;">
                      We're writing to inform you that the email address associated with your Dayspring Medical Center account has been changed.
                    </p>
                    
                    <!-- Change Notification Box -->
                    <table width="100%" cellpadding="16" cellspacing="0" style="background-color: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 8px; margin: 0 0 24px 0;">
                      <tr>
                        <td>
                          <p style="margin: 0 0 8px 0; color: #92400e; font-size: 16px; font-weight: 600;">Email Address Change</p>
                          <p style="margin: 0; color: #92400e; font-size: 14px;">Old Email: ${oldEmail}</p>
                          <p style="margin: 4px 0 0 0; color: #92400e; font-size: 14px;">New Email: ${newEmail}</p>
                          <p style="margin: 4px 0 0 0; color: #92400e; font-size: 14px;">Date: ${new Date().toLocaleString()}</p>
                        </td>
                      </tr>
                    </table>
                    
                    <!-- Security Warning -->
                    <table width="100%" cellpadding="16" cellspacing="0" style="background-color: #fee2e2; border-left: 4px solid #ef4444; border-radius: 8px; margin: 0 0 24px 0;">
                      <tr>
                        <td>
                          <p style="margin: 0 0 8px 0; color: #991b1b; font-size: 14px; line-height: 20px; font-weight: 600;">
                            🔒 Security Notice
                          </p>
                          <p style="margin: 0; color: #991b1b; font-size: 14px; line-height: 20px;">
                            If you did NOT request this change, please contact our system administrator immediately. Your account may have been compromised. Do not use the new email address to log in until you have verified this change was authorized by you.
                          </p>
                        </td>
                      </tr>
                    </table>
                    
                    <!-- What You Need to Know -->
                    <p style="margin: 0 0 16px 0; color: #374151; font-size: 14px; line-height: 22px; font-weight: 600;">
                      What this means:
                    </p>
                    <ul style="margin: 0 0 24px 0; padding-left: 24px; color: #374151; font-size: 14px; line-height: 22px;">
                      <li style="margin: 0 0 8px 0;">Your account email address has been changed from <strong>${oldEmail}</strong> to <strong>${newEmail}</strong></li>
                      <li style="margin: 0 0 8px 0;">You will no longer receive notifications at this email address</li>
                      <li style="margin: 0 0 8px 0;">All future logins must use your new email address</li>
                      <li style="margin: 0;">If you authorized this change, no further action is needed</li>
                    </ul>
                    
                    <!-- Support -->
                    <p style="margin: 0; color: #6b7280; font-size: 14px; line-height: 20px; text-align: center;">
                      Need help? Contact us immediately at 
                      <a href="mailto:support@dayspringhospital.ug" style="color: #f59e0b; text-decoration: none; font-weight: 600;">support@dayspringhospital.ug</a>
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
                            Wanyange, Uganda | Trusted Healthcare Since 2024
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
  }),

  // Email verification successful
  emailVerified: (name: string, newEmail: string) => ({
    subject: "Email Verified Successfully - Dayspring Medical Center",
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
                  <td style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 32px 40px; border-radius: 12px 12px 0 0;">
                    <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">✅ Email Verified Successfully</h1>
                  </td>
                </tr>
                
                <!-- Content -->
                <tr>
                  <td style="padding: 40px;">
                    <p style="margin: 0 0 16px 0; color: #374151; font-size: 16px; line-height: 24px;">
                      Hello <strong>${name}</strong>,
                    </p>
                    <p style="margin: 0 0 32px 0; color: #374151; font-size: 16px; line-height: 24px;">
                      Your email address has been successfully verified and updated. You can now use your new email address to log in to your Dayspring Medical Center account.
                    </p>
                    
                    <!-- Success Box -->
                    <table width="100%" cellpadding="16" cellspacing="0" style="background-color: #d1fae5; border-left: 4px solid #10b981; border-radius: 8px; margin: 0 0 24px 0;">
                      <tr>
                        <td>
                          <p style="margin: 0 0 8px 0; color: #065f46; font-size: 16px; font-weight: 600;">✓ Email Verified Successfully</p>
                          <p style="margin: 0; color: #047857; font-size: 14px;">New Email: ${newEmail}</p>
                          <p style="margin: 4px 0 0 0; color: #047857; font-size: 14px;">Verified: ${new Date().toLocaleString()}</p>
                        </td>
                      </tr>
                    </table>
                    
                    <!-- What Happens Next -->
                    <p style="margin: 0 0 16px 0; color: #374151; font-size: 14px; line-height: 22px; font-weight: 600;">
                      What happens next:
                    </p>
                    <ul style="margin: 0 0 24px 0; padding-left: 24px; color: #374151; font-size: 14px; line-height: 22px;">
                      <li style="margin: 0 0 8px 0;">You can now log in using your new email address: ${newEmail}</li>
                      <li style="margin: 0 0 8px 0;">All future notifications will be sent to this email address</li>
                      <li style="margin: 0;">Your account security remains unchanged</li>
                    </ul>
                    
                    <!-- Security Notice -->
                    <table width="100%" cellpadding="16" cellspacing="0" style="background-color: #fee2e2; border-left: 4px solid #ef4444; border-radius: 8px; margin: 0 0 24px 0;">
                      <tr>
                        <td>
                          <p style="margin: 0; color: #991b1b; font-size: 14px; line-height: 20px;">
                            ⚠️ <strong>Didn't make this change?</strong> If you did not verify your email, please contact the system administrator immediately. Your account may have been compromised.
                          </p>
                        </td>
                      </tr>
                    </table>
                    
                    <!-- Support -->
                    <p style="margin: 0; color: #6b7280; font-size: 14px; line-height: 20px; text-align: center;">
                      Questions? Contact us at 
                      <a href="mailto:support@dayspringhospital.ug" style="color: #10b981; text-decoration: none;">support@dayspringhospital.ug</a>
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
                            Wanyange, Uganda | Trusted Healthcare Since 2024
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
  }),
}

import nodemailer from "nodemailer"

// SMTP configuration from environment variables
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: Number.parseInt(process.env.SMTP_PORT || "465"),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER || "dayspringmedicalcenter@gmail.com",
    pass: process.env.SMTP_PASS || "",
  },
})

// Server-side email sending function (for use in API routes)
export async function sendEmailServer(to: string, template: { subject: string; html: string }) {
  try {
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || "Dayspring HIS <dayspringmedicalcenter@gmail.com>",
      to,
      subject: template.subject,
      html: template.html,
    })
    return { success: true, messageId: info.messageId }
  } catch (error) {
    console.error("[v0] Email sending error:", error)
    return { success: false, error }
  }
}

// Email sending function (using native fetch since we can't use nodemailer in browser)
export async function sendEmail(to: string, template: { subject: string; html: string }) {
  try {
    // In a real implementation, this would call your backend API endpoint
    // that uses nodemailer with your SMTP configuration
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
    const response = await fetch(`${baseUrl}/api/send-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to,
        subject: template.subject,
        html: template.html,
      }),
    })

    if (!response.ok) {
      throw new Error("Failed to send email")
    }

    return { success: true }
  } catch (error) {
    console.error("[v0] Email sending error:", error)
    return { success: false, error }
  }
}

// Helper functions for common email scenarios
export async function sendWelcomeEmail(user: { name: string; email: string; password: string; role: string }) {
  const template = emailTemplates.welcome(user.name, user.email, user.password, user.role)
  return sendEmail(user.email, template)
}

export async function sendPasswordResetEmail(user: { name: string; email: string }, resetToken: string) {
  const template = emailTemplates.passwordReset(user.name, resetToken)
  return sendEmail(user.email, template)
}

export async function sendPasswordChangedEmail(user: { name: string; email: string }) {
  const template = emailTemplates.passwordChanged(user.name)
  return sendEmail(user.email, template)
}

export async function sendAppointmentConfirmation(
  patient: { name: string; email: string },
  appointment: { doctorName: string; date: string; time: string; department: string },
) {
  const template = emailTemplates.appointmentConfirmation(
    patient.name,
    appointment.doctorName,
    appointment.date,
    appointment.time,
    appointment.department,
  )
  return sendEmail(patient.email, template)
}

export async function sendLabResultsNotification(patient: { name: string; email: string }, testName: string) {
  const template = emailTemplates.labResultsReady(patient.name, testName)
  return sendEmail(patient.email, template)
}

export async function sendPrescriptionReadyNotification(
  patient: { name: string; email: string },
  medications: string[],
) {
  const template = emailTemplates.prescriptionReady(patient.name, medications)
  return sendEmail(patient.email, template)
}

export async function sendPaymentReceipt(
  patient: { name: string; email: string },
  receipt: { number: string; amount: number; items: Array<{ description: string; amount: number }> },
) {
  const template = emailTemplates.paymentReceipt(patient.name, receipt.number, receipt.amount, receipt.items)
  return sendEmail(patient.email, template)
}

export async function sendLowStockAlert(medication: { name: string; currentStock: number; reorderLevel: number }) {
  const adminEmail = process.env.NOTIFY_TO || "dayspringmedicalcenter@gmail.com"
  const template = emailTemplates.lowStockAlert(medication.name, medication.currentStock, medication.reorderLevel)
  return sendEmail(adminEmail, template)
}

export function buildDepartmentNotificationEmail(department: string, title: string, message: string, payload?: any): { subject: string; html: string } {
  const subject = `New Department Notification - ${department}`
  const payloadHtml = payload ? `<pre style="background:#F3F4F6; padding:16px; border-radius:8px; color:#111827; font-size:12px; overflow:auto;">${JSON.stringify(payload, null, 2)}</pre>` : ''
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin:0; padding:0; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif; background-color:#f5f7fa;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f7fa; padding:40px 20px;">
        <tr><td align="center">
          <table width="100%" cellpadding="0" cellspacing="0" style="max-width:640px; background-color:#ffffff; border-radius:12px; box-shadow:0 4px 6px rgba(0,0,0,0.05);">
            <tr>
              <td style="background:linear-gradient(135deg,#2563eb 0%,#1d4ed8 100%); padding:24px 32px; border-radius:12px 12px 0 0;">
                <h1 style="margin:0; color:#ffffff; font-size:20px; font-weight:600;">Dayspring Medical Center</h1>
                <p style="margin:4px 0 0 0; color:#e0e7ff; font-size:13px;">Hospital Information System - ${department}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:32px; color:#111827;">
                <h2 style="margin:0 0 8px 0; font-size:18px;">${title}</h2>
                <p style="margin:0 0 16px 0; color:#374151; font-size:14px; line-height:22px;">${message}</p>
                ${payloadHtml}
              </td>
            </tr>
            <tr>
              <td style="background-color:#f9fafb; padding:16px 32px; border-radius:0 0 12px 12px; border-top:1px solid #e5e7eb; color:#6b7280; font-size:12px;">
                Dayspring Medical Center - Information System
              </td>
            </tr>
          </table>
        </td></tr>
      </table>
    </body>
    </html>`
  return { subject, html }
}

