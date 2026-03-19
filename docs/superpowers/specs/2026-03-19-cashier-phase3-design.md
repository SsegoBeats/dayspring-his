# Cashier Portal — Phase 3 Design Spec
**Date:** 2026-03-19
**Status:** Approved
**Scope:** Visual polish and UX improvements to the cashier portal
**Stack:** Next.js, TypeScript, Tailwind CSS — no external animation libraries

---

## Decisions Made

| Question | Decision |
|----------|----------|
| Animation intensity | B — Expressive & celebratory (confetti on full payment, pulsing highlights, animated transitions) |
| Process Payment layout | A — Sticky left panel (invoice), scrollable right panel (payment form) |
| Create Bill structure | B — Accordion sections (all open by default, independently collapsible) + floating total footer |
| BillQueue avatar color | A — Status-driven (amber/orange/emerald/aging-band colors) |
| Implementation approach | 2 — Extracted sub-components + shared `cashier-animations.css` |

---

## Architecture

### New Files
- `components/billing/bill-row.tsx` — self-contained bill row, replaces inline row JSX in `BillQueue`
- `components/billing/payment-success-screen.tsx` — animated success interstitial before ReceiptPrinter
- `components/billing/create-bill-accordion.tsx` — accordion form body extracted from `CreateBill`
- `components/billing/format-preview-card.tsx` — presentational format card for ExportTransactions
- `app/cashier/cashier-animations.css` — all keyframe definitions, imported once at layout level

### Modified Files
- `components/billing/bill-queue.tsx` — delegates row rendering to `BillRow`
- `components/billing/process-payment.tsx` — 2-col layout, inserts `PaymentSuccessScreen` before receipt
- `components/billing/create-bill.tsx` — delegates form body to `CreateBillAccordion`
- `components/billing/export-transactions.tsx` — format dropdown → `FormatPreviewCard` grid, dataset → pill toggle, adds recent exports log
- `components/dashboards/cashier-dashboard.tsx` — hero KPI chip icons, shift stats row, Quick Action icon prefixes

---

## Section 1 — BillRow (`components/billing/bill-row.tsx`)

**Props:** `bill: Bill`, `highlightBillId?: string | null`, `showAging?: boolean`, `onSelect`, `onEdit?`, `onDelete?`, `onReprint?`

**Layout:** Three horizontal zones inside a `rounded-xl border` card.

### Left zone — Status avatar
- 40×40 circle, patient initials (first initial + last initial)
- Color by status:
  - `pending` → amber (`bg-amber-100 text-amber-700 ring-amber-200`)
  - `partially paid` → orange (`bg-orange-100 text-orange-700 ring-orange-200`)
  - `paid` → emerald (`bg-emerald-100 text-emerald-700 ring-emerald-200`)
  - `cancelled` → slate (`bg-slate-100 text-slate-500 ring-slate-200`)
  - When `showAging=true` → follows aging band color (amber/orange/red/purple)
- `ring-2` at 30% opacity matching fill color, `shadow-inner`

### Middle zone — Bill info
- Row 1: `font-semibold` patient name + `font-mono text-xs text-muted-foreground` patient number
- Row 2: invoice number, date, item count as muted pills
- Row 3 (conditional): green "Paid: X" and amber "Balance due: X" when partially paid
- Aging badge when `showAging=true` (existing logic from Phase 2)

### Right zone — Amount + actions
- Bill total or balance due as `text-lg font-bold`
- Action buttons in `gap-1.5` row: primary action (Process/View) as `rounded-full` pill button; secondary actions (Edit, Delete, Receipt) as compact outline icon buttons

### Highlight animation
- Matching `highlightBillId`: `ring-2 ring-sky-400` + `highlight-pulse` keyframe (600ms sky glow fade)
- Row hover: `hover:-translate-y-0.5 hover:shadow-md transition-all duration-150`

---

## Section 2 — Process Payment 2-col layout (`components/billing/process-payment.tsx`)

### Layout
```
Desktop (xl+):  grid xl:grid-cols-[1fr_420px] xl:items-start gap-6
Mobile/tablet:  single column, invoice first, form below
```

### Left panel — Invoice
- `xl:sticky xl:top-6 xl:max-h-[calc(100vh-5rem)] xl:overflow-y-auto`
- `CardHeader` gradient: `from-emerald-50/60 to-transparent`
- Patient + invoice info cards: `rounded-2xl` (up from `rounded-xl`)
- Line items table: alternating row backgrounds `odd:bg-muted/20`
- Partial-paid banner remains at top of left panel

