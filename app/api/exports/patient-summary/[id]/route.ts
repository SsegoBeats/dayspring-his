import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifyToken } from "@/lib/security"
import { query } from "@/lib/db"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const payload = await verifyToken(token)
    if (!payload || !["Hospital Admin", "Clinician"].includes(payload.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const result = await query<{ pdf_data: Buffer; patient_number: string; status: string }>(
      `SELECT ps.pdf_data, p.patient_number, ps.status
       FROM patient_summaries ps
       JOIN patients p ON p.id = ps.patient_id
       WHERE ps.id = $1`,
      [id]
    )
    if (!result.rows[0]) return NextResponse.json({ error: "Summary not found" }, { status: 404 })

    const { pdf_data, patient_number } = result.rows[0]
    return new NextResponse(new Uint8Array(pdf_data as Buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="summary-${patient_number}.pdf"`,
      },
    })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to fetch summary"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
