"use client"

import { useEffect, useMemo, useState } from "react"
import Image from "next/image"
import { useSearchParams, useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { BarcodeGenerator } from "@/components/barcode-generator"
import { ORG_NAME, ORG_EMAIL, ORG_PHONE, ORG_ADDRESS, ORG_LOGO_PATH } from "@/lib/org-constants"

function ResultCard({ test }: { test: any }) {
  const analytes = useMemo(() => {
    const out: { parameter: string; value: string; refRange: string; flag: string }[] = []
    const rx =
      /(Hb|WBC|Platelets|HCT|MCV|Neut|Lymph|Mono|Eos|Baso|RBS|ALT|AST|ALP|T\.?\s*Bilirubin|D\.?\s*Bilirubin|Albumin|Total\s*Protein|CRP|pH|SG|Nitrite|Leukocyte|Blood|Protein|Glucose|Ketone|HIV\s*Rapid)\s*:\s*([^\n]+)/gi
    if (typeof test.results !== "string") return out
    const sex = String(test.patientGender || "").toLowerCase()
    const ageYears = (() => {
      const d = test.patientDob ? new Date(test.patientDob) : null
      if (!d || isNaN(d.getTime())) return undefined
      const n = new Date()
      let y = n.getFullYear() - d.getFullYear()
      const mo = n.getMonth() - d.getMonth()
      if (mo < 0 || (mo === 0 && n.getDate() < d.getDate())) y--
      return Math.max(0, y)
    })()
    const toNum = (s: string) => { const m = String(s).replace(/,/g, "").match(/-?\d+(?:\.\d+)?/); return m ? parseFloat(m[0]) : null }
    const range = (k: string): [number | null, number | null, string] => {
      switch (k) {
        case "Hb": { if (typeof ageYears === "number" && ageYears < 12) return [11.5, 15.5, "g/dL"]; const f = sex === "female"; return [f ? 12 : 13, f ? 15.5 : 17, "g/dL"] }
        case "WBC": { if (typeof ageYears === "number" && ageYears < 12) return [5, 15, "x10^9/L"]; return [4, 11, "x10^9/L"] }
        case "Platelets": return [150, 450, "x10^9/L"]
        case "HCT": { if (typeof ageYears === "number" && ageYears < 12) return [35, 45, "%"]; const f = sex === "female"; return [f ? 36 : 40, f ? 46 : 52, "%"] }
        case "MCV": { if (typeof ageYears === "number" && ageYears < 12) return [75, 95, "fL"]; return [80, 100, "fL"] }
        case "Neut": return [40, 75, "%"]
        case "Lymph": return [20, 45, "%"]
        case "Mono": return [2, 10, "%"]
        case "Eos": return [1, 6, "%"]
        case "Baso": return [0, 2, "%"]
        case "RBS": return [3.9, 7.8, "mmol/L"]
        case "ALT": return [7, 55, "U/L"]
        case "AST": return [8, 48, "U/L"]
        case "ALP": { if (typeof ageYears === "number" && ageYears < 12) return [100, 350, "U/L"]; return [40, 130, "U/L"] }
        case "T. Bilirubin": return [0.3, 1.2, "mg/dL"]
        case "D. Bilirubin": return [0.0, 0.3, "mg/dL"]
        case "Albumin": return [3.5, 5.0, "g/dL"]
        case "Total Protein": return [6.0, 8.3, "g/dL"]
        case "CRP": return [0, 10, "mg/L"]
        case "pH": return [5.0, 8.0, ""]
        case "SG": return [1.005, 1.03, ""]
        default: return [null, null, ""]
      }
    }
    let m: RegExpExecArray | null
    while ((m = rx.exec(test.results)) != null) {
      const k = m[1].replace(/\s+/g, " ")
      const v = m[2].trim()
      const [lo, hi, unit] = range(k)
      const val = toNum(v)
      let flag = ""
      if (val != null && lo != null && hi != null) flag = val < lo ? "L" : val > hi ? "H" : ""
      out.push({ parameter: k, value: v, refRange: lo != null && hi != null ? `${lo}–${hi} ${unit}`.trim() : "", flag })
    }
    return out
  }, [test.results, test.patientGender, test.patientDob])

  return (
    <div className="mb-6 break-inside-avoid">
      <div className="hdr flex items-start justify-between">
        <div>
          <div className="text-xl font-semibold">{ORG_NAME}</div>
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

      {analytes.length > 0 && (
        <div className="mb-3">
          <div className="font-medium">Analytes</div>
          <table className="w-full text-sm border">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="px-2 py-1 text-left">Parameter</th>
                <th className="px-2 py-1 text-left">Value</th>
                <th className="px-2 py-1 text-left">Ref Range</th>
                <th className="px-2 py-1 text-left">Flag</th>
              </tr>
            </thead>
            <tbody>
              {analytes.map((a) => (
                <tr key={a.parameter} className={`border-b ${a.flag === "H" || a.flag === "L" ? "bg-red-50/60" : ""}`}>
                  <td className="px-2 py-1">{a.parameter}</td>
                  <td className="px-2 py-1 font-medium">{a.value}</td>
                  <td className="px-2 py-1 text-muted-foreground">{a.refRange || "-"}</td>
                  <td className="px-2 py-1 font-semibold" style={{ color: a.flag ? (a.flag === "H" ? "#dc2626" : "#d97706") : undefined }}>{a.flag || ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(!test.results || analytes.length === 0) && (
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

      <div className="mt-6 grid grid-cols-3 gap-4">
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
        <div>
          <div className="text-xs text-muted-foreground">Printed by</div>
          <div className="h-10 border-b" />
          <div className="text-xs">{(test as any).printedBy || "-"}</div>
        </div>
      </div>
    </div>
  )
}

export default function BatchPrintClient() {
  const router = useRouter()
  const { user, isLoading } = useAuth()
  const sp = useSearchParams()
  const patientId = sp.get("patientId")
  const from = sp.get("from") || new Date(new Date().setHours(0, 0, 0, 0)).toISOString()
  const to = sp.get("to") || new Date().toISOString()
  const status = sp.get("status") || "Completed"
  const [tests, setTests] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [org, setOrg] = useState<any>(null)

  useEffect(() => {
    if (isLoading) return
    if (!user) {
      router.push("/")
      return
    }
  }, [user, isLoading, router])

  useEffect(() => {
    if (isLoading || !user) return
    ;(async () => {
      try {
        const url = new URL("/api/lab-tests", window.location.origin)
        if (patientId) url.searchParams.set("patientId", patientId)
        url.searchParams.set("from", from)
        url.searchParams.set("to", to)
        if (status) url.searchParams.set("status", status)
        url.searchParams.set("limit", "5000")
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
  }, [patientId, from, to, status, isLoading, user])

  useEffect(() => {
    if (isLoading || !user) return
    if (!loading) {
      setTimeout(() => {
        try {
          window.print()
        } catch {}
      }, 300)
    }
  }, [loading, isLoading, user])

  useEffect(() => {
    if (isLoading || !user) return
    ;(async () => {
      try {
        const r = await fetch("/api/settings/org")
        const d = await r.json()
        setOrg(d.settings || null)
      } catch {}
    })()
  }, [isLoading, user])

  if (isLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

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
          <Image
            src={org?.logoUrl || ORG_LOGO_PATH}
            alt="Logo"
            width={40}
            height={40}
            className="h-10 w-10 object-contain"
            onError={(e: any) => {
              e.currentTarget.style.display = "none"
            }}
          />
          <div>
            <div className="text-xl font-semibold">{ORG_NAME}</div>
            <div className="text-xs text-muted-foreground">Laboratory Results (Batch)</div>
            <div className="text-[10px] text-muted-foreground">
              Email: {org?.email || ORG_EMAIL} • Tel: {org?.phone || ORG_PHONE} • {org?.location || ORG_ADDRESS}
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
