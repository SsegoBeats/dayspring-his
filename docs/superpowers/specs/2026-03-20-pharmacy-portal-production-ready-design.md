# Pharmacy Portal — Production-Ready Design Spec
**Date:** 2026-03-20
**Author:** Claude (Architect + System Analyst)
**Status:** Approved by user
**Approach:** Option B — Full Production-Ready Build

---

## 1. Overview

This spec covers the full audit, remediation, and production-readiness work for the Dayspring HIS Pharmacy Portal. The portal is approximately 80% complete with solid foundations (RLS, FEFO batch management, drug interaction validation, barcode scanning, analytics) but has critical gaps: supplier/PO persistence, non-atomic prescription dispensing, missing notification bell, no controlled drugs register (NDA-required), and no pharmacy-specific settings.

### Goals
1. Close all broken/missing API wirings
2. Implement LPO-based procurement workflow (Uganda NDA/PSU compliant)
3. Add controlled drugs register (legally mandatory under NDA Uganda)
4. Add pharmacy notification bell (consistent with cashier portal)
5. Add pharmacy-specific settings/preferences
6. Fix prescription dispense atomicity (transaction wrapping)
7. Design polish across all components

### Out of Scope
- NMS/JMS public-sector requisition flow (not relevant for private hospital)
- Non-medication inventory write access for pharmacists (admin-only by hospital policy)
- Supplier management for pharmacists (admin-only)

---

## 2. Research Context

Informed by Uganda NDA regulations, PSU Standards of Practice for Retail Pharmacies, MOH EMHS Manual (2023), and analysis of Ugandan hospital pharmacy software (Sanitas RX, StockCare, UgandaEMR+).

**Key regulatory requirements driving design:**
- All purchases must use formal LPOs signed and stamped by pharmacist (PSU Standards)
- GRNs must capture: generic name, brand name, batch number, expiry date, quantity ordered vs received, unit price (EMHS Manual)
- Controlled drugs register is mandatory under NDA Cap 206 — must record patient, prescriber, quantity, running balance, pharmacist signature
- All procurement documents must be dated, signed, stamped, and filed for NDA inspection
- Pharmacist is primary approver; larger facilities may add finance/management secondary approval

---

## 3. Database Schema

### Migration: `0028_pharmacy_production_ready.sql`

#### `suppliers`
Admin-managed supplier master.
```sql
id uuid PRIMARY KEY,
name text NOT NULL,
contact_person text,
phone text,
email text,
address text,
nda_license_number text,
payment_terms text,         -- e.g. "Net 30"
is_active boolean DEFAULT true,
created_by uuid REFERENCES auth.users(id),
created_at timestamptz DEFAULT now(),
updated_at timestamptz DEFAULT now()
```
RLS: All authenticated roles can SELECT. Only admin can INSERT/UPDATE/DELETE.

#### `purchase_orders`
```sql
id uuid PRIMARY KEY,
po_number text UNIQUE NOT NULL,  -- e.g. LPO-2026-0042, auto-generated
supplier_id uuid REFERENCES suppliers(id),
status text NOT NULL DEFAULT 'draft',
  -- draft | pending_approval | approved | partially_received | received | cancelled
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
```
RLS: Pharmacists can SELECT all, INSERT (own), UPDATE own drafts. Pharmacist-in-charge and admin can UPDATE status to approved. Admin can DELETE drafts only.

#### `purchase_order_items`
```sql
id uuid PRIMARY KEY,
purchase_order_id uuid REFERENCES purchase_orders(id) ON DELETE CASCADE,
medication_id uuid REFERENCES medications(id),
quantity_ordered integer NOT NULL,
quantity_received integer DEFAULT 0,
unit_cost numeric(10,2),
notes text
```
RLS: Inherits from purchase_orders via join.

#### `goods_received_notes`
```sql
id uuid PRIMARY KEY,
grn_number text UNIQUE NOT NULL,  -- e.g. GRN-2026-0018
purchase_order_id uuid REFERENCES purchase_orders(id),  -- nullable (direct receipt)
supplier_id uuid REFERENCES suppliers(id) NOT NULL,
invoice_number text,
received_by uuid REFERENCES auth.users(id) NOT NULL,
received_at timestamptz DEFAULT now(),
notes text,
created_at timestamptz DEFAULT now()
```
RLS: All pharmacy roles can SELECT and INSERT. No UPDATE/DELETE (immutable records).

