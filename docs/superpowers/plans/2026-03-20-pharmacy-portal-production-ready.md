# Pharmacy Portal — Production-Ready Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Dayspring HIS pharmacy portal fully production-ready: persist suppliers/POs/GRNs to the database, add an atomic dispense transaction, implement a controlled drugs register (NDA-mandated), add a notification bell, pharmacy-specific settings, and a design polish pass across all 12 tabs.

**Architecture:** Three phases — (1) DB migration + RBAC + all new API routes, (2) new/rebuilt UI components wired to those APIs, (3) design polish + print CSS + mobile fixes. Each phase commits independently. No test framework exists; verification is via `npm run build` (zero errors required) and manual browser checks listed per task.

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind CSS, Supabase/PostgreSQL (via `pg` pool), Lucide React, shadcn/ui, `withSession()` from `lib/db.ts` for atomic multi-step transactions.

**Spec:** `docs/superpowers/specs/2026-03-20-pharmacy-portal-production-ready-design.md`

---

## Key Patterns — Read Before Starting

**Auth pattern** (every API route):
```typescript
const cookieStore = await cookies()
const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
const auth = token ? verifyToken(token) : null
if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
if (!can(auth.role, "pharmacy", "read")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
```

**Atomic transaction pattern** (GRN + dispense endpoints — use `withSession`, NOT `queryWithSession`):
```typescript
import { withSession } from "@/lib/db"
const result = await withSession({ role: auth.role, userId: auth.userId }, async (client) => {
  const { rows: [row1] } = await client.query(`INSERT INTO ...`, [...])
  const { rows: [row2] } = await client.query(`UPDATE ...`, [...])
  return { row1, row2 }
})
```
`withSession` wraps everything in a single `BEGIN/COMMIT/ROLLBACK` with RLS session variables set. It is the only correct helper for multi-step transactions. `queryWithSession` opens a new transaction per call — never use it for multi-step operations.

**Structured error response**:
```typescript
return NextResponse.json({ error: "Human message", code: "MACHINE_CODE" }, { status: 400 })
```

---

## Phase 1 — Database & RBAC

### Task 1: Migration 0028 + RBAC update

**Files:**
- Create: `migrations/0028_pharmacy_production_ready.sql`
- Modify: `lib/security.ts` (add `purchase_orders` to `Resource` union + `Pharmacist` permissions)

- [ ] **Step 1: Write migration file**

```sql
-- migrations/0028_pharmacy_production_ready.sql

-- PO sequence for collision-safe LPO numbers
CREATE SEQUENCE IF NOT EXISTS lpo_sequence START 1;
CREATE SEQUENCE IF NOT EXISTS grn_sequence START 1;

-- Suppliers (admin-managed)
CREATE TABLE IF NOT EXISTS suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  contact_person text,
  phone text,
  email text,
  address text,
  nda_license_number text,
  payment_terms text,
  is_active boolean DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "suppliers_select_authenticated" ON suppliers FOR SELECT USING (current_setting('app.role', true) IS NOT NULL);
CREATE POLICY "suppliers_insert_admin" ON suppliers FOR INSERT WITH CHECK (current_setting('app.role', true) = 'Hospital Admin');
CREATE POLICY "suppliers_update_admin" ON suppliers FOR UPDATE USING (current_setting('app.role', true) = 'Hospital Admin');
CREATE POLICY "suppliers_delete_admin" ON suppliers FOR DELETE USING (current_setting('app.role', true) = 'Hospital Admin');

-- Purchase orders
CREATE TABLE IF NOT EXISTS purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number text UNIQUE NOT NULL,
  supplier_id uuid REFERENCES suppliers(id),
  status text NOT NULL DEFAULT 'draft',
  notes text,
  expected_delivery_date date,
  created_by uuid REFERENCES auth.users(id),
  approved_by uuid REFERENCES auth.users(id),
  approved_at timestamptz,
  cancelled_by uuid REFERENCES auth.users(id),
  cancelled_at timestamptz,
  cancellation_reason text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "po_select_pharmacy" ON purchase_orders FOR SELECT USING (current_setting('app.role', true) IN ('Pharmacist', 'Hospital Admin'));
CREATE POLICY "po_insert_pharmacy" ON purchase_orders FOR INSERT WITH CHECK (current_setting('app.role', true) IN ('Pharmacist', 'Hospital Admin'));
CREATE POLICY "po_update_pharmacy" ON purchase_orders FOR UPDATE USING (current_setting('app.role', true) IN ('Pharmacist', 'Hospital Admin'));
CREATE POLICY "po_delete_admin" ON purchase_orders FOR DELETE USING (current_setting('app.role', true) = 'Hospital Admin');

-- Purchase order items
CREATE TABLE IF NOT EXISTS purchase_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id uuid REFERENCES purchase_orders(id) ON DELETE CASCADE,
  medication_id uuid REFERENCES medications(id),
  quantity_ordered integer NOT NULL,
  quantity_received integer DEFAULT 0,
  unit_cost numeric(10,2),
  notes text
);

ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "poi_select_pharmacy" ON purchase_order_items FOR SELECT USING (current_setting('app.role', true) IN ('Pharmacist', 'Hospital Admin'));
CREATE POLICY "poi_insert_pharmacy" ON purchase_order_items FOR INSERT WITH CHECK (current_setting('app.role', true) IN ('Pharmacist', 'Hospital Admin'));
CREATE POLICY "poi_update_pharmacy" ON purchase_order_items FOR UPDATE USING (current_setting('app.role', true) IN ('Pharmacist', 'Hospital Admin'));
CREATE POLICY "poi_delete_pharmacy" ON purchase_order_items FOR DELETE USING (current_setting('app.role', true) IN ('Pharmacist', 'Hospital Admin'));

-- Goods received notes
CREATE TABLE IF NOT EXISTS goods_received_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grn_number text UNIQUE NOT NULL,
  purchase_order_id uuid REFERENCES purchase_orders(id),
  supplier_id uuid REFERENCES suppliers(id) NOT NULL,
  invoice_number text,
  received_by uuid REFERENCES auth.users(id) NOT NULL,
  received_at timestamptz DEFAULT now(),
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE goods_received_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "grn_select_pharmacy" ON goods_received_notes FOR SELECT USING (current_setting('app.role', true) IN ('Pharmacist', 'Hospital Admin'));
CREATE POLICY "grn_insert_pharmacy" ON goods_received_notes FOR INSERT WITH CHECK (current_setting('app.role', true) IN ('Pharmacist', 'Hospital Admin'));

-- GRN items
CREATE TABLE IF NOT EXISTS grn_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grn_id uuid REFERENCES goods_received_notes(id) ON DELETE CASCADE,
  medication_id uuid REFERENCES medications(id) NOT NULL,
  batch_id uuid REFERENCES medication_batches(id),
  batch_number text NOT NULL,
  expiry_date date NOT NULL,
  quantity_ordered integer,
  quantity_received integer NOT NULL,
  unit_cost numeric(10,2)
);

ALTER TABLE grn_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "grn_items_select_pharmacy" ON grn_items FOR SELECT USING (current_setting('app.role', true) IN ('Pharmacist', 'Hospital Admin'));
CREATE POLICY "grn_items_insert_pharmacy" ON grn_items FOR INSERT WITH CHECK (current_setting('app.role', true) IN ('Pharmacist', 'Hospital Admin'));

-- Controlled drug register
CREATE TABLE IF NOT EXISTS controlled_drug_register (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  medication_id uuid REFERENCES medications(id) NOT NULL,
  patient_id uuid REFERENCES patients(id),
  prescription_id uuid REFERENCES prescriptions(id),
  prescriber_name text NOT NULL,
  prescriber_registration_number text,
  quantity_dispensed integer NOT NULL,
  batch_number text,
  running_balance integer NOT NULL,
  dispensed_by uuid REFERENCES auth.users(id) NOT NULL,
  dispensed_at timestamptz DEFAULT now(),
  witness_name text,
  entry_type text DEFAULT 'dispense',
  notes text
);

ALTER TABLE controlled_drug_register ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cdr_select_pharmacy" ON controlled_drug_register FOR SELECT USING (current_setting('app.role', true) IN ('Pharmacist', 'Hospital Admin'));
CREATE POLICY "cdr_insert_pharmacy" ON controlled_drug_register FOR INSERT WITH CHECK (current_setting('app.role', true) IN ('Pharmacist', 'Hospital Admin'));

-- Pharmacy settings (per-user)
CREATE TABLE IF NOT EXISTS pharmacy_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) UNIQUE NOT NULL,
  low_stock_threshold_override integer,
  expiry_warning_days integer DEFAULT 90,
  expiry_critical_days integer DEFAULT 30,
  default_dispensing_notes text,
  preferred_print_format text DEFAULT 'a4',
  print_include_logo boolean DEFAULT true,
  enable_controlled_drug_alerts boolean DEFAULT true,
  notify_low_stock boolean DEFAULT true,
  notify_expiry boolean DEFAULT true,
  notify_new_prescriptions boolean DEFAULT true,
  notify_po_approved boolean DEFAULT true,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE pharmacy_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pharm_settings_select_own" ON pharmacy_settings FOR SELECT USING (
  current_setting('app.user_id', true) = user_id::text
);
CREATE POLICY "pharm_settings_insert_own" ON pharmacy_settings FOR INSERT WITH CHECK (
  current_setting('app.user_id', true) = user_id::text
);
CREATE POLICY "pharm_settings_update_own" ON pharmacy_settings FOR UPDATE USING (
  current_setting('app.user_id', true) = user_id::text
);

-- Add controlled substance fields to medications
ALTER TABLE medications ADD COLUMN IF NOT EXISTS is_controlled boolean DEFAULT false;
ALTER TABLE medications ADD COLUMN IF NOT EXISTS schedule_class text;

COMMENT ON COLUMN pharmacy_settings.low_stock_threshold_override IS 'Absolute unit count; overrides medications.reorder_level when set. Not a percentage.';
COMMENT ON COLUMN medications.schedule_class IS 'Schedule I | Schedule II | Schedule III | null for non-controlled';
```

