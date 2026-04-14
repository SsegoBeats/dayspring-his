import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifyToken } from "@/lib/security"
import { query } from "@/lib/db"

/**
 * GET /api/lab-panels?loincCode=58410-2
 *
 * Returns the parameter list for a given LOINC panel code.
 *
 * Resolution order:
 *   1. Check loinc_panels DB table (fastest, cached after first fetch)
 *   2. Call NLM Clinical Tables API and cache result into loinc_panels
 *   3. Return empty array if both fail (caller falls back to Tier-1 templates or blank row)
 */
export async function GET(req: Request) {
  const cookieStore = await cookies()
  const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
  const auth = token ? verifyToken(token) : null
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const loincCode = (searchParams.get("loincCode") || "").trim()
  if (!loincCode) {
    return NextResponse.json({ parameters: [] })
  }

  // --- Tier 2a: DB cache ---
  try {
    const { rows } = await query<{
      member_name: string
      units: string | null
      reference: string | null
    }>(
      `SELECT member_name, units, reference FROM loinc_panels WHERE panel_loinc_code = $1 ORDER BY member_loinc_code`,
      [loincCode],
    )
    if (rows.length > 0) {
      return NextResponse.json({
        parameters: rows.map((r) => ({
          name: r.member_name,
          units: r.units || "",
          reference: r.reference || "",
        })),
        source: "db",
      })
    }
  } catch {
    // Table may not exist yet — fall through to NLM
  }

  // --- Tier 2b: NLM Clinical Tables API ---
  try {
    const nlmUrl = `https://clinicaltables.nlm.nih.gov/api/loinc_items/v3/search?df=LOINC_NUM,COMPONENT,PROPERTY,LOINC_CLASS&terms=${encodeURIComponent(loincCode)}&q=LOINC_NUM:${encodeURIComponent(loincCode)}&maxList=100`
    const res = await fetch(nlmUrl, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(8000) })
    if (res.ok) {
      const data = await res.json()
      // NLM returns [totalCount, codes, extra, rows]
      // rows is array of [LOINC_NUM, COMPONENT, PROPERTY, CLASS]
      const rows: string[][] = Array.isArray(data[3]) ? data[3] : []
      const params = rows
        .filter((r) => Array.isArray(r) && r.length >= 2)
        .map((r) => ({
          memberLoincCode: r[0] || "",
          name: r[1] || "",
          units: "",
          reference: "",
        }))

      if (params.length > 0) {
        // Cache into loinc_panels
        try {
          const values = params
            .map((_, i) => `($${i * 4 + 1}, $${i * 4 + 2}, $${i * 4 + 3}, $${i * 4 + 4}, $${i * 4 + 5})`)
          // Use 5 params per row: panel_loinc_code, member_loinc_code, member_name, units, reference
          const flatValues: any[] = []
          for (const p of params) {
            flatValues.push(loincCode, p.memberLoincCode || p.name, p.name, p.units, p.reference)
          }
          const placeholders = params
            .map((_, i) => `($${i * 5 + 1}, $${i * 5 + 2}, $${i * 5 + 3}, $${i * 5 + 4}, $${i * 5 + 5})`)
            .join(", ")
          await query(
            `INSERT INTO loinc_panels (panel_loinc_code, member_loinc_code, member_name, units, reference)
             VALUES ${placeholders}
             ON CONFLICT DO NOTHING`,
            flatValues,
          )
        } catch {
          // Non-fatal — serve from NLM even if caching fails
        }

        return NextResponse.json({
          parameters: params.map((p) => ({ name: p.name, units: p.units, reference: p.reference })),
          source: "nlm",
        })
      }
    }
  } catch {
    // NLM unreachable — fall through to empty
  }

  return NextResponse.json({ parameters: [], source: "none" })
}