#### `grn_items`
```sql
id uuid PRIMARY KEY,
grn_id uuid REFERENCES goods_received_notes(id) ON DELETE CASCADE,
medication_id uuid REFERENCES medications(id) NOT NULL,
batch_number text NOT NULL,
expiry_date date NOT NULL,
quantity_ordered integer,
quantity_received integer NOT NULL,
unit_cost numeric(10,2)
```

#### `controlled_drug_register`
```sql
id uuid PRIMARY KEY,
medication_id uuid REFERENCES medications(id) NOT NULL,
patient_id uuid REFERENCES patients(id),
prescription_id uuid REFERENCES prescriptions(id),
prescriber_name text NOT NULL,
prescriber_registration_number text,
quantity_dispensed integer NOT NULL,
batch_number text,
running_balance integer NOT NULL,  -- computed server-side, stored for audit
dispensed_by uuid REFERENCES auth.users(id) NOT NULL,
dispensed_at timestamptz DEFAULT now(),
witness_name text,
entry_type text DEFAULT 'dispense',  -- dispense | receipt | adjustment | opening_balance
notes text
```
RLS: All pharmacy roles can SELECT. INSERT via system only (triggered by dispense endpoint). Export restricted to pharmacist-in-charge and admin.

#### `pharmacy_settings`
```sql
id uuid PRIMARY KEY,
user_id uuid REFERENCES auth.users(id) UNIQUE NOT NULL,
low_stock_threshold_override integer,   -- null = use system default
expiry_warning_days integer DEFAULT 90,
expiry_critical_days integer DEFAULT 30,
default_dispensing_notes text,
preferred_print_format text DEFAULT 'a4',  -- a4 | thermal
print_include_logo boolean DEFAULT true,
enable_controlled_drug_alerts boolean DEFAULT true,
notify_low_stock boolean DEFAULT true,
notify_expiry boolean DEFAULT true,
notify_new_prescriptions boolean DEFAULT true,
notify_po_approved boolean DEFAULT true,
updated_at timestamptz DEFAULT now()
```
RLS: Each user can SELECT and UPDATE own row only.

---

## 4. API Layer

### Suppliers (Admin-Only Writes)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/pharmacy/suppliers` | pharmacist+ | List active suppliers |
| POST | `/api/pharmacy/suppliers` | admin | Create supplier |
| PATCH | `/api/pharmacy/suppliers/[id]` | admin | Update supplier |
| DELETE | `/api/pharmacy/suppliers/[id]` | admin | Soft-delete (set is_active=false) |

### Purchase Orders
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/pharmacy/purchase-orders` | pharmacist+ | List with filters (status, date, supplier) |
| POST | `/api/pharmacy/purchase-orders` | pharmacist+ | Create PO with line items |
| GET | `/api/pharmacy/purchase-orders/[id]` | pharmacist+ | Single PO with items |
| PATCH | `/api/pharmacy/purchase-orders/[id]` | pharmacist+ | Update (edit draft, approve, cancel) |

**PO Number Auto-Generation:** Server generates `LPO-YYYY-NNNN` using current year + zero-padded sequence from DB count.

**Approval Gate:** Status transition to `approved` requires `can(role, "purchase_orders", "approve")` — pharmacist-in-charge or admin only.

### Goods Received Notes
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/pharmacy/grn` | pharmacist+ | List GRNs |
| POST | `/api/pharmacy/grn` | pharmacist+ | Create GRN (transactional) |
| GET | `/api/pharmacy/grn/[id]` | pharmacist+ | Single GRN for print |

**POST `/api/pharmacy/grn` — Transaction Steps (all-or-nothing):**
1. Insert `goods_received_notes` row
2. Insert `grn_items` rows
3. For each item: update `medications.stock_quantity += quantity_received`
4. For each item: insert `medication_batches` row
5. For each item: insert `medication_stock_movements` row (type: `receive`)
6. If `purchase_order_id` provided: update `purchase_order_items.quantity_received`; recalculate PO status (`partially_received` or `received`)
7. If any step fails → full rollback, return `TRANSACTION_FAILED` error