- [ ] **Step 2: Update `lib/security.ts` — add `purchase_orders` resource and pharmacist create permission**

In `lib/security.ts`, find the `Resource` type and add `"purchase_orders"` to the union. Then update `Pharmacist` to add `"create"` to pharmacy (needed for PO creation) and add `purchase_orders` resource. Also add `purchase_orders` to `"Hospital Admin"`:

```typescript
// In Resource type union, add:
| "purchase_orders"

// In rolePolicies, update Pharmacist:
Pharmacist: {
  pharmacy: ["read", "create", "update"],   // add "create" — needed for PO + GRN + dispense
  patients: ["read"],
  beds: ["read"],
  purchase_orders: ["read", "create", "update"],
},

// In "Hospital Admin", add:
purchase_orders: ["read", "create", "update", "delete"],
```

**Note on PO approval gate:** Do NOT add `"approve"` to the `Action` type. The approval gate uses a hardcoded `auth.role !== "Hospital Admin"` check in the PATCH endpoint (see Task 4). This is simpler and avoids `can()` sprawl for a single elevated action. The `purchase_orders` resource in RBAC is only needed for the standard create/update/read gates.

- [ ] **Step 3: Run build to verify no TypeScript errors**

```bash
cd c:/Users/ssego/Documents/dayspring-his
npm run build 2>&1 | tail -30
```
Expected: no errors related to security.ts or Action type.

- [ ] **Step 3b: Verify RBAC change manually before writing any API routes**

After updating `lib/security.ts`, confirm these return `true` mentally (or by adding a temporary console.log in a test route):
- `can("Pharmacist", "pharmacy", "create")` → `true` (was `false` before)
- `can("Pharmacist", "purchase_orders", "create")` → `true`
- `can("Hospital Admin", "purchase_orders", "update")` → `true`

If these are wrong, ALL Phase 1 API routes will return 403 for pharmacists. Fix before proceeding.

- [ ] **Step 4: Register migration in tracking table**

Open the Neon console (or use `/api/migrate` endpoint if available) and run:
```sql
INSERT INTO migrations (filename, executed_at)
VALUES ('0028_pharmacy_production_ready.sql', now())
ON CONFLICT (filename) DO NOTHING;
```
Then execute the migration SQL against the production database.

- [ ] **Step 5: Commit**

```bash
git add migrations/0028_pharmacy_production_ready.sql lib/security.ts
git commit -m "feat(pharmacy): migration 0028 — suppliers, POs, GRNs, controlled drugs, settings tables + RBAC"
```

---

### Task 2: Pharmacy Settings API

**Files:**
- Create: `app/api/pharmacy/settings/route.ts`

- [ ] **Step 1: Create the route**

```typescript
// app/api/pharmacy/settings/route.ts
import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifyToken, can } from "@/lib/security"
import { queryWithSession } from "@/lib/db"

export async function GET() {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    const auth = token ? verifyToken(token) : null
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!can(auth.role, "pharmacy", "read")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    // Upsert defaults on first fetch
    await queryWithSession({ role: auth.role, userId: auth.userId },
      `INSERT INTO pharmacy_settings (user_id) VALUES ($1)
       ON CONFLICT (user_id) DO NOTHING`,
      [auth.userId]
    )

    const { rows } = await queryWithSession({ role: auth.role, userId: auth.userId },
      `SELECT * FROM pharmacy_settings WHERE user_id = $1`,
      [auth.userId]
    )
    return NextResponse.json({ settings: rows[0] ?? null })
  } catch (err: any) {
    console.error("Error fetching pharmacy settings:", err)
    return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    const auth = token ? verifyToken(token) : null
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!can(auth.role, "pharmacy", "update")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const body = await req.json().catch(() => ({}))
    const fields: string[] = []
    const values: any[] = []
    let idx = 1

    const allowed = [
      "low_stock_threshold_override", "expiry_warning_days", "expiry_critical_days",
      "default_dispensing_notes", "preferred_print_format", "print_include_logo",
      "enable_controlled_drug_alerts", "notify_low_stock", "notify_expiry",
      "notify_new_prescriptions", "notify_po_approved"
    ]
    for (const key of allowed) {
      if (key in body) {
        fields.push(`${key} = $${idx++}`)
        values.push(body[key])
      }
    }
    if (fields.length === 0) return NextResponse.json({ error: "No fields to update" }, { status: 400 })

    fields.push(`updated_at = now()`)
    values.push(auth.userId)

    const { rows } = await queryWithSession({ role: auth.role, userId: auth.userId },
      `UPDATE pharmacy_settings SET ${fields.join(", ")} WHERE user_id = $${idx} RETURNING *`,
      values
    )
    return NextResponse.json({ settings: rows[0] })
  } catch (err: any) {
    console.error("Error updating pharmacy settings:", err)
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 })
  }
}
```

- [ ] **Step 2: Build check**

```bash
npm run build 2>&1 | grep -E "error|Error" | head -20
```
Expected: 0 errors.

- [ ] **Step 3: Manual verify**

Start dev server (`npm run dev`), log in as Pharmacist, open DevTools Network tab, navigate to `/app/pharmacist/settings` — you'll verify the API call once the settings UI is wired in Task 13. For now just confirm the route file compiles.

- [ ] **Step 4: Commit**

```bash
git add app/api/pharmacy/settings/route.ts
git commit -m "feat(pharmacy): pharmacy settings API — GET with upsert defaults, PATCH"
```

---

### Task 3: Suppliers API

**Files:**
- Create: `app/api/pharmacy/suppliers/route.ts`
- Create: `app/api/pharmacy/suppliers/[id]/route.ts`

- [ ] **Step 1: Create `app/api/pharmacy/suppliers/route.ts`**

```typescript
import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifyToken, can } from "@/lib/security"
import { queryWithSession } from "@/lib/db"

export async function GET() {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    const auth = token ? verifyToken(token) : null
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!can(auth.role, "pharmacy", "read")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const { rows } = await queryWithSession({ role: auth.role, userId: auth.userId },
      `SELECT id, name, contact_person, phone, email, address, nda_license_number, payment_terms, is_active, created_at
         FROM suppliers WHERE is_active = true ORDER BY name ASC`
    )
    return NextResponse.json({ suppliers: rows })
  } catch (err: any) {
    console.error("Error fetching suppliers:", err)
    return NextResponse.json({ error: "Failed to fetch suppliers" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    const auth = token ? verifyToken(token) : null
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!can(auth.role, "pharmacy", "create") || auth.role !== "Hospital Admin") {
      return NextResponse.json({ error: "Forbidden — admin only", code: "ADMIN_ONLY" }, { status: 403 })
    }

    const body = await req.json().catch(() => ({}))
    const { name, contact_person, phone, email, address, nda_license_number, payment_terms } = body
    if (!name?.trim()) return NextResponse.json({ error: "Supplier name is required" }, { status: 400 })

    const { rows } = await queryWithSession({ role: auth.role, userId: auth.userId },
      `INSERT INTO suppliers (name, contact_person, phone, email, address, nda_license_number, payment_terms, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [name.trim(), contact_person, phone, email, address, nda_license_number, payment_terms, auth.userId]
    )
    return NextResponse.json({ supplier: rows[0] }, { status: 201 })
  } catch (err: any) {
    console.error("Error creating supplier:", err)
    return NextResponse.json({ error: "Failed to create supplier" }, { status: 500 })
  }
}
```

- [ ] **Step 2: Create `app/api/pharmacy/suppliers/[id]/route.ts`**

```typescript
import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifyToken, can } from "@/lib/security"
import { queryWithSession } from "@/lib/db"

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    const auth = token ? verifyToken(token) : null
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (auth.role !== "Hospital Admin") return NextResponse.json({ error: "Forbidden — admin only" }, { status: 403 })

    const body = await req.json().catch(() => ({}))
    const fields: string[] = []
    const values: any[] = []
    let idx = 1
    const allowed = ["name", "contact_person", "phone", "email", "address", "nda_license_number", "payment_terms", "is_active"]
    for (const key of allowed) {
      if (key in body) { fields.push(`${key} = $${idx++}`); values.push(body[key]) }
    }
    if (fields.length === 0) return NextResponse.json({ error: "No fields to update" }, { status: 400 })
    fields.push(`updated_at = now()`)
    values.push(id)

    const { rows } = await queryWithSession({ role: auth.role, userId: auth.userId },
      `UPDATE suppliers SET ${fields.join(", ")} WHERE id = $${idx} RETURNING *`, values
    )
    if (rows.length === 0) return NextResponse.json({ error: "Supplier not found" }, { status: 404 })
    return NextResponse.json({ supplier: rows[0] })
  } catch (err: any) {
    console.error("Error updating supplier:", err)
    return NextResponse.json({ error: "Failed to update supplier" }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    const auth = token ? verifyToken(token) : null
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (auth.role !== "Hospital Admin") return NextResponse.json({ error: "Forbidden — admin only" }, { status: 403 })

    await queryWithSession({ role: auth.role, userId: auth.userId },
      `UPDATE suppliers SET is_active = false, updated_at = now() WHERE id = $1`, [id]
    )
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: "Failed to delete supplier" }, { status: 500 })
  }
}
```

- [ ] **Step 3: Build check + commit**

```bash
npm run build 2>&1 | grep -E "^.*error" | head -20
git add app/api/pharmacy/suppliers/
git commit -m "feat(pharmacy): suppliers API — GET (all roles), POST/PATCH/DELETE (admin only)"
```

---

### Task 4: Purchase Orders API

**Files:**
- Create: `app/api/pharmacy/purchase-orders/route.ts`
- Create: `app/api/pharmacy/purchase-orders/[id]/route.ts`

- [ ] **Step 1: Create `app/api/pharmacy/purchase-orders/route.ts`**

```typescript
import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifyToken, can } from "@/lib/security"
import { queryWithSession, withSession } from "@/lib/db"