### Right panel — Payment form
- Wrapped in `Card` with `border-emerald-100 shadow-sm`
- "Payment" section label → small pill: `rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs px-3 py-1`
- All existing payment fields (type, method, split, cash calc, partial amount, notes) stay in this panel

### Toolbar
- Back/Print/Delete buttons move into a slim `rounded-2xl border bg-white/80 backdrop-blur-sm px-4 py-2 sticky top-0` bar above both columns
- `z-10` so it floats cleanly above the two panels

---

## Section 3 — Payment Success Screen (`components/billing/payment-success-screen.tsx`)

**Props:** `amount: number`, `method: string`, `isFullPayment: boolean`, `onComplete: () => void`

**Rendered:** Inserted in `process-payment.tsx` between payment confirmation and `<ReceiptPrinter>`. Replaces the immediate `setReceiptState` → receipt jump.

### Animation sequence

| Time | Event |
|------|-------|
| 0ms | Radial gradient backdrop fades in (emerald-to-sky) |
| 0–600ms | 72px circle: `circle-pop` keyframe (scale 0 → 1.1 → 1) |
| 100–600ms | SVG checkmark: `checkmark-draw` (stroke-dashoffset 100 → 0) |
| 200–900ms | Confetti burst (full payment only): 18 divs, `confetti-fly` keyframe |
| 200–900ms | Partial payment only: soft amber `ring-pulse` instead of confetti |
| 500ms | "Payment received" text: `slide-up` keyframe |
| 600ms | Amount: `slide-up` with 100ms delay |
| 900ms | Receipt card: `slide-up` from below |
| 1800ms | Auto-advance to receipt if no interaction |

### Confetti implementation
- 18 `<div>` elements, 6–10px, positioned absolute over the backdrop
- Colors: emerald-400, sky-400, amber-400, rose-400 (cycling)
- CSS custom properties `--dx`, `--dy`, `--dr` set inline for randomised trajectory
- `confetti-fly`: `translate(0,0) rotate(0) opacity(1)` → `translate(var(--dx),var(--dy)) rotate(var(--dr)) opacity(0)`

### Split payment variant
- No confetti
- Two stacked method pills shown below the amount: `Cash · Bank Transfer`
- Text reads "Split payment recorded"

### Skip button
- `position: absolute top-3 right-3` — "Skip →" in `text-xs text-white/70 hover:text-white`
- Calls `onComplete()` immediately

### Keyframes (in `cashier-animations.css`)
```css
@keyframes checkmark-draw { from { stroke-dashoffset: 100 } to { stroke-dashoffset: 0 } }
@keyframes circle-pop { 0% { transform: scale(0) } 80% { transform: scale(1.1) } 100% { transform: scale(1) } }
@keyframes confetti-fly { to { transform: translate(var(--dx), var(--dy)) rotate(var(--dr)); opacity: 0 } }
@keyframes slide-up { from { transform: translateY(1.5rem); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
@keyframes highlight-pulse { 0%,100% { box-shadow: 0 0 0 0 rgba(56,189,248,0) } 50% { box-shadow: 0 0 0 6px rgba(56,189,248,0.35) } }
```

---

## Section 4 — Create Bill Accordion (`components/billing/create-bill-accordion.tsx`)

**Props:** `patients`, `patientId`, `patientQuery`, `onPatientChange`, `items`, `onItemsChange`, `applyTax`, `taxRate`, `discountAmount`, `onTaxChange`, `onDiscountChange`, `coverage`, `coverageLoading`, `onRefreshCoverage`, `userRole`, `adminOverride`, `onAdminOverrideChange`, `onSubmit`, `isSubmitting`, `formatCurrency`, `onBack`

**Three accordion sections** — all open by default, independently collapsible.

### Section 1 — Patient
- Header: "Patient" label + green checkmark icon when patient selected
- Collapsed summary: patient name + number inline
- Body: search input + Select dropdown + insurance readiness panel
- Insurance readiness: collapsed by default post-selection, "View insurance status" chevron to expand

### Section 2 — Bill Items
- Header: "Bill Items" label + live badge `3 items`
- Item card left-border accents: `border-l-4 border-emerald-400` (service), `border-l-4 border-sky-400` (medication)
- "Add Item" button at bottom of section body
- Remove button per item (existing)

### Section 3 — Charges
- Header: "Charges" label + running total inline when collapsed: `Total: UGX 85,000`
- Body: tax toggle + rate, discount input, subtotal/tax/discount/total breakdown

