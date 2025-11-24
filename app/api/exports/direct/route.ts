import { NextResponse } from "next/server"



import { cookies } from "next/headers"
import { z } from "zod"
import { verifyToken, can } from "@/lib/security"
import { Datasets } from "@/lib/exports/registry"
import { redactRow } from "@/lib/redaction"
import { toCSV } from "@/lib/exports/writers/csv"
import { toXLSX } from "@/lib/exports/writers/xlsx"
import { writeAuditLog } from "@/lib/audit"
import { toPDF } from "@/lib/exports/writers/pdf"
import { query } from "@/lib/db"
const Schema = z.object({
  dataset: z.enum([
    "appointments",
    "labs",
    "billing",
    "patients",
    "radiology",
    "pharmacy",
    "bed_assignments",
    "payments",
    "reception_register",
    "reception_register_detailed",
    "queue_events",
    "reception_dashboard",
    "reception_daily",
    "obstetrics",
    "dental",
  ]),
  format: z.enum(["csv", "xlsx", "pdf", "ndjson"]).default("csv"),
  filters: z.record(z.any()),
  columns: z.array(z.string()).optional(),
  redaction_profile: z.string().default("default"),
})

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    const auth = token ? verifyToken(token) : null
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await req.json()
    const input = Schema.parse(body)
    if (!can(auth.role, "exports", "create")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const ds = Datasets[input.dataset]
    const parsedFilters = ds.validateFilters(input.filters)
    // Resolve requestor full name
    let requestedBy = auth.email
    // Load user currency for formatting/meta
    let currency = 'UGX'
    try {
      const { rows } = await query('SELECT name FROM users WHERE id = $1', [auth.userId])
      if (rows?.[0]?.name) requestedBy = `${rows[0].name} <${auth.email}>`
    } catch {}
    try {
      const { rows } = await query(`SELECT currency FROM user_settings WHERE user_id = $1`, [auth.userId])
      if (rows?.[0]?.currency) currency = rows[0].currency
    } catch {}
    const toDate = (d?: string) => (d ? new Date(d).toLocaleDateString('en-GB') : '-')
    const extraInfoBase: Record<string,string> | undefined = (() => {
      const f: any = parsedFilters || {}
      const info: Record<string,string> = {}
      if (f.from || f.to) info['Period'] = `${toDate(f.from)} – ${toDate(f.to)}`
      if (typeof f.status === 'string' && f.status) info['Status'] = f.status
      if (input.dataset === 'bed_assignments' && f.ward) info['Ward'] = f.ward
      if (input.dataset === 'payments' && typeof f.method === 'string' && f.method) info['Method'] = f.method
      if ((input.dataset === 'reception_register' || input.dataset === 'reception_register_detailed' || input.dataset === 'queue_events' || input.dataset === 'reception_dashboard') && typeof f.department === 'string' && f.department) info['Department'] = f.department
      if (input.dataset === 'reception_register' && typeof f.department === 'string' && f.department) info['Department'] = f.department
      info['Currency'] = currency
      info['Email'] = "dayspringmedicalcenter@gmail.com"
      info['Tel'] = "+256 703-942-230 / +256 703-844-396 / +256 742-918-253"
      info['Requested By'] = requestedBy
      info['Organization'] = 'Dayspring Medical Center'
      return Object.keys(info).length ? info : undefined
    })()

    // Pull all rows in-memory (suitable for small exports)
    const rows: any[] = []
    let cursor: any = undefined
    do {
      const page = await ds.queryPage({ userId: auth.userId, role: auth.role }, parsedFilters, cursor, 5000)
      const redacted = page.rows.map((r) => redactRow(r, input.redaction_profile))
      for (const r of redacted) rows.push(input.columns && input.columns.length ? input.columns.reduce((acc: any, k: string) => ((acc[k] = (r as any)[k]), acc), {}) : r)
      cursor = page.nextCursor
    } while (cursor)

    const filename = `${input.dataset}-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.${input.format}`

    switch (input.format) {
      case "csv": {
        const headerMap: Record<string,string> | undefined = (() => {
          if (input.dataset === 'payments') {
            return { amount: `Amount (${currency})` }
          }
          if (input.dataset === 'reception_register') {
            return undefined
          }
          return undefined
        })()
        const buf = Buffer.from(toCSV(rows, true, { columns: input.columns && input.columns.length ? input.columns : ds.defaultColumns, headerMap }))
        try {
          await writeAuditLog({
            userId: auth.userId,
            action: "EXPORT",
            entityType: "Export",
            details: {
              category: "SYSTEM",
              description: `Exported ${input.dataset} as CSV (${rows.length} rows)`,
              metadata: { dataset: input.dataset, format: "csv", rowCount: rows.length, filters: parsedFilters, columns: input.columns || null, requestedBy }
            },
            ip: "127.0.0.1"
          })
        } catch {}
        const res = new NextResponse(buf)
        res.headers.set("Content-Type", "text/csv")
        res.headers.set("Content-Disposition", `attachment; filename=${filename}`)
        return res
      }
      case "xlsx": {
        // Try embed logo as transparent background and add branded header
        let logoDataUrl: string | undefined = undefined
        try {
          const origin = new URL(req.url).origin
          const safeLogoUrl = `${origin}/logo0.png`
          const r = await fetch(safeLogoUrl)
          if (r.ok) {
            const ct = r.headers.get("content-type") || "image/png"
            const ab = await r.arrayBuffer()
            const b = Buffer.from(ab)
            logoDataUrl = `data:${ct};base64,${b.toString("base64")}`
          }
        } catch {}
        // Enrich extraInfo for reception register with quick totals
        let extraInfo = extraInfoBase
        try {
          if (input.dataset === 'reception_register') {
            const mk = (m: string) => rows.find((r:any) => r.section === 'Check-ins' && r.metric === m)?.value
            const qk = (m: string) => rows.find((r:any) => r.section === 'Queue' && r.metric === m)?.value
            const pk = (m: string) => rows.find((r:any) => r.section === 'Payments' && r.metric === m)?.value
            const kpi = (m: string) => rows.find((r:any) => r.section === 'KPIs' && r.metric === m)?.value
            extraInfo = {
              ...(extraInfoBase || {}),
              'Check-ins Total': String(mk('Total') ?? ''),
              'Arrived': String(mk('Arrived') ?? ''),
              'With Nurse': String(mk('With Nurse') ?? ''),
              'In Room': String(mk('In Room') ?? ''),
              'Completed': String(mk('Complete') ?? ''),
              'Queue Waiting': String(qk('Waiting') ?? ''),
              'Queue In Service': String(qk('In Service') ?? ''),
              'Queue Done': String(qk('Done') ?? ''),
              'Payments Count': String(pk('Count') ?? ''),
              'Payments Total': String(pk('Total Amount') ?? ''),
              'Avg Wait (min)': String(kpi('Avg Wait (min)') ?? ''),
              'Avg In Service (min)': String(kpi('Avg In Service (min)') ?? ''),
            }
          } else if (input.dataset === 'reception_dashboard') {
            const kpi = (m: string) => rows.find((r:any) => r.section === 'KPIs' && r.metric === m)?.value
            const qk = (m: string) => rows.find((r:any) => r.section === 'Queue Snapshot' && r.metric === m)?.value
            const pk = (m: string) => rows.find((r:any) => r.section === 'Payments' && r.metric === m)?.value
            extraInfo = {
              ...(extraInfoBase || {}),
              'Avg Wait (min)': String(kpi('Avg Wait (min)') ?? ''),
              'Avg In Service (min)': String(kpi('Avg In Service (min)') ?? ''),
              'Arrivals': String(kpi('Arrivals') ?? ''),
              'Serviced': String(kpi('Serviced') ?? ''),
              'Completed': String(kpi('Completed') ?? ''),
              'Queue Waiting': String(qk('Waiting') ?? ''),
              'Queue In Service': String(qk('In Service') ?? ''),
              'Queue Done': String(qk('Done') ?? ''),
              'Payments Count': String(pk('Count') ?? ''),
              'Payments Total': String(pk('Total Amount') ?? ''),
            }
          }
        } catch {}
        // Build additional sheets when applicable (per-department breakdowns)
        let sheets: Array<{ name: string; rows: any[] }> | undefined = undefined
        try {
          if (input.dataset === 'reception_daily') {
            const departments: Record<string, any[]> = {}
            for (const r of rows as any[]) {
              if (typeof r.section === 'string' && r.section.startsWith('Department — ')) {
                const name = r.section.replace('Department — ', '')
                if (!departments[name]) departments[name] = []
                departments[name].push({ metric: r.metric, value: r.value })
              }
            }
            sheets = Object.entries(departments).map(([name, r]) => ({ name, rows: r }))
          } else if (input.dataset === 'reception_dashboard' || input.dataset === 'reception_register' || input.dataset === 'reception_register_detailed') {
            const departments: Record<string, any[]> = {}
            for (const r of rows as any[]) {
              if (typeof r.section === 'string' && r.section.startsWith('Department — ')) {
                const name = r.section.replace('Department — ', '')
                if (!departments[name]) departments[name] = []
                departments[name].push({ metric: r.metric, value: r.value })
              }
            }
            if (Object.keys(departments).length) {
              sheets = Object.entries(departments).map(([name, r]) => ({ name, rows: r }))
            }
          }
        } catch {}
        const buf = Buffer.from(await toXLSX(rows, { meta: { title: `${input.dataset.replace(/_/g, " ")} Export`, exportedBy: auth.email, timestamp: new Date().toISOString() }, columns: input.columns && input.columns.length ? input.columns : ds.defaultColumns, extraInfo, headerTitle: 'Dayspring Medical Center', headerSubtitle: 'Dayspring Medical Center - Information System', logoDataUrl, currencyCode: currency, sheets }))
        try {
          await writeAuditLog({
            userId: auth.userId,
            action: "EXPORT",
            entityType: "Export",
            details: {
              category: "SYSTEM",
              description: `Exported ${input.dataset} as XLSX (${rows.length} rows)`,
              metadata: { dataset: input.dataset, format: "xlsx", rowCount: rows.length, filters: parsedFilters, columns: input.columns || null, requestedBy }
            },
            ip: "127.0.0.1"
          })
        } catch {}
        const res = new NextResponse(buf)
        res.headers.set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        res.headers.set("Content-Disposition", `attachment; filename=${filename}`)
        return res
      }
      case "pdf": {
        try {
          const origin = new URL(req.url).origin
          const safeLogoUrl = `${origin}/logo0.png`
          let logoDataUrl: string | undefined = undefined
          try {
            const r = await fetch(safeLogoUrl)
            if (r.ok) {
              const ct = r.headers.get("content-type") || "image/png"
              const ab = await r.arrayBuffer()
              const b = Buffer.from(ab)
              logoDataUrl = `data:${ct};base64,${b.toString("base64")}`
            }
          } catch {}
          const landscape = input.dataset === "patients"
          const preparedRows = input.dataset === "patients" && rows.length
            ? rows.map((r: any) => {
                let age: number | string = ""
                try {
                  if (typeof r.age_years === 'number') {
                    age = r.age_years
                  } else if (r.date_of_birth) {
                    const dob = new Date(r.date_of_birth)
                    const now = new Date()
                    age = now.getFullYear() - dob.getFullYear() - ((now.getMonth() < dob.getMonth() || (now.getMonth() === dob.getMonth() && now.getDate() < dob.getDate())) ? 1 : 0)
                  }
                } catch {}
                let pn = String(r.patient_number || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(-4)
                if (pn.length < 4) pn = pn.padStart(4, "0")
                const nextOfKinName = [r.next_of_kin_first_name, r.next_of_kin_last_name].filter(Boolean).join(" ")
                return {
                  patient_number: pn, first_name: r.first_name, last_name: r.last_name, age, gender: r.gender, phone: r.phone,
                  next_of_kin: nextOfKinName, next_of_kin_phone: r.next_of_kin_phone, next_of_kin_relation: r.next_of_kin_relation,
                }
              })
            : rows
          const reportTitle = input.dataset === "patients" ? `Patient Demographic Data Export` : `${input.dataset.replace(/_/g, " ")} Export`
          const meta = (() => {
            const base = extraInfoBase ? { ...extraInfoBase } : {}
            ;(base as any)['Report'] = reportTitle
            return base
          })()
          // Standardize PDF title to include org + dataset for all exports
          const pdfTitle = `Dayspring Medical Center — ${reportTitle}`
          // For reception register/dashboard/daily, enrich meta with quick totals
          let pdfMeta = meta
          try {
            if (input.dataset === 'reception_register' || input.dataset === 'reception_daily') {
              const mk = (m: string) => rows.find((r:any) => r.section === 'Check-ins' && r.metric === m)?.value
              const qk = (m: string) => rows.find((r:any) => r.section === 'Queue' && r.metric === m)?.value
              const pk = (m: string) => rows.find((r:any) => r.section === 'Payments' && r.metric === m)?.value
              const kpi = (m: string) => rows.find((r:any) => r.section === 'KPIs' && r.metric === m)?.value
              pdfMeta = {
                ...(meta || {}),
                'Check-ins Total': String(mk('Total') ?? ''),
                'Arrived': String(mk('Arrived') ?? ''),
                'With Nurse': String(mk('With Nurse') ?? ''),
                'In Room': String(mk('In Room') ?? ''),
                'Completed': String(mk('Complete') ?? ''),
                'Queue Waiting': String(qk('Waiting') ?? ''),
                'Queue In Service': String(qk('In Service') ?? ''),
                'Queue Done': String(qk('Done') ?? ''),
                'Payments Count': String(pk('Count') ?? ''),
                'Payments Total': String(pk('Total Amount') ?? ''),
                'Avg Wait (min)': String(kpi('Avg Wait (min)') ?? ''),
                'Avg In Service (min)': String(kpi('Avg In Service (min)') ?? ''),
              }
            } else if (input.dataset === 'reception_dashboard') {
              const kpi = (m: string) => rows.find((r:any) => r.section === 'KPIs' && r.metric === m)?.value
              const qk = (m: string) => rows.find((r:any) => r.section === 'Queue Snapshot' && r.metric === m)?.value
              const pk = (m: string) => rows.find((r:any) => r.section === 'Payments' && r.metric === m)?.value
              pdfMeta = {
                ...(meta || {}),
                'Avg Wait (min)': String(kpi('Avg Wait (min)') ?? ''),
                'Avg In Service (min)': String(kpi('Avg In Service (min)') ?? ''),
                'Arrivals': String(kpi('Arrivals') ?? ''),
                'Serviced': String(kpi('Serviced') ?? ''),
                'Completed': String(kpi('Completed') ?? ''),
                'Queue Waiting': String(qk('Waiting') ?? ''),
                'Queue In Service': String(qk('In Service') ?? ''),
                'Queue Done': String(qk('Done') ?? ''),
                'Payments Count': String(pk('Count') ?? ''),
                'Payments Total': String(pk('Total Amount') ?? ''),
              }
            }
          } catch {}

          // Optionally include compact bar charts for reception_daily and dashboard
          let charts: any[] | undefined = undefined
          try {
            if (input.dataset === 'reception_daily') {
              const hrs = preparedRows.filter((r: any) => r.section === 'Arrivals Per Hour')
              if (hrs.length) {
                charts = charts || []
                charts.push({ title: 'Arrivals Per Hour', labels: hrs.map((r: any) => String(r.metric)), values: hrs.map((r: any) => Number(r.value)||0) })
              }
              const pbm = preparedRows.filter((r: any) => r.section === 'Payments by Method')
              if (pbm.length) {
                charts = charts || []
                charts.push({ title: 'Payments by Method', labels: pbm.map((r: any) => String(r.metric)), values: pbm.map((r: any) => Number(r.value)||0) })
              }
            } else if (input.dataset === 'reception_dashboard') {
              const pbm = preparedRows.filter((r: any) => r.section === 'Payments by Method')
              if (pbm.length) {
                charts = charts || []
                charts.push({ title: 'Payments by Method', labels: pbm.map((r: any) => String(r.metric)), values: pbm.map((r: any) => Number(r.value)||0) })
              }
            }
          } catch {}

          const buf = await toPDF(
            pdfTitle,
            preparedRows,
            { userId: auth.userId, timestamp: new Date().toISOString() },
            landscape,
            {
              colors: { headerBg: [14,165,233], headerText: [255,255,255], rowAltBg: [243,244,246], text: [17,24,39] },
              logoDataUrl,
              meta: pdfMeta,
              subtitle: "Dayspring Medical Center - Information System",
              watermarkOpacity: 0.08,
              groupByKey: (input.dataset === 'reception_register' || input.dataset === 'reception_register_detailed' || input.dataset === 'reception_dashboard' || input.dataset === 'reception_daily') ? 'section' : (input.dataset === 'queue_events' ? 'department' : undefined),
              subGroupKey: (input.dataset === 'reception_register_detailed') ? 'subsection' : (input.dataset === 'queue_events' ? 'to_status' : undefined),
              charts
            }
          )
          try {
            await writeAuditLog({
              userId: auth.userId,
              action: "EXPORT",
              entityType: "Export",
              details: {
                category: "SYSTEM",
                description: `Exported ${input.dataset} as PDF (${rows.length} rows)`,
                metadata: { dataset: input.dataset, format: "pdf", rowCount: rows.length, filters: parsedFilters, requestedBy, reportTitle }
              },
              ip: "127.0.0.1"
            })
          } catch {}
          const res = new NextResponse(buf, { status: 200, headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename=${filename}` } })
          return res
        } catch (pdfError) {
          return NextResponse.json({ error: "PDF generation failed", details: pdfError instanceof Error ? pdfError.message : "Unknown error" }, { status: 500 })
        }
      }
      case "ndjson": {
        const body = rows.map((r) => JSON.stringify(r)).join("\n")
        try {
          await writeAuditLog({
            userId: auth.userId,
            action: "EXPORT",
            entityType: "Export",
            details: {
              category: "SYSTEM",
              description: `Exported ${input.dataset} as NDJSON (${rows.length} rows)`,
              metadata: { dataset: input.dataset, format: "ndjson", rowCount: rows.length, filters: parsedFilters, requestedBy }
            },
            ip: "127.0.0.1"
          })
        } catch {}
        const res = new NextResponse(body)
        res.headers.set("Content-Type", "application/x-ndjson")
        res.headers.set("Content-Disposition", `attachment; filename=${filename}`)
        return res
      }
    }
  } catch (err: any) {
    if (err?.name === "ZodError") return NextResponse.json({ error: "Validation error", details: err.issues }, { status: 400 })
    return NextResponse.json({ error: "Failed to generate export" }, { status: 500 })
  }
}








