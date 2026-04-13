import { query } from "@/lib/db"

/** Returns system-wide currency from organization_settings (Admin-set). Default: UGX */
export async function getSystemCurrency(): Promise<string> {
  try {
    const { rows } = await query(
      `SELECT currency FROM organization_settings WHERE id = 1 LIMIT 1`
    )
    return rows?.[0]?.currency || "UGX"
  } catch {
    return "UGX"
  }
}
