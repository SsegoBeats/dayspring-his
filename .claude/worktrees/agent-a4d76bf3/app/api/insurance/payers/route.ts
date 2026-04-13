import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { z } from "zod"
import { verifyToken, can } from "@/lib/security"
import { query, queryWithSession } from "@/lib/db"
import { INSURANCE_PAYER_TYPES, UGANDA_INSURANCE_PAYER_SEED } from "@/lib/insurance"

const nullableTrimmedString = (max: number) =>
  z.preprocess((value) => {
    if (typeof value !== "string") return value
    const trimmed = value.trim()
    return trimmed === "" ? null : trimmed
  }, z.string().max(max).nullable().optional())

const Create = z.object({
  name: z.string().trim().min(2).max(150),
  payerCode: nullableTrimmedString(50),
  payerType: z.enum(INSURANCE_PAYER_TYPES).default("INSURER"),
  requiresPreauthDefault: z.boolean().default(false),
  schemeStampRequired: z.boolean().default(false),
  panelDriven: z.boolean().default(false),
  contactPhone: nullableTrimmedString(30),
  contactEmail: nullableTrimmedString(150),
  notes: nullableTrimmedString(1000),
  active: z.boolean().default(true),
})

declare global {
  var __dayspringInsurancePayerColumnsPromise: Promise<void> | null | undefined
  var __dayspringInsurancePayerSeedPromise: Promise<void> | null | undefined
}

async function ensurePayerColumns() {
  if (!globalThis.__dayspringInsurancePayerColumnsPromise) {
    globalThis.__dayspringInsurancePayerColumnsPromise = (async () => {
      const statements = [
        `ALTER TABLE insurance_payers ADD COLUMN IF NOT EXISTS payer_type VARCHAR(20) DEFAULT 'INSURER'`,
        `ALTER TABLE insurance_payers ADD COLUMN IF NOT EXISTS requires_preauth_default BOOLEAN DEFAULT false`,
        `ALTER TABLE insurance_payers ADD COLUMN IF NOT EXISTS scheme_stamp_required BOOLEAN DEFAULT false`,
        `ALTER TABLE insurance_payers ADD COLUMN IF NOT EXISTS panel_driven BOOLEAN DEFAULT false`,
        `ALTER TABLE insurance_payers ADD COLUMN IF NOT EXISTS contact_phone VARCHAR(30)`,
        `ALTER TABLE insurance_payers ADD COLUMN IF NOT EXISTS contact_email VARCHAR(150)`,
        `ALTER TABLE insurance_payers ADD COLUMN IF NOT EXISTS notes TEXT`,
        `ALTER TABLE insurance_payers ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true`,
        `CREATE INDEX IF NOT EXISTS idx_insurance_payers_type_active ON insurance_payers(payer_type, active)`,
      ]

      for (const statement of statements) {
        try {
          await query(statement)
        } catch {
          // Non-fatal. Later selects will surface real issues.
        }
      }

      try {
        await query(`ALTER TABLE insurance_payers DROP CONSTRAINT IF EXISTS insurance_payers_payer_type_check`)
      } catch {}

      try {
        await query(
          `ALTER TABLE insurance_payers
             ADD CONSTRAINT insurance_payers_payer_type_check
             CHECK (payer_type IN ('INSURER','HMO','CORPORATE','GOVERNMENT','BROKER'))`
        )
      } catch {
        // Constraint may already exist under another compatible state.
      }
    })().catch((error) => {
      globalThis.__dayspringInsurancePayerColumnsPromise = null
      throw error
    })
  }

  await globalThis.__dayspringInsurancePayerColumnsPromise
}

