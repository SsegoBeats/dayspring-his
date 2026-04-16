import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifyToken } from "@/lib/security"
import { query } from "@/lib/db"
import { writeAuditLog } from "@/lib/audit"

export async function PATCH(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const payload = await verifyToken(token)
    if (!payload || payload.role !== "Hospital Admin") {
      return NextResponse.json({ error: "Only Hospital Admins can mark summaries as printed" }, { status: 403 })
    }

    const result = await query<{ id: string; status: string }>(
      `UPDATE patient_summaries SET status = 'printed' WHERE id = $1 AND status = 'pending_print' RETURNING id, status`,
      [params.id]
    )
    if (!result.rows[0]) {
      return NextResponse.json({ error: "Summary not found or already printed" }, { status: 404 })
    }

    await writeAuditLog({
      userId: payload.sub,
      action: "SUMMARY_PRINTED",
      entityType: "PatientSummary",
      entityId: params.id,
      details: { category: "CLINICAL" },
    })

    return NextResponse.json({ id: params.id, status: "printed" })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to mark as printed"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
