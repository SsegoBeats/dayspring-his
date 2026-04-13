"use client"

import { useState } from "react"
import { Download, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { FinancialData, FinancialReportPayload } from "@/types/financial"

export function ExportPdfButton({
  hospitalName,
  logoUrl,
  periodLabel,
  period,
  data,
  generatedBy,
  size = "sm",
}: {
  hospitalName: string
  logoUrl?: string
  periodLabel: string
  period?: "7days" | "30days" | "90days"
  data: FinancialData
  generatedBy?: string
  size?: "sm" | "default" | "lg" | null | undefined
}) {
  const [loading, setLoading] = useState(false)

  const onClick = async () => {
    try {
      setLoading(true)
      const payload: FinancialReportPayload = {
        hospitalName,
        logoUrl,
        periodLabel,
        period,
        generatedAtISO: new Date().toISOString(),
        data,
        generatedBy,
      }

      const res = await fetch("/api/reports/financial/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        let msg = "Failed to generate PDF"
        try {
          const t = await res.text()
          msg = t
        } catch {}
        throw new Error(msg)
      }

      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `dayspring_financial_report_${new Date().toISOString().slice(0, 10)}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button variant="outline" size={size} onClick={onClick} disabled={loading}>
      {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
      Export PDF
    </Button>
  )
}


