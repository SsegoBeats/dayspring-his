"use client"

import { useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { BarcodeGenerator } from "@/components/barcode-generator"

function ResultCard({ test }: { test: any }) {
  const parts = useMemo(() => {
    const obj: Record<string, string> = {}
    const rx =
      /(Hb|WBC|Platelets|HCT|MCV|Neut|Lymph|Mono|Eos|Baso|RBS|ALT|AST|ALP|T\.?\s*Bilirubin|D\.?\s*Bilirubin|Albumin|Total\s*Protein)\s*:\s*([^\n]+)/gi
    if (typeof test.results === "string") {
      let m: RegExpExecArray | null
      while ((m = rx.exec(test.results)) != null) {
        obj[m[1].replace(/\s+/g, " ")] = m[2].trim()
      }
    }
    return obj
  }, [test.results])

  return (
    <div className="mb-6 break-inside-avoid">
      <div className="hdr flex items-start justify-between">
        <div>
          <div className="text-xl font-semibold">Dayspring Medical Center</div>
          <div className="text-xs text-muted-foreground">Laboratory Result</div>
        </div>
        <div className="text-right">
          {test.accessionNumber && (
            <div className="inline-block">
              <BarcodeGenerator value={test.accessionNumber} width={2} height={40} displayValue={true} />
            </div>
          )}
        </div>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-2 text-sm">
        <div>
          <span className="text-muted-foreground">Patient:</span>{" "}
          <span className="font-medium">{test.patientName}</span>
        </div>
        <div>
          <span className="text-muted-foreground">P.ID:</span>{" "}
          <span className="font-mono">{test.patientNumber || "-"}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Accession:</span>{" "}
          <span className="font-mono">{test.accessionNumber || "-"}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Test:</span>{" "}
          <span className="font-medium">{test.testName || test.testType}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Ordered:</span>{" "}
          {test.orderedAt ? new Date(test.orderedAt).toLocaleString() : "-"}
        </div>
        <div>
          <span className="text-muted-foreground">Completed:</span>{" "}
          {test.completedAt ? new Date(test.completedAt).toLocaleString() : "-"}
        </div>
      </div>

      {Object.keys(parts).length > 0 && (
        <div className="mb-3">
          <div className="font-medium">Analytes</div>
          <table className="w-full text-sm border">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="px-2 py-1 text-left">Parameter</th>
                <th className="px-2 py-1 text-left">Value</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(parts).map(([k, v]) => (
                <tr key={k} className="border-b">
                  <td className="px-2 py-1">{k}</td>
                  <td className="px-2 py-1">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(!test.results || Object.keys(parts).length === 0) && (
        <div className="mb-3">
          <div className="font-medium">Results</div>
          <pre className="whitespace-pre-wrap rounded border bg-muted/40 p-3 text-sm">{test.results || "-"}</pre>
        </div>
      )}

      {test.notes && (
        <div className="mb-3">
          <div className="font-medium">Notes</div>
          <pre className="whitespace-pre-wrap rounded border bg-muted/40 p-3 text-sm">{test.notes}</pre>
        </div>
      )}

      <div className="mt-6 grid grid-cols-2 gap-4">
        <div>
          <div className="text-xs text-muted-foreground">Prepared by</div>
          <div className="h-10 border-b" />
          <div className="text-xs">Lab Technician: {test.labTechName || "-"}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Reviewed by</div>
          <div className="h-10 border-b" />
          <div className="text-xs">
            {test.reviewedAt
              ? `${new Date(test.reviewedAt).toLocaleDateString()}${
                  test.reviewedBy ? " (" + test.reviewedBy + ")" : ""
                }`
              : "-"}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function BatchPrintClient() {
  const sp = useSearchParams()
  const patientId = sp.get("patientId")
  const from = sp.get("from") || new Date(new Date().setHours(0, 0, 0, 0)).toISOString()
  const to = sp.get("to") || new Date().toISOString()
  const [tests, setTests] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    ;(async () => {
      try {
        const url = new URL("/api/lab-tests", window.location.origin)
        if (patientId) url.searchParams.set("patientId", patientId)
        url.searchParams.set("from", from)
        url.searchParams.set("to", to)
        const res = await fetch(url.toString(), { credentials: "include" })
        if (!res.ok) throw new Error("Failed to load")
        const data = await res.json()
        setTests(Array.isArray(data.tests) ? data.tests : [])
      } catch (e: any) {
        setError(e?.message || "Error")
      } finally {
        setLoading(false)
      }
    })()
  }, [patientId, from, to])

  useEffect(() => {
    if (!loading) {
      setTimeout(() => {
        try {
          window.print()
        } catch {}
      }, 300)
    }
  }, [loading])

  const [org, setOrg] = useState<any>(null)
  useEffect(() => {
    ;(async () => {
      try {
        const r = await fetch("/api/settings/org")
        const d = await r.json()
        setOrg(d.settings || null)
      } catch {}
    })()
  }, [])

  return (
    <div className="p-6 print:p-0">
      <style>
        {`@media print {.no-print{display:none} .page-break{page-break-after:always} .hdr{border-bottom:1px solid #ddd; padding-bottom:8px; margin-bottom:12px}}`}
      </style>
      <div className="no-print mb-3 flex items-center gap-3">
        <div className="text-sm text-muted-foreground">Batch Print</div>
        <button className="rounded border px-3 py-1.5 text-sm" onClick={() => window.print()}>
          Print
        </button>
      </div>
      <div className="hdr mb-4 flex items-start justify-between">
        <div className="flex items-center gap-3">
          <img
            src={org?.logoUrl || "/logo.png"}
            alt="Logo"
            className="h-10 w-10 object-contain"
            onError={(e: any) => {
              e.currentTarget.style.display = "none"
            }}
          />
          <div>
            <div className="text-xl font-semibold">{org?.name || "Dayspring Medical Center"}</div>
            <div className="text-xs text-muted-foreground">Laboratory Results (Batch)</div>
            <div className="text-[10px] text-muted-foreground">
              Email: {org?.email || "dayspringmedicalcenter@gmail.com"} • Tel: {org?.phone || "+256 703-942-230 / +256 703-844-396 / +256 742-918-253"} • {org?.location || "Wanyange, Uganda"}
            </div>
          </div>
        </div>
      </div>
      {loading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : error ? (
        <div className="text-sm text-destructive">{error}</div>
      ) : tests.length === 0 ? (
        <div className="text-sm text-muted-foreground">No tests found for the selected range.</div>
      ) : (
        tests.map((t, i) => (
          <div key={t.id} className={i < tests.length - 1 ? "page-break" : ""}>
            <ResultCard test={t} />
          </div>
        ))
      )}
    </div>
  )
}