async function ensureUgandanPayerSeed() {
  if (!globalThis.__dayspringInsurancePayerSeedPromise) {
    globalThis.__dayspringInsurancePayerSeedPromise = (async () => {
      await ensurePayerColumns()

      for (const payer of UGANDA_INSURANCE_PAYER_SEED) {
        await query(
          `UPDATE insurance_payers
              SET name = $2,
                  payer_type = $3,
                  requires_preauth_default = $4,
                  scheme_stamp_required = $5,
                  panel_driven = $6,
                  notes = $7,
                  active = true
            WHERE payer_code = $1`,
          [
            payer.payerCode,
            payer.name,
            payer.payerType,
            payer.requiresPreauthDefault,
            payer.schemeStampRequired,
            payer.panelDriven,
            payer.notes,
          ],
        )

        await query(
          `INSERT INTO insurance_payers (
              name,
              payer_code,
              payer_type,
              requires_preauth_default,
              scheme_stamp_required,
              panel_driven,
              notes,
              active
            )
            VALUES ($1,$2,$3,$4,$5,$6,$7,true)
            ON CONFLICT (name) DO UPDATE SET
              payer_code = EXCLUDED.payer_code,
              payer_type = EXCLUDED.payer_type,
              requires_preauth_default = EXCLUDED.requires_preauth_default,
              scheme_stamp_required = EXCLUDED.scheme_stamp_required,
              panel_driven = EXCLUDED.panel_driven,
              notes = EXCLUDED.notes,
              active = true`,
          [
            payer.name,
            payer.payerCode,
            payer.payerType,
            payer.requiresPreauthDefault,
            payer.schemeStampRequired,
            payer.panelDriven,
            payer.notes,
          ],
        )
      }
    })().catch((error) => {
      globalThis.__dayspringInsurancePayerSeedPromise = null
      throw error
    })
  }

  await globalThis.__dayspringInsurancePayerSeedPromise
}

async function requireAuth() {
  const cookieStore = await cookies()
  const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
  return token ? verifyToken(token) : null
}

export async function GET(req: Request) {
  const auth = await requireAuth()
  if (!auth || !can(auth.role, "insurance", "read")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  await ensureUgandanPayerSeed()

  const url = new URL(req.url)
  const includeTestData = url.searchParams.get("includeTestData") === "1"
  const allowTestData = includeTestData && auth.role === "Hospital Admin"

  const { rows } = await queryWithSession(
    { role: auth.role, userId: auth.userId },
    `SELECT
        id,
        name,
        payer_code,
        payer_type,
        requires_preauth_default,
        scheme_stamp_required,
        panel_driven,
        contact_phone,
        contact_email,
        notes,
        active
      FROM insurance_payers
      WHERE active = true
        AND (
          $1::boolean = true
          OR (name NOT ILIKE 'E2E %' AND COALESCE(payer_code, '') NOT ILIKE 'E2E%')
        )
      ORDER BY
        CASE payer_type
          WHEN 'INSURER' THEN 1
          WHEN 'HMO' THEN 2
          WHEN 'CORPORATE' THEN 3
          WHEN 'GOVERNMENT' THEN 4
          WHEN 'BROKER' THEN 5
          ELSE 9
        END,
        name ASC`,
    [allowTestData],
  )

  return NextResponse.json({ payers: rows })
}

export async function POST(req: Request) {
  const auth = await requireAuth()
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!can(auth.role, "insurance", "create")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  await ensureUgandanPayerSeed()

  const data = Create.parse(await req.json())
  const { rows } = await queryWithSession(
    { role: auth.role, userId: auth.userId },
    `INSERT INTO insurance_payers (
        name,
        payer_code,
        payer_type,
        requires_preauth_default,
        scheme_stamp_required,
        panel_driven,
        contact_phone,
        contact_email,
        notes,
        active
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING id`,
    [
      data.name,
      data.payerCode ?? null,
      data.payerType,
      data.requiresPreauthDefault,
      data.schemeStampRequired,
      data.panelDriven,
      data.contactPhone ?? null,
      data.contactEmail ?? null,
      data.notes ?? null,
      data.active,
    ],
  )

  return NextResponse.json({ id: rows[0].id })
}