### Prescription Dispensing (Fixed)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/pharmacy/dispense/[prescriptionId]` | pharmacist+ | Atomic dispense |

**Transaction Steps:**
1. Verify prescription is `active` and not already dispensed
2. Verify stock availability (FEFO batch selection)
3. Update prescription status → `dispensed`
4. Deduct stock from selected batch(es): `medications.stock_quantity -= qty`
5. Insert `medication_stock_movements` (type: `dispense`)
6. If medication is a controlled substance: verify running balance, insert `controlled_drug_register` row
7. Insert billing line item (if billing context available)
8. Fire `pharmacy_low_stock` notification if stock drops below threshold
9. If any step fails → full rollback

### Controlled Drugs Register
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/pharmacy/controlled-drugs` | pharmacist+ | Paginated register |
| GET | `/api/pharmacy/controlled-drugs/export` | pharmacist-in-charge, admin | PDF export |

**Running Balance:** Computed server-side using `SUM(CASE WHEN entry_type='receipt' THEN quantity_dispensed ELSE -quantity_dispensed END) OVER (PARTITION BY medication_id ORDER BY dispensed_at)`. Never trusted from client.

**Balance Integrity Check:** On every dispense, server verifies `computed_balance = stored_running_balance`. Mismatch → dispense blocked + admin notification.

### Pharmacy Settings
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/pharmacy/settings` | pharmacist+ | Fetch (creates defaults if not exists) |
| PATCH | `/api/pharmacy/settings` | pharmacist+ | Update own settings |

---

## 5. UI & Component Design

### Dashboard Tab Structure (11 tabs)

| # | Tab Label | Component | Status |
|---|-----------|-----------|--------|
| 1 | Prescriptions | `prescription-queue.tsx` | Existing — add controlled drug badge |
| 2 | Dispense | `prescription-dispense.tsx` | Existing — wire to new dispense endpoint |
| 3 | Medications | `medication-inventory.tsx` | Existing — polish |
| 4 | Stock Taking | `stock-taking.tsx` | Existing — polish |
| 5 | Purchase Orders | `purchase-orders.tsx` | **Rebuilt** — fully persisted |
| 6 | Receiving (GRN) | `goods-received-note.tsx` | **New** |
| 7 | Suppliers | `supplier-management.tsx` | Existing — wire to real API |
| 8 | Analytics | `usage-analytics.tsx` | Existing — polish |
| 9 | Valuation / ABC | `inventory-valuation.tsx` + `abc-analysis.tsx` | Existing — polish |
| 10 | Adjustments | `stock-adjustments.tsx` | Existing — verify wiring |
| 11 | Non-Medication | `non-medication-inventory.tsx` | Existing — view-only for pharmacists |

### New Pages
- `/app/pharmacist/controlled-drugs/page.tsx` — Protected controlled drugs register page. Linked from dashboard header button and sidebar. Access: all pharmacy roles can view; only pharmacist-in-charge/admin can export.

### New Components
- `components/pharmacy/goods-received-note.tsx` — GRN creation form + printable output
- `components/pharmacy/controlled-drugs-register.tsx` — Full-page register table with print/export
- `components/pharmacist/notification-bell.tsx` — Bell icon + dropdown, polls `/api/notifications?role=pharmacist` every 30s
- `components/pharmacist/pharmacy-preferences-settings.tsx` — Settings tab for pharmacy-specific preferences

### Purchase Orders — Rebuilt Component
Multi-step dialog for new LPO:
- **Step 1:** Select supplier (from API), enter expected delivery date, optional notes
- **Step 2:** Add line items — medication search, quantity, unit cost, notes per line
- **Step 3:** Review summary with total value → Submit as Draft or Submit for Approval

LPO list table: po_number, supplier, status badge, item count, total value, expected delivery, actions (View, Receive, Cancel).

Status badge colors: grey=draft, yellow=pending_approval, green=approved, blue=partially_received, teal=received, red=cancelled.

"Receive Stock" button on approved POs pre-populates GRN form with PO line items.

### GRN Component — New
Form fields: PO reference (searchable dropdown or "Direct Receipt"), supplier, invoice number, received date, notes. Line items table: medication name, batch number, expiry date (date picker), qty ordered (pre-filled from PO), qty received (editable), unit cost. Submit triggers transactional API call. On success: show printable GRN summary with GRN number, all items, totals, received-by name and timestamp.

