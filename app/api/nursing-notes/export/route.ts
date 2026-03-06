import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifyToken, can } from "@/lib/security"
import { query } from "@/lib/db"
import { toCSV } from "@/lib/exports/writers/csv"
import { toXLSX } from "@/lib/exports/writers/xlsx"
import { toPDF } from "@/lib/exports/writers/pdf"
import { writeAuditLog } from "@/lib/audit"
import { formatPatientNumber } from "@/lib/patients"

export const maxDuration = 90

function mapTypeForUi(noteType: string): string {
  const t = (noteType || "").toLowerCase()
  if (t === "intervention") return "Procedure"
  if (t === "assessment") return "Assessment"
  if (t === "medication") return "Medication"
  if (t === "observation") return "Observation"
  return "Other"
}

export async function GET(req: Request) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    const auth = token ? verifyToken(token) : null
    if (!auth || !can(auth.role, "medical", "read")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const url = new URL(req.url)
    const format = (url.searchParams.get("format") || "csv") as "csv" | "xlsx" | "pdf"
    const fromDate = url.searchParams.get("from") || new Date().toISOString().split("T")[0]
    const toDate = url.searchParams.get("to") || new Date().toISOString().split("T")[0]
    const patientId = url.searchParams.get("patientId") || null

    let queryStr = `
      SELECT 
        nn.id,
        nn.patient_id,
        p.patient_number,
        p.first_name,
        p.last_name,
        nn.note_type,
        nn.note,
        nn.created_at,
        u.name AS nurse_name
      FROM nursing_notes nn
      LEFT JOIN patients p ON p.id = nn.patient_id
      LEFT JOIN users u ON u.id = nn.nurse_id
      WHERE DATE(nn.created_at) BETWEEN $1 AND $2
    `
    const params: any[] = [fromDate, toDate]

    if (patientId) {
      queryStr += " AND nn.patient_id = $3"
      params.push(patientId)
    }

    queryStr += " ORDER BY nn.created_at DESC"

    const { rows } = await query(queryStr, params)

    const data = rows.map((r: any) => ({
      "Patient ID": formatPatientNumber(r.patient_number),
      "Patient Name": [r.first_name, r.last_name].filter(Boolean).join(" "),
      "Category": mapTypeForUi(r.note_type),
      "Date": new Date(r.created_at).toISOString().split("T")[0],
      "Time": new Date(r.created_at).toTimeString().slice(0, 5),
      "Note": r.note || "",
      "Recorded By": r.nurse_name || "",
    }))

    const filename = `nursing-notes-${fromDate}-to-${toDate}`

    try {
      await writeAuditLog({
        userId: auth.userId,
        action: "EXPORT",
        entityType: "NursingNote",
        details: {
          category: "EXPORT",
          description: `Exported nursing notes (${format.toUpperCase()})`,
          metadata: { format, fromDate, toDate, patientId, rowCount: data.length },
        },
        ip: "127.0.0.1",
      })
    } catch {}

    if (format === "csv") {
      const csv = toCSV(data)
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="${filename}.csv"`,
        },
      })
    } else if (format === "xlsx") {
      const buf = await toXLSX(data, {
        sheetName: "Nursing Notes",
        title: `Nursing Notes Export (${fromDate} to ${toDate})`,
      })
      return new NextResponse(buf, {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${filename}.xlsx"`,
        },
      })
    } else if (format === "pdf") {
      const origin = new URL(req.url).origin
      const buf = await toPDF(
        {
          title: "Nursing Notes Export",
          subtitle: `${fromDate} to ${toDate}`,
          data,
          columns: Object.keys(data[0] || {}),
        },
        { origin }
      )
      return new NextResponse(buf, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${filename}.pdf"`,
        },
      })
    }

    return NextResponse.json({ error: "Invalid format" }, { status: 400 })
  } catch (e: any) {
    console.error("Export failed:", e)
    return NextResponse.json({ error: "Export failed", details: e.message }, { status: 500 })
  }
}