### Accordion behaviour
- Section header: `flex items-center justify-between cursor-pointer rounded-xl px-4 py-3 hover:bg-muted/40`
- Open/close chevron: `transition-transform duration-200` with `rotate-180` when open
- Section has valid data: header dot turns green (`bg-emerald-500`), label `text-foreground font-semibold`
- Section empty/invalid: dot is `bg-muted`, label `text-muted-foreground`

### Floating footer bar
- `sticky bottom-0 bg-white/95 backdrop-blur-sm border-t border-emerald-100 shadow-[0_-4px_24px_rgba(0,0,0,0.06)]`
- Left: `X item(s)` count in `text-sm text-muted-foreground`
- Centre: running total `text-xl font-bold text-emerald-700` — pops with `scale(1.08) → scale(1)` on change (CSS transition on `transform`)
- Right: "Create Bill" submit button (existing logic, moved here)

---

## Section 5 — Hero upgrade (`components/dashboards/cashier-dashboard.tsx`)

**No new components — refinements only.**

### KPI chip upgrades (CashierPill)
- Add icon prefix to each pill: `HandCoins` (pending), `AlertTriangle` (overdue), `CircleDollarSign` (outstanding), `CreditCard` (today)
- Alert pills (`alert=true`): icon gets `animate-pulse`, pill itself does not pulse
- Non-alert pills: no animation, existing amber/white styling retained

### Shift stats row
- New `<div>` directly below KPI chips row, separated by `border-t border-emerald-100/60 pt-2 mt-2`
- Content: `Shift started {shiftStartTime} · {shiftBillCount} bills · {formatCurrency(shiftTotal)} this shift`
- Styling: `text-xs text-emerald-900/70` — quiet, personal scorecard feel
- Data: reads from the same `paidBills` + `todayLocal` logic already computed in the dashboard (no new context fetch)

### Quick Action button upgrades
- Add icon prefix to each `QuickActionButton`: `HandCoins`, `Plus`, `AlertTriangle`, `Download`
- Active feedback: `active:ring-2 active:ring-emerald-400 active:ring-offset-1`
- Portal Settings: change from `variant="outline"` to `variant="ghost"` with `hover:bg-emerald-50`

---

## Section 6 — Export Panel (`components/billing/export-transactions.tsx` + `components/billing/format-preview-card.tsx`)

### FormatPreviewCard (`components/billing/format-preview-card.tsx`)
**Props:** `format: "csv" | "xlsx" | "pdf"`, `selected: boolean`, `onSelect: () => void`

- Icon: `FileText` (CSV, 48px), `FileSpreadsheet` (XLSX, 48px), `File` (PDF, 48px)
- Label: format name `font-semibold`
- Description: `"Raw data, any tool"` / `"Formatted spreadsheet"` / `"Branded report"` in `text-xs text-muted-foreground`
- Selected: `bg-emerald-50 border-emerald-300 ring-2 ring-emerald-200`
- Unselected: `border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm`
- Click animation: `active:scale-95 transition-transform duration-100`

### Dataset selector
- Replaces `<Select>` with pill toggle: `rounded-full bg-muted/60 p-1`
- Two buttons: "Billing Ledger" / "Payment Ledger"
- Active: `bg-white shadow-sm text-foreground`
- Inactive: `text-muted-foreground`

### Recent exports log
- Stored in `localStorage` key `cashier_recent_exports`
- On successful export: prepend `{ dataset, format, dateRange, timestamp: ISO string }`, keep last 5
- Rendered below Export button as `space-y-2` list
- Each entry: `"Billing Ledger · XLSX · Last 30 days · Today 14:32"` in `text-xs text-muted-foreground`
- Download icon on right (decorative only — files are not re-downloadable)
- Section header: `"Recent exports"` in `text-xs uppercase tracking-widest text-muted-foreground`
- Empty state: `"No exports yet"`

---

## Implementation Order

1. `cashier-animations.css` — all keyframes first, nothing else depends on anything
2. `BillRow` + wire into `BillQueue`
3. `FormatPreviewCard` + wire into `ExportTransactions`
4. `CreateBillAccordion` + wire into `CreateBill`
5. `PaymentSuccessScreen` + wire into `ProcessPayment`
6. Process Payment 2-col layout refactor
7. Hero upgrade (no new files, last because lowest risk)

---

## Constraints

- No external animation libraries (framer-motion, react-spring, etc.)
- All keyframes via CSS `@keyframes` in `cashier-animations.css`
- Tailwind utility classes for everything else (`animate-pulse`, `transition-*`, `duration-*`)
- All new components must be `"use client"`
- `motion-safe:` prefix on all animation classes so they respect `prefers-reduced-motion`