### Controlled Drugs Register Page — New
Full-width table: Date, Patient, Prescriber (name + reg. no.), Medication, Qty Dispensed, Running Balance, Dispensed By, Witness. Toolbar: date range picker, medication filter, search. Export PDF button (pharmacist-in-charge/admin only). Print layout matches NDA inspection template format: facility name, NDA license number, register title, paginated rows, signature line at page bottom.

### Notification Bell — Pharmacy
Identical pattern to cashier bell. Position: top-right of dashboard header. Unread count badge (red). Dropdown shows last 20 notifications. Types with icons:
- 🔴 Low Stock — deep-links to Medications tab, highlights affected item
- 🟡 Expiry Warning — deep-links to Medications tab filtered by expiry
- 🟢 New Prescription — deep-links to Prescriptions tab
- 🔵 PO Approved — deep-links to Purchase Orders tab

### Pharmacy Preferences Settings
New tab "Pharmacy" in `/app/pharmacist/settings/page.tsx`. Sections:
1. **Stock Alerts** — Low stock threshold (%), expiry warning days, expiry critical days
2. **Dispensing Defaults** — Default dispensing notes, FEFO enforcement (always on, toggle display only)
3. **Print Preferences** — Format (A4 / Thermal 80mm), include facility logo, include NDA license number
4. **Notification Preferences** — Per-type toggles: low stock, expiry warnings, new prescriptions, PO approvals

---

## 6. Design Polish

Applied across all pharmacy components:

| Issue | Fix |
|-------|-----|
| Inconsistent card headers | Unified `CardHeader` with title, description, right-aligned actions |
| Hardcoded status colors | Unified badge system: green=active/received, yellow=pending/warning, red=critical/cancelled, blue=draft/info |
| Blank empty states | Proper empty state with icon, message, and CTA for every list/table |
| Spinner-only loading | Skeleton loaders for all data fetches |
| No confirmation on destructive actions | Confirmation dialog with consequence description for: delete medication, cancel PO, stock adjustment down |
| No print support | `@media print` CSS for GRN, PO, and controlled drug register |
| Mobile table overflow | Tables convert to card-list layout below 768px |

---

## 7. Error Handling

**Structured API errors:**
```json
{ "error": "Human-readable message", "code": "MACHINE_READABLE_CODE", "details": {} }
```

**Error codes:**
- `INSUFFICIENT_STOCK` — stock deduction would go negative
- `MEDICATION_NOT_FOUND` — referenced medication does not exist
- `PO_NOT_APPROVABLE` — PO status does not allow approval transition
- `CONTROLLED_DRUG_BALANCE_MISMATCH` — running balance integrity violation (blocks dispense + fires admin alert)
- `TRANSACTION_FAILED` — DB transaction rolled back (generic)
- `PRESCRIPTION_ALREADY_DISPENSED` — duplicate dispense attempt
- `UNAUTHORIZED_APPROVAL` — non-pharmacist-in-charge attempting PO approval

**Frontend error handling:**
- Dispense failure: "Dispensing failed — no changes were made. Please try again or contact support." — form stays open
- GRN failure: form stays open with entered data intact for retry
- PO approval failure: toast with specific message from error code

---

## 8. Permissions Matrix

| Action | Pharmacist | Pharmacist-in-Charge | Admin |
|--------|-----------|---------------------|-------|
| View medications | ✅ | ✅ | ✅ |
| Add/edit medications | ✅ | ✅ | ✅ |
| Delete medications | ❌ | ❌ | ✅ |
| Create/edit PO | ✅ | ✅ | ✅ |
| Approve PO | ❌ | ✅ | ✅ |
| Receive stock (GRN) | ✅ | ✅ | ✅ |
| View controlled drugs register | ✅ | ✅ | ✅ |
| Add to controlled drugs register | ✅ (auto only) | ✅ (auto only) | ✅ |
| Export controlled drugs register | ❌ | ✅ | ✅ |
| Manage suppliers | ❌ | ❌ | ✅ |
| View non-medication inventory | ✅ | ✅ | ✅ |
| Edit non-medication inventory | ❌ | ❌ | ✅ |
| Pharmacy settings | ✅ (own) | ✅ (own) | ✅ |

