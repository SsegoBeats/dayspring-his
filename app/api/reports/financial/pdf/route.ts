import { NextRequest } from "next/server"
import { pdf } from "@react-pdf/renderer"
import { FinancialReportPdf } from "@/lib/reports/financial-pdf"
import React from "react"
import type { FinancialReportPayload } from "@/types/financial"

export const runtime = "nodejs"

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as FinancialReportPayload

    if (!body || !body.data || !body.hospitalName) {
      return new Response(JSON.stringify({ error: "Invalid payload" }), { status: 400 })
    }

    const origin = req.nextUrl.origin
    const provided = body.logoUrl && (body.logoUrl.startsWith("http") ? body.logoUrl : `${origin}${body.logoUrl}`)
    const safeLogoUrl = provided || `${origin}/logo0.png`
    let logoDataUrl: string | undefined = undefined
    try {
      const resp = await fetch(safeLogoUrl)
      if (resp.ok) {
        const contentType = resp.headers.get("content-type") || "image/png"
        const ab = await resp.arrayBuffer()
        const buf = Buffer.from(ab)
        logoDataUrl = `data:${contentType};base64,${buf.toString("base64")}`
      }
    } catch {}
    const useInter = false

    // Fetch fresh analytics server-side using session cookies
    let serverData = body.data
    try {
      const periodParam = body.period ? `period=${encodeURIComponent(body.period)}` : body.startDate && body.endDate ? `startDate=${encodeURIComponent(body.startDate)}&endDate=${encodeURIComponent(body.endDate)}` : `period=30days`
      const analyticsUrl = `${origin}/api/analytics/financial?${periodParam}`
      const cookieHeader = req.headers.get("cookie") || ""
      const resp = await fetch(analyticsUrl, { headers: { cookie: cookieHeader } })
      if (resp.ok) {
        serverData = await resp.json()
      }
    } catch (e) {
      // fallback to payload data silently
    }

    const element = FinancialReportPdf({ payload: { ...body, data: serverData, logoUrl: safeLogoUrl, logoDataUrl, __useInter: useInter } })
    const pdfInstance = pdf(element)
    pdfInstance.updateContainer(element)
    const blob = await pdfInstance.toBlob()
    const buffer = Buffer.from(await blob.arrayBuffer())

    const filename = `dayspring_financial_report_${new Date().toISOString().slice(0, 10)}.pdf`
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename=${filename}`,
      },
    })
  } catch (err: any) {
    console.error("PDF generation failed:", err?.message || err)
    if (err?.stack) console.error(err.stack)
    return new Response(JSON.stringify({ error: err?.message || "Failed to generate PDF" }), { status: 500, headers: { "Content-Type": "application/json" } })
  }
}