export async function GET(req: Request) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    const auth = token ? verifyToken(token) : null
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!can(auth.role, "pharmacy", "read")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const { searchParams } = new URL(req.url)
    const status = searchParams.get("status")
    const supplierId = searchParams.get("supplier_id")

    let where = "WHERE 1=1"
    const params: any[] = []
    let idx = 1
    if (status) { where += ` AND po.status = $${idx++}`; params.push(status) }
    if (supplierId) { where += ` AND po.supplier_id = $${idx++}`; params.push(supplierId) }

    const { rows } = await queryWithSession({ role: auth.role, userId: auth.userId },
      `SELECT po.*,
              s.name AS supplier_name,
              COUNT(poi.id) AS item_count,
              COALESCE(SUM(poi.quantity_ordered * poi.unit_cost), 0) AS total_value,
              cb.full_name AS created_by_name
         FROM purchase_orders po
    LEFT JOIN suppliers s ON s.id = po.supplier_id
    LEFT JOIN purchase_order_items poi ON poi.purchase_order_id = po.id
    LEFT JOIN users cb ON cb.id = po.created_by
        ${where}
     GROUP BY po.id, s.name, cb.full_name
     ORDER BY po.created_at DESC
        LIMIT 200`,
      params
    )
    return NextResponse.json({ purchase_orders: rows })
  } catch (err: any) {
    console.error("Error fetching purchase orders:", err)
    return NextResponse.json({ error: "Failed to fetch purchase orders" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    const auth = token ? verifyToken(token) : null
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!can(auth.role, "purchase_orders", "create")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const body = await req.json().catch(() => ({}))
    const { supplier_id, expected_delivery_date, notes, items, submit_for_approval } = body

    if (!supplier_id) return NextResponse.json({ error: "Supplier is required" }, { status: 400 })
    if (!items || items.length === 0) return NextResponse.json({ error: "At least one item is required" }, { status: 400 })

    // ⚠️ Atomic — PO header + all items in one transaction to prevent orphaned POs
    const po = await withSession({ role: auth.role, userId: auth.userId }, async (client) => {
      const { rows: [newPo] } = await client.query(
        `INSERT INTO purchase_orders (po_number, supplier_id, status, notes, expected_delivery_date, created_by)
         VALUES (
           'LPO-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('lpo_sequence')::text, 4, '0'),
           $1, $2, $3, $4, $5
         ) RETURNING *`,
        [supplier_id, submit_for_approval ? "pending_approval" : "draft", notes, expected_delivery_date, auth.userId]
      )
      for (const item of items) {
        await client.query(
          `INSERT INTO purchase_order_items (purchase_order_id, medication_id, quantity_ordered, unit_cost, notes)
           VALUES ($1, $2, $3, $4, $5)`,
          [newPo.id, item.medication_id, item.quantity_ordered, item.unit_cost, item.notes]
        )
      }
      return newPo
    })

    return NextResponse.json({ purchase_order: po }, { status: 201 })
  } catch (err: any) {
    console.error("Error creating purchase order:", err)
    return NextResponse.json({ error: "Failed to create purchase order" }, { status: 500 })
  }
}
```

- [ ] **Step 2: Create `app/api/pharmacy/purchase-orders/[id]/route.ts`**

```typescript
import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifyToken, can } from "@/lib/security"
import { queryWithSession } from "@/lib/db"

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    const auth = token ? verifyToken(token) : null
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!can(auth.role, "pharmacy", "read")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const { rows: [po] } = await queryWithSession({ role: auth.role, userId: auth.userId },
      `SELECT po.*, s.name AS supplier_name FROM purchase_orders po
       LEFT JOIN suppliers s ON s.id = po.supplier_id WHERE po.id = $1`, [id]
    )
    if (!po) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const { rows: items } = await queryWithSession({ role: auth.role, userId: auth.userId },
      `SELECT poi.*, m.name AS medication_name, m.unit_type FROM purchase_order_items poi
       LEFT JOIN medications m ON m.id = poi.medication_id WHERE poi.purchase_order_id = $1`, [id]
    )
    return NextResponse.json({ purchase_order: po, items })
  } catch (err: any) {
    return NextResponse.json({ error: "Failed to fetch purchase order" }, { status: 500 })
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    const auth = token ? verifyToken(token) : null
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!can(auth.role, "purchase_orders", "update")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const body = await req.json().catch(() => ({}))
    const { action, cancellation_reason, notes, expected_delivery_date, supplier_id } = body

    // Fetch current PO
    const { rows: [po] } = await queryWithSession({ role: auth.role, userId: auth.userId },
      `SELECT * FROM purchase_orders WHERE id = $1`, [id]
    )
    if (!po) return NextResponse.json({ error: "Not found" }, { status: 404 })

    if (action === "approve") {
      if (auth.role !== "Hospital Admin") {
        return NextResponse.json({ error: "Only Hospital Admin can approve purchase orders", code: "UNAUTHORIZED_APPROVAL" }, { status: 403 })
      }
      if (!["pending_approval", "draft"].includes(po.status)) {
        return NextResponse.json({ error: "PO cannot be approved in its current status", code: "PO_NOT_APPROVABLE" }, { status: 400 })
      }
      const { rows: [updated] } = await queryWithSession({ role: auth.role, userId: auth.userId },
        `UPDATE purchase_orders SET status = 'approved', approved_by = $1, approved_at = now(), updated_at = now()
         WHERE id = $2 RETURNING *`, [auth.userId, id]
      )
      return NextResponse.json({ purchase_order: updated })
    }

    if (action === "cancel") {
      if (["received"].includes(po.status)) {
        return NextResponse.json({ error: "Cannot cancel a received PO" }, { status: 400 })
      }
      const { rows: [updated] } = await queryWithSession({ role: auth.role, userId: auth.userId },
        `UPDATE purchase_orders SET status = 'cancelled', cancelled_by = $1, cancelled_at = now(),
         cancellation_reason = $2, updated_at = now() WHERE id = $3 RETURNING *`,
        [auth.userId, cancellation_reason, id]
      )
      return NextResponse.json({ purchase_order: updated })
    }

    // Generic field update (draft only)
    if (po.status !== "draft") {
      return NextResponse.json({ error: "Only draft POs can be edited" }, { status: 400 })
    }
    const fields: string[] = []
    const values: any[] = []
    let idx = 1
    if (notes !== undefined) { fields.push(`notes = $${idx++}`); values.push(notes) }
    if (expected_delivery_date !== undefined) { fields.push(`expected_delivery_date = $${idx++}`); values.push(expected_delivery_date) }
    if (supplier_id !== undefined) { fields.push(`supplier_id = $${idx++}`); values.push(supplier_id) }
    if (fields.length === 0) return NextResponse.json({ error: "No fields to update" }, { status: 400 })
    fields.push(`updated_at = now()`)
    values.push(id)

    const { rows: [updated] } = await queryWithSession({ role: auth.role, userId: auth.userId },
      `UPDATE purchase_orders SET ${fields.join(", ")} WHERE id = $${idx} RETURNING *`, values
    )
    return NextResponse.json({ purchase_order: updated })
  } catch (err: any) {
    console.error("Error updating purchase order:", err)
    return NextResponse.json({ error: "Failed to update purchase order" }, { status: 500 })
  }
}
```

- [ ] **Step 3: Build check + commit**

```bash
npm run build 2>&1 | grep -E "error TS" | head -20
git add app/api/pharmacy/purchase-orders/
git commit -m "feat(pharmacy): purchase orders API — full CRUD with LPO sequence + approval gate"
```

---

### Task 5: GRN API (Atomic Transaction)

**Files:**
- Create: `app/api/pharmacy/grn/route.ts`
- Create: `app/api/pharmacy/grn/[id]/route.ts`

- [ ] **Step 1: Create `app/api/pharmacy/grn/route.ts`**

```typescript
import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifyToken, can } from "@/lib/security"
import { queryWithSession, withSession } from "@/lib/db"

