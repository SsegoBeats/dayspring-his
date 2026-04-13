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
        vs.id,
        vs.patient_id,
        p.patient_number,
        p.first_name,
        p.last_name,
        p.date_of_birth,
        vs.blood_pressure_systolic,
        vs.blood_pressure_diastolic,
        vs.heart_rate,
        vs.temperature,
        vs.respiratory_rate,
        vs.oxygen_saturation,
        vs.weight,
        vs.height,
        vs.notes,
        COALESCE(vs.recorded_at, NOW()) AS recorded_at,
        u.name AS nurse_name
      FROM vital_signs vs
      LEFT JOIN patients p ON p.id = vs.patient_id
      LEFT JOIN users u ON u.id = vs.nurse_id
      WHERE DATE(COALESCE(vs.recorded_at, NOW())) BETWEEN $1 AND $2
    `
    const params: any[] = [fromDate, toDate]

    if (patientId) {
      queryStr += " AND vs.patient_id = $3"
      params.push(patientId)
    }

    queryStr += " ORDER BY vs.recorded_at DESC"

    const { rows } = await query(queryStr, params)

    const data = rows.map((r: any) => ({
      "Patient ID": formatPatientNumber(r.patient_number),
      "Patient Name": [r.first_name, r.last_name].filter(Boolean).join(" "),
      "Date": new Date(r.recorded_at).toISOString().split("T")[0],
      "Time": new Date(r.recorded_at).toTimeString().slice(0, 5),
      "Blood Pressure": r.blood_pressure_systolic && r.blood_pressure_diastolic
        ? `${r.blood_pressure_systolic}/${r.blood_pressure_diastolic}`
        : r.blood_pressure_systolic ? String(r.blood_pressure_systolic) : "",
      "Temperature (C)": r.temperature != null ? Number(r.temperature).toFixed(1) : "",
      "Heart Rate (bpm)": r.heart_rate != null ? String(r.heart_rate) : "",
      "Respiratory Rate (/min)": r.respiratory_rate != null ? String(r.respiratory_rate) : "",
      "Oxygen Saturation (%)": r.oxygen_saturation != null ? String(r.oxygen_saturation) : "",
      "Weight (kg)": r.weight != null ? Number(r.weight).toFixed(1) : "",
      "Height (cm)": r.height != null ? Number(r.height).toFixed(0) : "",
      "Notes": r.notes || "",
      "Recorded By": r.nurse_name || "",
    }))

    const filename = `vitals-${fromDate}-to-${toDate}`
    const exportTimestamp = new Date().toISOString()
    const exportMeta = {
      From: fromDate,
      To: toDate,
      "Row Count": String(data.length),
      ...(patientId ? { "Patient Filter": patientId } : {}),
    }

    try {
      await writeAuditLog({
        userId: auth.userId,
        action: "EXPORT",
        entityType: "VitalSigns",
        details: {
          category: "EXPORT",
          description: `Exported vital signs (${format.toUpperCase()})`,
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
        meta: {
          title: "Vital Signs Export",
          exportedBy: auth.userId,
          timestamp: exportTimestamp,
        },
        extraInfo: exportMeta,
        headerTitle: "Vital Signs Export",
        headerSubtitle: `${fromDate} to ${toDate}`,
      })
      return new NextResponse(buf, {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${filename}.xlsx"`,
        },
      })
    } else if (format === "pdf") {
      const buf = await toPDF(
        "Vital Signs Export",
        data,
        { userId: auth.userId, timestamp: exportTimestamp },
        true,
        {
          subtitle: `${fromDate} to ${toDate}`,
          meta: exportMeta,
        },
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

