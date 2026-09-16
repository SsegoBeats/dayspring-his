import { NextResponse } from "next/server"

export async function GET() {
  const spec = {
    openapi: "3.0.0",
    info: { title: "Dayspring HIS API", version: "1.0.0" },
    paths: {
      "/api/patients": { get: { summary: "List patients" } },
      "/api/appointments": { post: { summary: "Create appointment" } },
      "/api/appointments/list": { get: { summary: "List appointments" } },
      "/api/appointments/slots": { get: { summary: "Get available slots" } },
      "/api/billing": { get: { summary: "List bills" } },
      "/api/medical": { get: { summary: "Medical data" } },
      "/api/pharmacy/medications": { get: { summary: "Medications" } },
      "/api/auth/login": { post: { summary: "Login" } },
      "/api/auth/logout": { post: { summary: "Logout" } },
      "/api/auth/me": { get: { summary: "Current user" } },
      "/api/settings": { get: { summary: "Get settings" }, post: { summary: "Update settings" } },
      "/api/settings/change-email": { post: { summary: "Request email verification" } },
      "/api/settings/verify-email": { get: { summary: "Verify email" } },
      "/api/jobs/enqueue": { post: { summary: "Enqueue job" } },
      "/api/jobs/run": { post: { summary: "Run job worker" } },
      "/api/send-email": { post: { summary: "Send email" } },
    },
  }
  return NextResponse.json(spec)
}