---

## 9. Notification Types

| Type | Trigger | Deep-link |
|------|---------|-----------|
| `pharmacy_low_stock` | Stock drops below threshold after dispense/adjustment | Medications tab, item highlighted |
| `pharmacy_expiry_warning` | Med enters warning window (per user settings) | Medications tab filtered by expiry |
| `pharmacy_new_prescription` | Doctor creates new prescription | Prescriptions tab |
| `pharmacy_po_approved` | PO status transitions to approved | Purchase Orders tab |

---

## 10. Implementation Phases

### Phase 1 — Database & Core APIs
- Migration `0028_pharmacy_production_ready.sql`
- Supplier API (GET only — admin writes handled separately)
- Purchase Orders API (full CRUD)
- GRN API (transactional receipt)
- Dispense API (atomic transaction — replaces two-call pattern)
- Controlled Drugs Register API
- Pharmacy Settings API

### Phase 2 — UI Rebuild & New Components
- Rebuild `purchase-orders.tsx` with multi-step dialog and real API
- New `goods-received-note.tsx` component
- New `controlled-drugs-register.tsx` component + protected page
- Wire `supplier-management.tsx` to real API
- Wire `prescription-dispense.tsx` to new dispense endpoint
- New `notification-bell.tsx` for pharmacist dashboard
- New `pharmacy-preferences-settings.tsx` settings tab

### Phase 3 — Design Polish & Cross-Cutting
- Unified card headers, status badges, empty states, skeleton loaders
- Confirmation dialogs for all destructive actions
- Print CSS for GRN, PO, and controlled drug register
- Mobile responsive fixes (card-list below 768px)
- Controlled drug badge on prescription queue items
- End-to-end verification of all tabs and flows

---

## 11. Files to Create

| File | Type |
|------|------|
| `migrations/0028_pharmacy_production_ready.sql` | New |
| `app/api/pharmacy/suppliers/route.ts` | New |
| `app/api/pharmacy/suppliers/[id]/route.ts` | New |
| `app/api/pharmacy/purchase-orders/route.ts` | New |
| `app/api/pharmacy/purchase-orders/[id]/route.ts` | New |
| `app/api/pharmacy/grn/route.ts` | New |
| `app/api/pharmacy/grn/[id]/route.ts` | New |
| `app/api/pharmacy/dispense/[prescriptionId]/route.ts` | New |
| `app/api/pharmacy/controlled-drugs/route.ts` | New |
| `app/api/pharmacy/controlled-drugs/export/route.ts` | New |
| `app/api/pharmacy/settings/route.ts` | New |
| `app/pharmacist/controlled-drugs/page.tsx` | New |
| `components/pharmacy/goods-received-note.tsx` | New |
| `components/pharmacy/controlled-drugs-register.tsx` | New |
| `components/pharmacist/notification-bell.tsx` | New |
| `components/pharmacist/pharmacy-preferences-settings.tsx` | New |

## 12. Files to Modify

| File | Change |
|------|--------|
| `migrations/` (tracking table) | Register migration 0028 |
| `app/pharmacist/settings/page.tsx` | Add Pharmacy Preferences tab |
| `components/pharmacy/purchase-orders.tsx` | Full rebuild with real API |
| `components/pharmacy/supplier-management.tsx` | Wire to real API |
| `components/pharmacy/prescription-dispense.tsx` | Wire to new atomic dispense endpoint |
| `components/pharmacy/prescription-queue.tsx` | Add controlled drug badge |
| `components/dashboards/pharmacist-dashboard.tsx` | Add GRN tab, notification bell, controlled drugs link |
| `lib/pharmacy-context.tsx` | Add supplier fetching, PO persistence, GRN support |
| `components/pharmacy/medication-inventory.tsx` | Polish pass |
| `components/pharmacy/stock-taking.tsx` | Polish pass |
| `components/pharmacy/usage-analytics.tsx` | Polish pass |
| `components/pharmacy/inventory-valuation.tsx` | Polish pass |
| `components/pharmacy/abc-analysis.tsx` | Polish pass |
| `components/pharmacy/stock-adjustments.tsx` | Verify wiring + polish |
