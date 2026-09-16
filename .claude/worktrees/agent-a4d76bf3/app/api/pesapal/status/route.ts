import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifyToken, can } from "@/lib/security"
import { getPesapalTransactionStatus } from "@/lib/pesapal"

export async function GET(req: Request) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    const auth = token ? verifyToken(token) : null
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!can(auth.role, "billing", "read") && !can(auth.role, "payments", "read")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const url = new URL(req.url)
    const orderTrackingId = url.searchParams.get("orderTrackingId")
    if (!orderTrackingId) {
      return NextResponse.json({ error: "orderTrackingId required" }, { status: 400 })
    }

    const status = await getPesapalTransactionStatus(orderTrackingId)
    return NextResponse.json(status)
  } catch (err) {
    console.error("[Pesapal] Status error:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to get status" },
      { status: 500 },
    )
  }
}