export async function GET(req: Request) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    const auth = token ? verifyToken(token) : null
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!can(auth.role, "pharmacy", "read")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const { rows } = await queryWithSession({ role: auth.role, userId: auth.userId },
      `SELECT g.*, s.name AS supplier_name, u.full_name AS received_by_name,
              COUNT(gi.id) AS item_count
         FROM goods_received_notes g
    LEFT JOIN suppliers s ON s.id = g.supplier_id
    LEFT JOIN users u ON u.id = g.received_by
    LEFT JOIN grn_items gi ON gi.grn_id = g.id
     GROUP BY g.id, s.name, u.full_name
     ORDER BY g.received_at DESC LIMIT 200`
    )
    return NextResponse.json({ grns: rows })
  } catch (err: any) {
    return NextResponse.json({ error: "Failed to fetch GRNs" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    const auth = token ? verifyToken(token) : null
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!can(auth.role, "pharmacy", "create")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const body = await req.json().catch(() => ({}))
    const { supplier_id, purchase_order_id, invoice_number, notes, items } = body

    if (!supplier_id) return NextResponse.json({ error: "Supplier is required" }, { status: 400 })
    if (!items || items.length === 0) return NextResponse.json({ error: "At least one item is required" }, { status: 400 })

    // Validate linked PO status before starting transaction
    if (purchase_order_id) {
      const { rows: [po] } = await queryWithSession({ role: auth.role, userId: auth.userId },
        `SELECT status FROM purchase_orders WHERE id = $1`, [purchase_order_id]
      )
      if (!po) return NextResponse.json({ error: "Purchase order not found" }, { status: 404 })
      if (!["approved", "partially_received"].includes(po.status)) {
        return NextResponse.json({ error: `Cannot receive stock against a PO with status '${po.status}'. PO must be approved first.`, code: "PO_NOT_APPROVABLE" }, { status: 400 })
      }
    }

    // ⚠️ ALL DML inside withSession — single BEGIN/COMMIT/ROLLBACK
    const grn = await withSession({ role: auth.role, userId: auth.userId }, async (client) => {
      // 1. Insert GRN header
      const { rows: [newGrn] } = await client.query(
        `INSERT INTO goods_received_notes (grn_number, supplier_id, purchase_order_id, invoice_number, received_by, notes)
         VALUES (
           'GRN-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('grn_sequence')::text, 4, '0'),
           $1, $2, $3, $4, $5
         ) RETURNING *`,
        [supplier_id, purchase_order_id || null, invoice_number, auth.userId, notes]
      )

      for (const item of items) {
        // 2. Insert medication batch (FEFO — by expiry_date ASC)
        const { rows: [batch] } = await client.query(
          `INSERT INTO medication_batches (medication_id, batch_number, quantity, expiry_date, received_at, cost_price)
           VALUES ($1, $2, $3, $4, now(), $5) RETURNING id`,
          [item.medication_id, item.batch_number, item.quantity_received, item.expiry_date, item.unit_cost]
        )

        // 3. Insert GRN item with batch_id reference
        await client.query(
          `INSERT INTO grn_items (grn_id, medication_id, batch_id, batch_number, expiry_date, quantity_ordered, quantity_received, unit_cost)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [newGrn.id, item.medication_id, batch.id, item.batch_number, item.expiry_date, item.quantity_ordered ?? null, item.quantity_received, item.unit_cost]
        )

        // 4. Update medication stock
        await client.query(
          `UPDATE medications SET stock_quantity = stock_quantity + $1, last_restocked_at = now() WHERE id = $2`,
          [item.quantity_received, item.medication_id]
        )

        // 5. Insert stock movement audit
        await client.query(
          `INSERT INTO medication_stock_movements (medication_id, movement_type, quantity, reference, batch_number, expiry_date, created_by)
           VALUES ($1, 'receive', $2, $3, $4, $5, $6)`,
          [item.medication_id, item.quantity_received, newGrn.grn_number, item.batch_number, item.expiry_date, auth.userId]
        )
      }

      // 6. Update PO quantities + status if linked
      if (purchase_order_id) {
        for (const item of items) {
          await client.query(
            `UPDATE purchase_order_items
             SET quantity_received = quantity_received + $1
             WHERE purchase_order_id = $2 AND medication_id = $3`,
            [item.quantity_received, purchase_order_id, item.medication_id]
          )
        }
        // Recalculate PO status
        const { rows: [statusCheck] } = await client.query(
          `SELECT
             COUNT(*) AS total,
             COUNT(*) FILTER (WHERE quantity_received >= quantity_ordered) AS fully_received,
             COUNT(*) FILTER (WHERE quantity_received > 0) AS partially_received
           FROM purchase_order_items WHERE purchase_order_id = $1`,
          [purchase_order_id]
        )
        const newStatus = Number(statusCheck.fully_received) === Number(statusCheck.total)
          ? "received"
          : Number(statusCheck.partially_received) > 0 ? "partially_received" : "approved"
        await client.query(
          `UPDATE purchase_orders SET status = $1, updated_at = now() WHERE id = $2`,
          [newStatus, purchase_order_id]
        )
      }

      return newGrn
    })

    return NextResponse.json({ grn }, { status: 201 })
  } catch (err: any) {
    console.error("GRN transaction failed:", err)
    return NextResponse.json({ error: "Stock receipt failed — no changes were made", code: "TRANSACTION_FAILED" }, { status: 500 })
  }
}
```

- [ ] **Step 2: Create `app/api/pharmacy/grn/[id]/route.ts`**

```typescript
import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifyToken, can } from "@/lib/security"
import { queryWithSession } from "@/lib/db"

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    const auth = token ? verifyToken(token) : null
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!can(auth.role, "pharmacy", "read")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const { rows: [grn] } = await queryWithSession({ role: auth.role, userId: auth.userId },
      `SELECT g.*, s.name AS supplier_name, s.address AS supplier_address,
              s.nda_license_number AS supplier_nda,
              u.full_name AS received_by_name
         FROM goods_received_notes g
    LEFT JOIN suppliers s ON s.id = g.supplier_id
    LEFT JOIN users u ON u.id = g.received_by
        WHERE g.id = $1`, [id]
    )
    if (!grn) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const { rows: items } = await queryWithSession({ role: auth.role, userId: auth.userId },
      `SELECT gi.*, m.name AS medication_name, m.generic_name, m.unit_type
         FROM grn_items gi
    LEFT JOIN medications m ON m.id = gi.medication_id
        WHERE gi.grn_id = $1 ORDER BY m.name`, [id]
    )
    return NextResponse.json({ grn, items })
  } catch (err: any) {
    return NextResponse.json({ error: "Failed to fetch GRN" }, { status: 500 })
  }
}
```

- [ ] **Step 3: Build check + commit**

```bash
npm run build 2>&1 | grep -E "error TS" | head -20
git add app/api/pharmacy/grn/
git commit -m "feat(pharmacy): GRN API — atomic stock receipt transaction (withSession), batch tracking, PO status update"
```

---

### Task 6: Atomic Dispense API

**Files:**
- Create: `app/api/pharmacy/dispense/[prescriptionId]/route.ts`

- [ ] **Step 1: Create the route**

```typescript
import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifyToken, can } from "@/lib/security"
import { withSession } from "@/lib/db"

export async function POST(req: Request, { params }: { params: Promise<{ prescriptionId: string }> }) {
  try {
    const { prescriptionId } = await params
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    const auth = token ? verifyToken(token) : null
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!can(auth.role, "pharmacy", "update")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const body = await req.json().catch(() => ({}))
    const { witness_name, dispensing_notes } = body

    // ⚠️ HIGHEST-STAKES TRANSACTION: controlled drug audit trail — ALL steps in ONE withSession
    const result = await withSession({ role: auth.role, userId: auth.userId }, async (client) => {
      // 1. Fetch and lock prescription
      const { rows: [prescription] } = await client.query(
        `SELECT p.*, m.name AS medication_name, m.stock_quantity, m.is_controlled,
                m.schedule_class, m.id AS medication_id,
                pat.first_name, pat.last_name
           FROM prescriptions p
      LEFT JOIN medications m ON m.name = p.medication_name
      LEFT JOIN patients pat ON pat.id = p.patient_id
          WHERE p.id = $1 FOR UPDATE`, [prescriptionId]
      )
      if (!prescription) throw Object.assign(new Error("Prescription not found"), { code: "MEDICATION_NOT_FOUND" })
      if (prescription.status !== "active") throw Object.assign(new Error("Prescription already dispensed"), { code: "PRESCRIPTION_ALREADY_DISPENSED" })
      // Guard: name-based join may fail if medication name doesn't match exactly
      if (!prescription.medication_id) throw Object.assign(new Error(`Medication "${prescription.medication_name}" not found in inventory. Ensure the medication name matches exactly.`), { code: "MEDICATION_NOT_FOUND" })

      const qty = Number(prescription.quantity) || 1

      // 2. Verify stock (FEFO — earliest expiry batch first)
      const { rows: batches } = await client.query(
        `SELECT * FROM medication_batches
          WHERE medication_id = $1 AND quantity > 0
          ORDER BY expiry_date ASC, received_at ASC`,
        [prescription.medication_id]
      )
      const totalAvailable = batches.reduce((sum: number, b: any) => sum + Number(b.quantity), 0)
      if (totalAvailable < qty) {
        throw Object.assign(new Error(`Insufficient stock. Available: ${totalAvailable}, Required: ${qty}`), { code: "INSUFFICIENT_STOCK" })
      }

      // Deduct from batches in FEFO order
      let remaining = qty
      const usedBatches: { id: string; batch_number: string; expiry_date: string; qty: number }[] = []
      for (const batch of batches) {
        if (remaining <= 0) break
        const deduct = Math.min(remaining, Number(batch.quantity))
        await client.query(`UPDATE medication_batches SET quantity = quantity - $1 WHERE id = $2`, [deduct, batch.id])
        usedBatches.push({ id: batch.id, batch_number: batch.batch_number, expiry_date: batch.expiry_date, qty: deduct })
        remaining -= deduct
      }
      const primaryBatch = usedBatches[0]

      // 3. Update prescription status
      await client.query(
        `UPDATE prescriptions SET status = 'dispensed', dispensed_at = now(), dispensed_by = $1 WHERE id = $2`,
        [auth.userId, prescriptionId]
      )

      // 4. Deduct medication stock total
      await client.query(
        `UPDATE medications SET stock_quantity = stock_quantity - $1 WHERE id = $2`,
        [qty, prescription.medication_id]
      )

      // 5. Insert stock movement
      await client.query(
        `INSERT INTO medication_stock_movements (medication_id, movement_type, quantity, reference, batch_number, expiry_date, created_by)
         VALUES ($1, 'dispense', $2, $3, $4, $5, $6)`,
        [prescription.medication_id, qty, prescriptionId, primaryBatch?.batch_number, primaryBatch?.expiry_date, auth.userId]
      )

      // 6. Controlled drug register (if is_controlled)
      if (prescription.is_controlled) {
        // Compute running balance from all prior entries (server-side — never trust client)
        const { rows: [balanceRow] } = await client.query(
          `SELECT
             COALESCE(SUM(CASE WHEN entry_type IN ('receipt','opening_balance') THEN quantity_dispensed ELSE -quantity_dispensed END), 0) AS computed_balance,
             COALESCE((SELECT running_balance FROM controlled_drug_register WHERE medication_id = $1 ORDER BY dispensed_at DESC LIMIT 1), 0) AS last_stored_balance
           FROM controlled_drug_register WHERE medication_id = $1`,
          [prescription.medication_id]
        )
        // Integrity check: computed must match last stored (NDA compliance requirement)
        if (balanceRow.last_stored_balance !== 0 && Number(balanceRow.computed_balance) !== Number(balanceRow.last_stored_balance)) {
          throw Object.assign(
            new Error("Controlled drug register balance mismatch — dispense blocked for safety. Contact Hospital Admin."),
            { code: "CONTROLLED_DRUG_BALANCE_MISMATCH" }
          )
        }
        const newBalance = Number(balanceRow.computed_balance) - qty
        await client.query(
          `INSERT INTO controlled_drug_register
           (medication_id, patient_id, prescription_id, prescriber_name, prescriber_registration_number,
            quantity_dispensed, batch_number, running_balance, dispensed_by, witness_name, entry_type, notes)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'dispense',$11)`,
          [
            prescription.medication_id, prescription.patient_id, prescriptionId,
            prescription.prescriber_name || "Unknown", prescription.prescriber_registration_number,
            qty, primaryBatch?.batch_number, newBalance, auth.userId,
            witness_name || null, dispensing_notes || null
          ]
        )
      }

      return { prescription, primaryBatch, usedBatches, qty }
    })

    // 7. Post-transaction: insert low-stock notification directly via DB if needed (no self-fetch)
    try {
      const { query } = await import("@/lib/db")
      const { rows: [med] } = await query(
        `SELECT stock_quantity, reorder_level, name FROM medications WHERE id = $1`,
        [result.prescription.medication_id]
      )
      if (med && Number(med.stock_quantity) <= Number(med.reorder_level)) {
        // Insert notification directly — avoids self-HTTP-fetch and cookie forwarding
        await query(
          `INSERT INTO notifications (title, message, type, priority, payload, created_by)
           VALUES ($1, $2, 'pharmacy_low_stock', 'High', $3::jsonb, $4)`,
          [
            "Low Stock Alert",
            `${med.name} is below reorder level (${med.stock_quantity} remaining)`,
            JSON.stringify({ medicationId: result.prescription.medication_id, medicationName: med.name, initialTab: "inventory" }),
            auth.userId
          ]
        )
      }
    } catch {} // Never fail the dispense response over a notification insert

    return NextResponse.json({ success: true, prescription_id: prescriptionId })
  } catch (err: any) {
    console.error("Dispense transaction failed:", err)
    const code = err.code || "TRANSACTION_FAILED"
    const status = code === "PRESCRIPTION_ALREADY_DISPENSED" ? 409
      : code === "INSUFFICIENT_STOCK" ? 422
      : code === "MEDICATION_NOT_FOUND" ? 404
      : 500
    return NextResponse.json({
      error: err.message || "Dispensing failed — no changes were made. Please try again or contact support.",
      code
    }, { status })
  }
}
```

- [ ] **Step 2: Build check + commit**

```bash
npm run build 2>&1 | grep -E "error TS" | head -20
git add app/api/pharmacy/dispense/
git commit -m "feat(pharmacy): atomic dispense endpoint — single withSession transaction, FEFO batches, controlled drug register"
```

---

### Task 7: Controlled Drugs Register API

**Files:**
- Create: `app/api/pharmacy/controlled-drugs/route.ts`
- Create: `app/api/pharmacy/controlled-drugs/export/route.ts`

- [ ] **Step 1: Create `app/api/pharmacy/controlled-drugs/route.ts`**

```typescript
import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifyToken, can } from "@/lib/security"
import { queryWithSession } from "@/lib/db"

export async function GET(req: Request) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    const auth = token ? verifyToken(token) : null
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!can(auth.role, "pharmacy", "read")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const { searchParams } = new URL(req.url)
    const medicationId = searchParams.get("medication_id")
    const from = searchParams.get("from")
    const to = searchParams.get("to")
    const page = parseInt(searchParams.get("page") || "1")
    const limit = 50
    const offset = (page - 1) * limit

    let where = "WHERE 1=1"
    const params: any[] = []
    let idx = 1
    if (medicationId) { where += ` AND cdr.medication_id = $${idx++}`; params.push(medicationId) }
    if (from) { where += ` AND cdr.dispensed_at >= $${idx++}`; params.push(from) }
    if (to) { where += ` AND cdr.dispensed_at <= $${idx++}`; params.push(to) }

    const { rows } = await queryWithSession({ role: auth.role, userId: auth.userId },
      `SELECT cdr.*,
              m.name AS medication_name, m.schedule_class,
              p.first_name || ' ' || p.last_name AS patient_name,
              u.full_name AS dispensed_by_name
         FROM controlled_drug_register cdr
    LEFT JOIN medications m ON m.id = cdr.medication_id
    LEFT JOIN patients p ON p.id = cdr.patient_id
    LEFT JOIN users u ON u.id = cdr.dispensed_by
        ${where}
     ORDER BY cdr.dispensed_at DESC
        LIMIT $${idx++} OFFSET $${idx++}`,
      [...params, limit, offset]
    )

    const { rows: [{ total }] } = await queryWithSession({ role: auth.role, userId: auth.userId },
      `SELECT COUNT(*) AS total FROM controlled_drug_register cdr ${where}`, params
    )

    return NextResponse.json({ entries: rows, total: Number(total), page, limit })
  } catch (err: any) {
    return NextResponse.json({ error: "Failed to fetch controlled drugs register" }, { status: 500 })
  }
}
```

- [ ] **Step 2: Create export route (`app/api/pharmacy/controlled-drugs/export/route.ts`)**

```typescript
import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifyToken } from "@/lib/security"
import { queryWithSession } from "@/lib/db"

export async function GET(req: Request) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    const auth = token ? verifyToken(token) : null
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (auth.role !== "Hospital Admin") {
      return NextResponse.json({ error: "Only Hospital Admin can export the controlled drugs register", code: "FORBIDDEN" }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const from = searchParams.get("from")
    const to = searchParams.get("to")
    const medicationId = searchParams.get("medication_id")

    let where = "WHERE 1=1"
    const params: any[] = []
    let idx = 1
    if (medicationId) { where += ` AND cdr.medication_id = $${idx++}`; params.push(medicationId) }
    if (from) { where += ` AND cdr.dispensed_at >= $${idx++}`; params.push(from) }
    if (to) { where += ` AND cdr.dispensed_at <= $${idx++}`; params.push(to) }

    const { rows } = await queryWithSession({ role: auth.role, userId: auth.userId },
      `SELECT cdr.dispensed_at, m.name AS medication_name, m.schedule_class,
              p.first_name || ' ' || p.last_name AS patient_name,
              cdr.prescriber_name, cdr.prescriber_registration_number,
              cdr.quantity_dispensed, cdr.batch_number, cdr.running_balance,
              u.full_name AS dispensed_by_name, cdr.witness_name, cdr.notes
         FROM controlled_drug_register cdr
    LEFT JOIN medications m ON m.id = cdr.medication_id
    LEFT JOIN patients p ON p.id = cdr.patient_id
    LEFT JOIN users u ON u.id = cdr.dispensed_by
        ${where}
     ORDER BY m.name ASC, cdr.dispensed_at ASC`,
      params
    )

    // Return as JSON — frontend generates the PDF using jspdf (same pattern as financial reports)
    return NextResponse.json({ entries: rows, generated_at: new Date().toISOString(), generated_by: auth.userId })
  } catch (err: any) {
    return NextResponse.json({ error: "Failed to export controlled drugs register" }, { status: 500 })
  }
}
```

- [ ] **Step 3: Build check + commit**

```bash
npm run build 2>&1 | grep -E "error TS" | head -20
git add app/api/pharmacy/controlled-drugs/
git commit -m "feat(pharmacy): controlled drugs register API — paginated GET, admin-only export"
```

---

## Phase 2 — UI Components

### Task 8: Pharmacy Context Updates

**Files:**
- Modify: `lib/pharmacy-context.tsx`

- [ ] **Step 1: Read the current context to understand its shape**

Read `lib/pharmacy-context.tsx` lines 1–477 before making any edits.

- [ ] **Step 2: Add supplier state + fetch**

Find the `PharmacyProvider` function and add:
1. `const [suppliers, setSuppliers] = useState<Supplier[]>([])`
2. A `refreshSuppliers` function that fetches from `/api/pharmacy/suppliers`
3. Call `refreshSuppliers()` inside the existing `useEffect` that fetches medications

- [ ] **Step 3: Add purchase order state + CRUD functions**

Add:
- `const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([])`
- `refreshPurchaseOrders()` — fetches from `/api/pharmacy/purchase-orders`
- `createPurchaseOrder(data)` — POSTs to `/api/pharmacy/purchase-orders`, refreshes list
- `approvePurchaseOrder(id)` — PATCHes with `{ action: "approve" }`
- `cancelPurchaseOrder(id, reason)` — PATCHes with `{ action: "cancel", cancellation_reason: reason }`

- [ ] **Step 4: Add GRN state + create function**

Add:
- `const [grns, setGrns] = useState<GRN[]>([])`
- `refreshGrns()` — fetches from `/api/pharmacy/grn`
- `createGrn(data)` — POSTs to `/api/pharmacy/grn`

- [ ] **Step 5: Add pharmacy settings state**

Add:
- `const [pharmacySettings, setPharmacySettings] = useState<PharmacySettings | null>(null)`
- `refreshPharmacySettings()` — fetches from `/api/pharmacy/settings`
- `updatePharmacySettings(data)` — PATCHes `/api/pharmacy/settings`

- [ ] **Step 6: Export all new state + functions from context value**

Ensure the context value object includes: `suppliers`, `refreshSuppliers`, `purchaseOrders`, `refreshPurchaseOrders`, `createPurchaseOrder`, `approvePurchaseOrder`, `cancelPurchaseOrder`, `grns`, `refreshGrns`, `createGrn`, `pharmacySettings`, `updatePharmacySettings`.

- [ ] **Step 7: Build check + commit**

```bash
npm run build 2>&1 | grep -E "error TS" | head -20
git add lib/pharmacy-context.tsx
git commit -m "feat(pharmacy): context — add suppliers, POs, GRNs, settings state + API functions"
```

---

### Task 9: Notification Bell

**Files:**
- Create: `components/pharmacy/pharmacist-notification-bell.tsx`

- [ ] **Step 1: Create the component**

Model it exactly after `components/billing/cashier-notification-bell.tsx`. Key differences:
- Function name: `PharmacistNotificationBell`
- Filter function: `isPharmacyNotification` — checks for `pharmacy_low_stock`, `pharmacy_expiry_warning`, `pharmacy_new_prescription`, `pharmacy_po_approved` in `n.type` or keywords in title/message
- Deep-link handler: dispatches `openPharmacistDesk` custom event (already handled in dashboard)
- Notification type → icon mapping (instead of billing types, use pharmacy types):

```typescript
function getNotificationIcon(n: ApiNotification) {
  const type = n.type ?? ""
  if (type === "pharmacy_low_stock") return <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-red-500" />
  if (type === "pharmacy_expiry_warning") return <Clock className="h-3.5 w-3.5 shrink-0 text-yellow-500" />
  if (type === "pharmacy_new_prescription") return <FileText className="h-3.5 w-3.5 shrink-0 text-green-500" />
  if (type === "pharmacy_po_approved") return <CheckCircle className="h-3.5 w-3.5 shrink-0 text-blue-500" />
  return <Bell className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
}
```

- Deep-link payload mapping:
  - `pharmacy_low_stock` → `openPharmacistDesk` with `{ initialTab: "inventory" }`
  - `pharmacy_expiry_warning` → `{ initialTab: "inventory", filterExpiry: true }`
  - `pharmacy_new_prescription` → `{ initialTab: "prescriptions", prescriptionId: payload.prescriptionId }`
  - `pharmacy_po_approved` → `{ initialTab: "purchase-orders" }`

- [ ] **Step 2: Build check + commit**

```bash
npm run build 2>&1 | grep -E "error TS" | head -20
git add components/pharmacy/pharmacist-notification-bell.tsx
git commit -m "feat(pharmacy): pharmacist notification bell — polls /api/notifications, pharmacy-specific types + deep-links"
```

---

### Task 10: GRN Component

**Files:**
- Create: `components/pharmacy/goods-received-note.tsx`

- [ ] **Step 1: Create the component**

The component has two states: **form mode** and **print mode**.

**Form mode structure:**
```tsx
// Top: PO selector (Combobox showing approved POs) OR "Direct Receipt" option
// When PO selected: auto-populate supplier and line items from PO
// Fields: supplier (auto or manual select), invoice_number, received_at, notes
// Items table (editable):
//   | Medication | Batch No. | Expiry Date | Qty Ordered | Qty Received | Unit Cost | Remove |
// "Add Item" button to add rows manually
// Submit button: calls context.createGrn(data)
// Error display: form stays open, shows error message
```

**Print mode** (shown after successful submit):
```tsx
// Header: facility name, GRN number, date, supplier info
// Table of items with totals
// Footer: Received by (name + signature line), Witness signature line
// @media print CSS: hide all UI chrome, show only print content
// "Print" button + "New Receipt" button
```

Key implementation notes:
- When a PO is selected from the dropdown, pre-fill `supplier_id`, `supplier_name`, and all line items with `quantity_ordered` from `purchase_order_items`. Allow `quantity_received` to be edited per item.
- Date input for `expiry_date` per line item — required.
- `batch_number` per line item — required.
- On submit: call `withSession` via the API (the component just calls `createGrn()` from context).
- On success: switch to print mode with the returned GRN data.

- [ ] **Step 2: Build check + commit**

```bash
npm run build 2>&1 | grep -E "error TS" | head -20
git add components/pharmacy/goods-received-note.tsx
git commit -m "feat(pharmacy): GRN component — stock receipt form with PO pre-fill + printable output"
```

---

### Task 11: Purchase Orders — Rebuild

**Files:**
- Modify: `components/pharmacy/purchase-orders.tsx` (full rebuild)

- [ ] **Step 1: Read existing file first**

```bash
# Read the file to understand current local-state-only structure before overwriting
```

- [ ] **Step 2: Rebuild the component**

Replace the existing local-state implementation with an API-backed version. Structure:

```tsx
// List view (default):
//   Toolbar: "New LPO" button, status filter tabs (All / Draft / Pending / Approved / Received / Cancelled)
//   Table: po_number | supplier | status badge | items | total value | expected delivery | actions
//   Actions: View (opens detail sheet), Receive (opens GRN tab pre-filled), Cancel (confirmation dialog)
//   Admin-only: Approve button shown only when role === "Hospital Admin"

// New LPO multi-step dialog (3 steps):
//   Step 1: Supplier select (from suppliers list), expected delivery date, notes
//   Step 2: Line items — medication search, qty ordered, unit cost, notes. Add/remove rows.
//   Step 3: Review — shows all items with subtotals, total. Submit as Draft or Submit for Approval.

// Status badge color map:
const STATUS_COLORS = {
  draft: "bg-gray-100 text-gray-700",
  pending_approval: "bg-yellow-100 text-yellow-800",
  approved: "bg-green-100 text-green-800",
  partially_received: "bg-blue-100 text-blue-800",
  received: "bg-teal-100 text-teal-800",
  cancelled: "bg-red-100 text-red-700",
}
```

Data: read from `context.purchaseOrders` (populated via `refreshPurchaseOrders` called in `useEffect`).

Receive button: sets a `prefilledPoId` state and calls `onSwitchToGrnTab(poId)` — a prop passed from the dashboard that switches the active tab to "grn".

- [ ] **Step 3: Build check + commit**

```bash
npm run build 2>&1 | grep -E "error TS" | head -20
git add components/pharmacy/purchase-orders.tsx
git commit -m "feat(pharmacy): purchase orders component rebuild — API-backed, multi-step dialog, approve/cancel"
```

---

### Task 12: Supplier Management — Wire to API

**Files:**
- Modify: `components/pharmacy/supplier-management.tsx`

- [ ] **Step 1: Read existing file**

Read `components/pharmacy/supplier-management.tsx` to understand current local-state structure.

- [ ] **Step 2: Replace local state with context**

- Replace `const [suppliers, setSuppliers] = useState([])` with `const { suppliers, refreshSuppliers } = usePharmacy()`
- Call `refreshSuppliers()` in a `useEffect` on mount
- For add/edit: the form should call the API directly (`POST /api/pharmacy/suppliers` or `PATCH /api/pharmacy/suppliers/[id]`) — these are admin-only, so show the form only when `role === "Hospital Admin"`
- For delete: `DELETE /api/pharmacy/suppliers/[id]` with a confirmation dialog
- For pharmacists (non-admin): show read-only supplier list only — no add/edit/delete buttons

- [ ] **Step 3: Build check + commit**

```bash
npm run build 2>&1 | grep -E "error TS" | head -20
git add components/pharmacy/supplier-management.tsx
git commit -m "feat(pharmacy): supplier management wired to real API — admin write, pharmacist read-only"
```

---

### Task 13: Prescription Dispense — Wire to Atomic Endpoint

**Files:**
- Modify: `components/pharmacy/prescription-dispense.tsx`

- [ ] **Step 1: Read existing file**

Read `components/pharmacy/prescription-dispense.tsx` to locate the current dispense call (likely calls `updatePrescription` from medical-context + `updateMedication` from pharmacy-context separately).

- [ ] **Step 2: Replace two-call pattern with single atomic call**

Find and replace the current multi-call dispense logic with:
```typescript
const res = await fetch(`/api/pharmacy/dispense/${prescriptionId}`, {
  method: "POST",
  credentials: "include",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ witness_name, dispensing_notes }),
})
const data = await res.json()
if (!res.ok) {
  setError(data.error || "Dispensing failed — no changes were made. Please try again or contact support.")
  return
}
// Refresh contexts post-dispense
await Promise.all([refreshMedications(), refreshPrescriptions()])
onSuccess?.()
```

The form must stay open on error (do not close dialog on failure).

- [ ] **Step 3: Build check + commit**

```bash
npm run build 2>&1 | grep -E "error TS" | head -20
git add components/pharmacy/prescription-dispense.tsx
git commit -m "fix(pharmacy): atomic prescription dispense — replace dual-context calls with single /api/pharmacy/dispense endpoint"
```

---

### Task 14: Controlled Drugs Register Page + Component

**Files:**
- Create: `components/pharmacy/controlled-drugs-register.tsx`
- Create: `app/pharmacist/controlled-drugs/page.tsx`

- [ ] **Step 1: Create the register component**

```tsx
// components/pharmacy/controlled-drugs-register.tsx
// Props: none — fetches its own data

// Toolbar:
//   - Date range picker (from / to)
//   - Medication filter (select from medications list)
//   - Search input
//   - Export PDF button (shown only for Hospital Admin)

// Table columns:
//   Date & Time | Patient | Prescriber (Name + Reg. No.) | Medication (+ Schedule) |
//   Qty Dispensed | Running Balance | Dispensed By | Witness | Notes

// Pagination: 50 rows per page, Previous/Next buttons

// Export: calls GET /api/pharmacy/controlled-drugs/export with current filters
//   Generates PDF using jspdf (same pattern as financial-pdf.tsx in lib/reports/)
//   PDF layout: facility name header, NDA license number, "CONTROLLED DRUGS REGISTER" title,
//   table of entries, signature line at bottom of each page

// @media print CSS: hide toolbar, show table full-width
```

- [ ] **Step 2: Create the page**

```tsx
// app/pharmacist/controlled-drugs/page.tsx
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { ControlledDrugsRegister } from "@/components/pharmacy/controlled-drugs-register"
import { Shield } from "lucide-react"

export default function ControlledDrugsPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6 p-6">
        <div className="flex items-center gap-3">
          <Shield className="h-6 w-6 text-red-600" />
          <div>
            <h1 className="text-2xl font-bold">Controlled Drugs Register</h1>
            <p className="text-sm text-muted-foreground">
              NDA-mandated register — Schedule I / II / III substances only
            </p>
          </div>
        </div>
        <ControlledDrugsRegister />
      </div>
    </DashboardLayout>
  )
}
```

- [ ] **Step 3: Build check + commit**

```bash
npm run build 2>&1 | grep -E "error TS" | head -20
git add components/pharmacy/controlled-drugs-register.tsx app/pharmacist/controlled-drugs/page.tsx
git commit -m "feat(pharmacy): controlled drugs register page + component — NDA-compliant, admin-only PDF export"
```

---

### Task 15: Pharmacy Preferences Settings

**Files:**
- Create: `components/pharmacy/pharmacy-preferences-settings.tsx`
- Modify: `app/pharmacist/settings/page.tsx`

- [ ] **Step 1: Create the settings component**

```tsx
// components/pharmacy/pharmacy-preferences-settings.tsx
"use client"
// Fetches from GET /api/pharmacy/settings on mount
// Sections: Stock Alerts, Dispensing Defaults, Print Preferences, Notification Preferences
// Each section is a Card with a form that saves on blur or via explicit Save button
// Uses shadcn/ui: Input, Switch, Select, Label, Card, Button

export function PharmacyPreferencesSettings() {
  const [settings, setSettings] = useState<PharmacySettings | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch("/api/pharmacy/settings", { credentials: "include" })
      .then(r => r.json()).then(d => setSettings(d.settings))
  }, [])

  const save = async (patch: Partial<PharmacySettings>) => {
    setSaving(true)
    await fetch("/api/pharmacy/settings", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch)
    })
    setSettings(prev => prev ? { ...prev, ...patch } : prev)
    setSaving(false)
  }

  // ... render sections
}
```

- [ ] **Step 2: Add the tab to the settings page**

In `app/pharmacist/settings/page.tsx`, import `PharmacyPreferencesSettings` and add it to the `SettingsColumns` primary column:

```tsx
import { PharmacyPreferencesSettings } from "@/components/pharmacy/pharmacy-preferences-settings"

// In SettingsColumns primary:
<>
  <ProfileSettings />
  <PreferenceSettings />
  <PharmacyPreferencesSettings />
</>
```

- [ ] **Step 3: Build check + commit**

```bash
npm run build 2>&1 | grep -E "error TS" | head -20
git add components/pharmacy/pharmacy-preferences-settings.tsx app/pharmacist/settings/page.tsx
git commit -m "feat(pharmacy): pharmacy preferences settings — stock thresholds, print format, notification toggles"
```

---

### Task 16: Dashboard — Wire Bell, Tabs, Controlled Drugs Link

**Files:**
- Modify: `components/dashboards/pharmacist-dashboard.tsx`

- [ ] **Step 1: Read the full dashboard file**

Read `components/dashboards/pharmacist-dashboard.tsx` in full before editing.

- [ ] **Step 2: Add notification bell import + placement**

Add to imports:
```tsx
import { PharmacistNotificationBell } from "@/components/pharmacy/pharmacist-notification-bell"
```

Place the bell in the dashboard header area (find where the scan input / header row lives and place bell aligned right, same position as `CashierNotificationBell` in cashier dashboard).

- [ ] **Step 3: Update tab type + add new tabs**

Current tab type: `"prescriptions" | "inventory" | "valuation" | "reorder" | "stocktaking" | "analytics" | "abc" | "adjustments" | "suppliers"`

New tab type (12 tabs — ABC Analysis merged into "valuation" tab as a sub-section, no separate tab):
```typescript
type Tab = "prescriptions" | "dispense" | "inventory" | "reorder" | "stocktaking" | "purchase-orders" | "grn" | "suppliers" | "analytics" | "valuation" | "adjustments" | "non-medication"
```
Note: `"abc"` tab is removed as a standalone value. `ABCAnalysis` component is rendered inside the `"valuation"` tab content alongside `InventoryValuation` (they were already listed as "Valuation / ABC" in the spec). Update all existing references to `tab === "abc"` accordingly.

Update `useState` default to `"prescriptions"`.

- [ ] **Step 4: Add GRN tab and PO → GRN cross-link**

Import new components:
```tsx
import { GoodsReceivedNote } from "@/components/pharmacy/goods-received-note"
import { PharmacistNotificationBell } from "@/components/pharmacy/pharmacist-notification-bell"
```

Add `TabsTrigger` and `TabsContent` for `"grn"` tab.

Add a `prefilledPoId` state and pass `onSwitchToGrnTab={(id) => { setPrefilledPoId(id); setTab("grn") }}` prop to the PurchaseOrders component.

- [ ] **Step 5: Add "Controlled Drugs" link button in dashboard header**

```tsx
import Link from "next/link"
import { Shield } from "lucide-react"

// In header area:
<Button variant="outline" size="sm" asChild>
  <Link href="/pharmacist/controlled-drugs">
    <Shield className="mr-1.5 h-3.5 w-3.5 text-red-600" />
    Controlled Drugs
  </Link>
</Button>
```

- [ ] **Step 6: Handle `initialTab` deep-link from notification bell**

In the existing `openPharmacistDesk` event handler, add handling for `detail.initialTab`:
```typescript
if (detail.initialTab) setTab(detail.initialTab as Tab)
```

- [ ] **Step 7: Build check + commit**

```bash
npm run build 2>&1 | grep -E "error TS" | head -20
git add components/dashboards/pharmacist-dashboard.tsx
git commit -m "feat(pharmacy): dashboard — notification bell, GRN tab, controlled drugs link, 12-tab structure"
```

---

## Phase 3 — Design Polish

### Task 17: Prescription Queue — Controlled Drug Badge

**Files:**
- Modify: `components/pharmacy/prescription-queue.tsx`

- [ ] **Step 1: Read the file, then add controlled drug badge**

Find where prescription items are rendered. Add a badge next to the medication name for prescriptions where `is_controlled_substance === true`:

```tsx
{prescription.is_controlled_substance && (
  <Badge variant="destructive" className="ml-1.5 px-1.5 py-0 text-[10px] uppercase tracking-wide">
    Controlled
  </Badge>
)}
```

- [ ] **Step 2: Build check + commit**

```bash
npm run build 2>&1 | grep -E "error TS" | head -20
git add components/pharmacy/prescription-queue.tsx
git commit -m "feat(pharmacy): controlled drug badge on prescription queue items"
```

---

### Task 18: Medication Inventory — Controlled Fields + Polish

**Files:**
- Modify: `components/pharmacy/medication-inventory.tsx`

- [ ] **Step 1: Add `is_controlled` and `schedule_class` to the add/edit form**

In the `AddMedicationDialog` (or inline form), add:
- A `Switch` for "Controlled Substance" (`is_controlled`)
- A `Select` for Schedule Class (Schedule I / II / III) — only shown when `is_controlled = true`

Update the `Medication` interface/type to include `is_controlled: boolean` and `schedule_class: string | null`.

In `app/api/pharmacy/medications/route.ts`, update the GET SELECT to include the new fields:
```typescript
// Add to the SELECT list in the GET query:
is_controlled,
schedule_class
```

In the POST handler, accept and insert:
```typescript
const { ..., isControlled, scheduleClass } = body
// Add to INSERT VALUES:
// is_controlled = isControlled ?? false
// schedule_class = scheduleClass || null
```

In the PATCH handler (`app/api/pharmacy/medications/[id]/route.ts`), accept:
```typescript
if ('isControlled' in body) { fields.push(`is_controlled = $${idx++}`); values.push(body.isControlled) }
if ('scheduleClass' in body) { fields.push(`schedule_class = $${idx++}`); values.push(body.scheduleClass) }
```

- [ ] **Step 2: Polish — unified card header, empty state, skeleton loader**

- Ensure the card header uses `CardHeader > CardTitle + CardDescription + right-aligned actions`
- Add empty state when no medications: `<PackageX className="h-8 w-8" /> No medications found. Add your first medication to get started.`
- Replace any raw loading spinner with a skeleton table (3-5 row skeleton)

- [ ] **Step 3: Build check + commit**

```bash
npm run build 2>&1 | grep -E "error TS" | head -20
git add components/pharmacy/medication-inventory.tsx app/api/pharmacy/medications/route.ts
git commit -m "feat(pharmacy): medication inventory — is_controlled/schedule_class fields, card polish, empty state, skeleton"
```

---

### Task 19: Polish Remaining Components

**Files:**
- Modify: `components/pharmacy/stock-taking.tsx`
- Modify: `components/pharmacy/usage-analytics.tsx`
- Modify: `components/pharmacy/inventory-valuation.tsx`
- Modify: `components/pharmacy/abc-analysis.tsx`
- Modify: `components/pharmacy/stock-adjustments.tsx`
- Modify: `components/pharmacy/reorder-suggestions.tsx`

Apply the same polish pattern to each:

**For each component:**

- [ ] **Read the file** before editing
- [ ] **Unified card header** — `CardHeader` with `CardTitle` + `CardDescription` + right-aligned action buttons
- [ ] **Empty state** — when list/table is empty, show an icon + message + optional CTA instead of blank space
- [ ] **Skeleton loader** — replace `{loading && <Spinner />}` with a skeleton that matches the expected content shape
- [ ] **Confirmation dialog for destructive actions** — in `stock-adjustments.tsx`, wrap downward adjustments with an `AlertDialog`:
  ```tsx
  <AlertDialog>
    <AlertDialogTrigger asChild><Button variant="destructive">Remove Stock</Button></AlertDialogTrigger>
    <AlertDialogContent>
      <AlertDialogTitle>Remove stock?</AlertDialogTitle>
      <AlertDialogDescription>This will permanently reduce inventory and cannot be undone.</AlertDialogDescription>
      <AlertDialogFooter>
        <AlertDialogCancel>Cancel</AlertDialogCancel>
        <AlertDialogAction onClick={handleRemove}>Confirm Remove</AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
  ```

- [ ] **Build check + commit after all 6 components**

```bash
npm run build 2>&1 | grep -E "error TS" | head -20
git add components/pharmacy/stock-taking.tsx components/pharmacy/usage-analytics.tsx \
        components/pharmacy/inventory-valuation.tsx components/pharmacy/abc-analysis.tsx \
        components/pharmacy/stock-adjustments.tsx components/pharmacy/reorder-suggestions.tsx
git commit -m "feat(pharmacy): polish pass — unified card headers, empty states, skeleton loaders, confirmation dialogs"
```

---

### Task 20: Print CSS + Mobile Responsiveness

**Files:**
- Modify: `components/pharmacy/goods-received-note.tsx`
- Modify: `components/pharmacy/purchase-orders.tsx`
- Modify: `components/pharmacy/controlled-drugs-register.tsx`

**Print CSS** — add to each printable component using Tailwind's `print:` variant:

```tsx
{/* Print-only header — hidden in browser */}
<div className="hidden print:block mb-6">
  <h1 className="text-xl font-bold">Dayspring Hospital</h1>
  <p className="text-sm">NDA License: [from settings]</p>
  <hr className="my-2" />
</div>

{/* Hide UI chrome when printing */}
<div className="print:hidden"> {/* toolbar, buttons, nav */} </div>

{/* Table — full width in print */}
<table className="w-full print:text-xs">
```

**Mobile responsiveness** — for each component that has an overflowing table:
- Wrap table in `<div className="overflow-x-auto">`
- Add a card-list view for screens below 768px using `hidden sm:block` (table) and `block sm:hidden` (card list)

Card-list item pattern (for mobile):
```tsx
<div className="sm:hidden space-y-2">
  {items.map(item => (
    <div key={item.id} className="rounded-lg border p-3 text-sm">
      <div className="font-medium">{item.name}</div>
      <div className="text-muted-foreground">{item.detail}</div>
    </div>
  ))}
</div>
```

- [ ] **Build check + commit**

```bash
npm run build 2>&1 | grep -E "error TS" | head -20
git add components/pharmacy/goods-received-note.tsx components/pharmacy/purchase-orders.tsx \
        components/pharmacy/controlled-drugs-register.tsx
git commit -m "feat(pharmacy): print CSS and mobile card-list layouts for GRN, PO, controlled drugs register"
```

---

### Task 21: Final Verification

- [ ] **Step 1: Full build**

```bash
npm run build
```
Expected: 0 errors, 0 TypeScript errors.

- [ ] **Step 2: Manual browser verification checklist**

Start dev server: `npm run dev`

Log in as **Pharmacist**:
- [ ] Dashboard loads — 12 tabs visible, notification bell in header, "Controlled Drugs" button visible
- [ ] Prescriptions tab — controlled drug badge appears on relevant prescriptions
- [ ] Dispense a prescription — confirm it completes atomically (check network tab: single POST to `/api/pharmacy/dispense/[id]`)
- [ ] Medications tab — `is_controlled` toggle and `schedule_class` select visible in add/edit form
- [ ] Purchase Orders tab — "New LPO" opens 3-step dialog, creates a draft PO, PO appears in list
- [ ] GRN tab — "Direct Receipt" mode works, form submits, printable GRN appears
- [ ] Suppliers tab — shows supplier list (read-only for pharmacist — no add/edit buttons)
- [ ] Settings → Pharmacy tab — preferences form loads and saves
- [ ] Notification bell — shows dropdown, "Mark all read" works
- [ ] Controlled Drugs page (`/pharmacist/controlled-drugs`) loads

Log in as **Hospital Admin**:
- [ ] Purchase Orders — Approve button visible, clicking approves a PO
- [ ] Suppliers tab — Add/Edit/Delete buttons visible
- [ ] Controlled Drugs page — Export PDF button visible

- [ ] **Step 3: Final commit + push**

```bash
git add -A
git status  # verify no untracked sensitive files
git commit -m "feat(pharmacy): production-ready — complete audit, all gaps closed, NDA-compliant"
git push
```

---

## File Map Summary

### New Files (16)
| File | Task |
|------|------|
| `migrations/0028_pharmacy_production_ready.sql` | Task 1 |
| `app/api/pharmacy/settings/route.ts` | Task 2 |
| `app/api/pharmacy/suppliers/route.ts` | Task 3 |
| `app/api/pharmacy/suppliers/[id]/route.ts` | Task 3 |
| `app/api/pharmacy/purchase-orders/route.ts` | Task 4 |
| `app/api/pharmacy/purchase-orders/[id]/route.ts` | Task 4 |
| `app/api/pharmacy/grn/route.ts` | Task 5 |
| `app/api/pharmacy/grn/[id]/route.ts` | Task 5 |
| `app/api/pharmacy/dispense/[prescriptionId]/route.ts` | Task 6 |
| `app/api/pharmacy/controlled-drugs/route.ts` | Task 7 |
| `app/api/pharmacy/controlled-drugs/export/route.ts` | Task 7 |
| `components/pharmacy/pharmacist-notification-bell.tsx` | Task 9 |
| `components/pharmacy/goods-received-note.tsx` | Task 10 |
| `components/pharmacy/controlled-drugs-register.tsx` | Task 14 |
| `components/pharmacy/pharmacy-preferences-settings.tsx` | Task 15 |
| `app/pharmacist/controlled-drugs/page.tsx` | Task 14 |

### Modified Files (13)
| File | Task |
|------|------|
| `lib/security.ts` | Task 1 |
| `lib/pharmacy-context.tsx` | Task 8 |
| `components/dashboards/pharmacist-dashboard.tsx` | Task 16 |
| `components/pharmacy/purchase-orders.tsx` | Task 11 |
| `components/pharmacy/supplier-management.tsx` | Task 12 |
| `components/pharmacy/prescription-dispense.tsx` | Task 13 |
| `components/pharmacy/prescription-queue.tsx` | Task 17 |
| `components/pharmacy/medication-inventory.tsx` | Task 18 |
| `app/api/pharmacy/medications/route.ts` | Task 18 |
| `components/pharmacy/stock-taking.tsx` | Task 19 |
| `components/pharmacy/usage-analytics.tsx` | Task 19 |
| `components/pharmacy/inventory-valuation.tsx` | Task 19 |
| `components/pharmacy/abc-analysis.tsx` | Task 19 |
| `components/pharmacy/stock-adjustments.tsx` | Task 19 |
| `components/pharmacy/reorder-suggestions.tsx` | Task 19 |
| `app/pharmacist/settings/page.tsx` | Task 15 |
