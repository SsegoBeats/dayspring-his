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
- `app/cashier/cashier-animations.css` — all keyframe definitions
- `app/cashier/layout.tsx` — new cashier layout file; imports `cashier-animations.css` and wraps children

### Modified Files
- `components/billing/bill-queue.tsx` — delegates row rendering to `BillRow`
- `components/billing/process-payment.tsx` — 2-col layout, removes `max-w-2xl`, inserts `PaymentSuccessScreen` before receipt
- `components/billing/create-bill.tsx` — delegates form body to `CreateBillAccordion`; outer `<form>` tag stays in `CreateBill`
- `components/billing/export-transactions.tsx` — format dropdown → `FormatPreviewCard` grid, dataset → pill toggle, adds recent exports log
- `components/dashboards/cashier-dashboard.tsx` — hero KPI chip icons, shift stats row, Quick Action icon prefixes; adds `AlertTriangle` and `Download` to Lucide imports

---

## Section 1 — BillRow (`components/billing/bill-row.tsx`)

### TypeScript interface
```ts
interface BillRowProps {
  bill: Bill
  highlightBillId?: string | null
  showAging?: boolean
  onSelect: (billId: string) => void
  onEdit?: (billId: string) => void
  onDelete?: (billId: string) => void    // parent (BillQueue) owns deletingId state and confirmation dialog
  onReprint?: (billId: string) => void  // parent (BillQueue) owns reprintLoadingId state and fetch logic
  deletingId?: string | null            // row with this id shows delete button in loading state
  reprintLoadingId?: string | null      // row with this id shows reprint button in loading state
}
```

`BillRow` calls `useFormatCurrency()` internally. It does **not** receive `formatCurrency` as a prop.

The AlertDialog confirmation for delete and the receipt reprint fetch logic both stay in `BillQueue`. `BillRow` calls the `onDelete` / `onReprint` callbacks provided; `BillQueue` passes them as inline handlers (as it does today).

**Layout:** Three horizontal zones inside a `rounded-xl border` card.

### Left zone — Status avatar
- 40×40 circle, patient initials (first initial + last initial)
- Color by status:
  - `pending` → amber (`bg-amber-100 text-amber-700 ring-amber-200`)
  - `partially paid` → orange (`bg-orange-100 text-orange-700 ring-orange-200`)
  - `paid` → emerald (`bg-emerald-100 text-emerald-700 ring-emerald-200`)
  - `cancelled` → slate (`bg-slate-100 text-slate-500 ring-slate-200`)
  - When `showAging=true` → follows aging band color (amber/orange/red/purple) using `getAgingBand()` already defined in `bill-queue.tsx` (move this helper into `bill-row.tsx`)
- `ring-2` at 30% opacity matching fill color, `shadow-inner`

### Middle zone — Bill info
- Row 1: `font-semibold` patient name + `font-mono text-xs text-muted-foreground` patient number
- Row 2: invoice number, date, item count as muted pills
- Row 3 (conditional): green "Paid: X" and amber "Balance due: X" when partially paid
- Aging badge when `showAging=true` (uses `getAgingBand()` from same file)

### Right zone — Amount + actions
- Bill total or balance due as `text-lg font-bold`
- Action buttons in `gap-1.5` row:
  - Receipt (paid only): outline icon button, calls `onReprint` if provided — loading state driven by `reprintLoadingId === bill.id`
  - Edit (pending only): outline icon button
  - Delete (pending only): outline icon button with destructive styling; the AlertDialog confirmation wrapper stays in `BillQueue`, not `BillRow`
  - Process/View: `rounded-full` pill primary button

### Highlight animation
- Matching `highlightBillId`: `ring-2 ring-sky-400` + `animate-[highlight-pulse_600ms_ease-out]`
- Row hover: `hover:-translate-y-0.5 hover:shadow-md transition-all duration-150`
- Animation class applied as `motion-safe:animate-[highlight-pulse_600ms_ease-out]`

---

## Section 2 — Process Payment 2-col layout (`components/billing/process-payment.tsx`)

### Key change: remove `max-w-2xl` and `overflow-hidden`
The existing outer `<div className="mx-auto max-w-2xl space-y-4">` wrapper is replaced with `<div className="space-y-4">`. The `max-w-2xl` constraint is incompatible with a two-column layout requiring 1fr + 420px.

Additionally, `process-payment.tsx` has a `<Card className="overflow-hidden border-border/80 ...">` wrapper. The `overflow-hidden` is applied explicitly via `className` (not by the base `Card` component). **This `overflow-hidden` must be removed** when applying the 2-col layout — it will block the `xl:sticky` positioning of the left invoice panel. Remove it from the `className` string at that call site.

### Layout
```
Desktop (xl+):  grid xl:grid-cols-[1fr_420px] xl:items-start gap-6
Mobile/tablet:  single column, invoice first, form below (no regression)
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
- Back/Print/Delete buttons move into a slim `rounded-2xl border bg-white/80 backdrop-blur-sm px-4 py-2 sticky top-0 z-10` bar above both columns

---

## Section 3 — Payment Success Screen (`components/billing/payment-success-screen.tsx`)

### TypeScript interface
```ts
interface PaymentSuccessScreenProps {
  amount: number
  method: string           // e.g. "Cash", "Mobile Money", "Cash + Bank" for split
  paymentType: "full" | "partial" | "split"
  onComplete: () => void
}
```

`isFullPayment` is replaced by `paymentType: "full" | "partial" | "split"`. Confetti fires only for `paymentType === "full"`.

**Caller mapping note:** `process-payment.tsx` already has `const [paymentType, setPaymentType] = useState<"full" | "partial" | "cancel">("full")` — the `"cancel"` variant never reaches `PaymentSuccessScreen` (cancel paths do not trigger the success screen). Use this explicit mapping when passing the prop:
```tsx
paymentType={isSplit ? "split" : (paymentType as "full" | "partial")}
```
The cast is safe because `"cancel"` is excluded by the guard in `handleProcessPayment`.

### State management in `process-payment.tsx`
A new `showSuccessScreen` state is added:
```ts
const [showSuccessScreen, setShowSuccessScreen] = useState(false)
const [pendingReceiptState, setPendingReceiptState] = useState<ReceiptState | null>(null)
```

Flow:
1. `handleProcessPayment` / `handleSplitPayment` success path calls `setPendingReceiptState({...})` and `setShowSuccessScreen(true)` instead of `setReceiptState({...})`
2. `if (showSuccessScreen && pendingReceiptState)` renders `<PaymentSuccessScreen>` with `onComplete={() => { setReceiptState(pendingReceiptState); setShowSuccessScreen(false) }}`
3. After `onComplete`, `if (receiptState)` renders `<ReceiptPrinter>` as before

`PaymentSuccessScreen` is a **full-viewport fixed overlay** (`fixed inset-0 z-50`) — independent of the 2-col grid, so steps 5 and 6 in the implementation order do not conflict.

### Animation sequence

| Time | Event |
|------|-------|
| 0ms | `fixed inset-0` backdrop: radial gradient emerald→sky, `animate-[fade-in_300ms]` |
| 0–600ms | 72px circle: `motion-safe:animate-[circle-pop_600ms_ease-out]` |
| 100–600ms | SVG checkmark: `stroke-dashoffset` animation via `motion-safe:animate-[checkmark-draw_500ms_100ms_ease-out_forwards]`. **The `<path>` element must have `strokeDasharray={100}` set** — `stroke-dashoffset` has no visible effect without it. Match the value to the keyframe range (`0 → 100`). |
| 200–900ms | `paymentType === "full"`: 18 confetti divs, `motion-safe:animate-[confetti-fly_700ms_200ms_ease-out_forwards]` |
| 200–900ms | `paymentType === "partial"`: amber `motion-safe:animate-[ring-pulse_600ms_200ms_ease-out]` ring around circle |
| 500ms | "Payment received" / "Partial payment recorded" / "Split payment recorded": `motion-safe:animate-[slide-up_300ms_500ms_ease-out_forwards] opacity-0` |
| 600ms | Amount: `motion-safe:animate-[slide-up_300ms_600ms_ease-out_forwards] opacity-0` |
| 1800ms | `setTimeout(onComplete, 1800)` in `useEffect` — auto-advances to receipt |

### Confetti implementation
- 18 `<div>` elements, 6–10px, `position: absolute`
- Colors: emerald-400, sky-400, amber-400, rose-400 (cycling by index)
- CSS custom properties `--dx`, `--dy`, `--dr` set inline per element for randomised trajectory
- `confetti-fly`: from `transform: translate(0,0) rotate(0deg); opacity: 1` to `transform: translate(var(--dx), var(--dy)) rotate(var(--dr)); opacity: 0`

### Skip button
- `position: absolute top-3 right-3` — "Skip →" in `text-xs text-white/70 hover:text-white cursor-pointer`
- Calls `onComplete()` immediately

### Keyframes (in `cashier-animations.css`)
```css
@media (prefers-reduced-motion: no-preference) {
  @keyframes checkmark-draw  { from { stroke-dashoffset: 100 } to { stroke-dashoffset: 0 } }
  @keyframes circle-pop      { 0% { transform: scale(0) } 80% { transform: scale(1.1) } 100% { transform: scale(1) } }
  @keyframes confetti-fly    { from { transform: translate(0,0) rotate(0deg); opacity: 1 } to { transform: translate(var(--dx), var(--dy)) rotate(var(--dr)); opacity: 0 } }
  @keyframes slide-up        { from { transform: translateY(1.5rem); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
  @keyframes ring-pulse      { 0%,100% { box-shadow: 0 0 0 0 rgba(251,191,36,0) } 50% { box-shadow: 0 0 0 8px rgba(251,191,36,0.4) } }
  @keyframes highlight-pulse { 0%,100% { box-shadow: 0 0 0 0 rgba(56,189,248,0) } 50% { box-shadow: 0 0 0 6px rgba(56,189,248,0.35) } }
  @keyframes fade-in         { from { opacity: 0 } to { opacity: 1 } }
}
```

All `motion-safe:` Tailwind prefixes on animation classes ensure zero animation when `prefers-reduced-motion: reduce` is set. For `cashier-animations.css`, wrapping all `@keyframes` inside `@media (prefers-reduced-motion: no-preference)` achieves the same effect at the CSS layer.

---

## Section 4 — Create Bill Accordion (`components/billing/create-bill-accordion.tsx`)

### TypeScript interface
```ts
import type { BillItem } from "@/lib/billing-context"
import type { Patient } from "@/lib/patient-context"   // or wherever Patient type lives

interface CreateBillAccordionProps {
  // Patient section
  patients: Patient[]
  patientId: string
  patientQuery: string
  onPatientQueryChange: (query: string) => void
  onPatientChange: (id: string) => void
  coverage: any | null                    // same `any` type as current create-bill.tsx
  coverageLoading: boolean
  onRefreshCoverage: () => void
  userRole: string
  adminOverride: boolean
  onAdminOverrideChange: (v: boolean) => void
  // Items section
  items: BillItem[]
  onItemsChange: (items: BillItem[]) => void
  onDeliverySubChange: (index: number, deliveryType: string) => void  // targeted description mutation for delivery sub-type; kept separate from onItemsChange to avoid routing through the general handleItemChange field dispatch
  // Charges section
  applyTax: boolean
  onApplyTaxChange: (v: boolean) => void
  taxRate: number
  onTaxRateChange: (v: number) => void
  discountAmount: number
  onDiscountChange: (v: number) => void
  // Totals (computed, for display)
  calculateSubtotal: () => number
  calculateTax: () => number
  calculateTotal: () => number
  // Submission (footer)
  isSubmitting: boolean
  // Note: NO onSubmit prop. The footer button uses type="submit" and relies on the outer
  // <form onSubmit={handleSubmit}> in CreateBill. No synthetic dispatch needed.
  formatCurrency: (n: number) => string
}
```

### Form boundary
The `<form onSubmit={handleSubmit}>` tag **stays in `CreateBill`**, wrapping the entire `<CreateBillAccordion>` component. The floating footer's "Create Bill" button uses `type="submit"` and fires the outer form's `handleSubmit` because the button is a descendant of the outer `<form>`. No `onSubmit` prop exists on `CreateBillAccordion` — the native form submission mechanism is used exclusively.

### Sticky footer — overflow fix
The `Card` component in this project does **not** apply `overflow-hidden` in its base classes (base classes are `bg-card text-card-foreground flex flex-col gap-6 rounded-xl border py-6 shadow-sm`). The real problem is the `flex flex-col gap-6` flex formatting context that `Card` creates on its direct children. A `sticky` child inside a flex container will not stick unless the flex container's ancestor is the scroll root — which is not guaranteed inside nested layout components.

To enable `sticky bottom-0` on the footer:
- Replace the outer `<Card>` wrapper with a plain `<div className="rounded-xl border border-border bg-card shadow-sm relative">` — same visual appearance, removes the flex formatting context
- The accordion body is `<div className="relative">` and the footer is `sticky bottom-0` within it
- On mobile this becomes `position: sticky` relative to the page scroll, which is correct

### Three accordion sections — all open by default

**Section 1 — Patient**
- Header: "Patient" + green `CheckCircle2` icon (from lucide) when `patientId` is set
- Collapsed summary: patient name inline
- Body: patient search input + select dropdown + insurance readiness panel
- Insurance readiness panel: collapsed after patient selected; "View insurance status" chevron to expand

**Section 2 — Bill Items**
- Header: "Bill Items" + live badge showing item count
- Item card left-border: `border-l-4 border-emerald-400` (service), `border-l-4 border-sky-400` (medication)
- "Add Item" button at bottom of body
- Existing item remove button retained

**Section 3 — Charges**
- Header: "Charges" + running total inline when collapsed
- Body: tax toggle + rate, discount, breakdown rows

### Accordion behaviour
- Each section header: `flex items-center justify-between cursor-pointer rounded-xl px-4 py-3 hover:bg-muted/40`
- Chevron: `transition-transform duration-200 rotate-180` when open (via `data-open` attribute + CSS)
- Section valid: header status dot `bg-emerald-500`, label `text-foreground font-semibold`
- Section invalid/empty: dot `bg-muted`, label `text-muted-foreground`
- Open/close: controlled by local `openSections: Set<"patient"|"items"|"charges">` state in `CreateBillAccordion`. Initialise with all three sections open: `useState<Set<"patient" | "items" | "charges">>(new Set(["patient", "items", "charges"]))` — the explicit generic is required to avoid `Set<string>` inference.

### Floating footer bar
- `sticky bottom-0 bg-white/95 backdrop-blur-sm border-t border-emerald-100 shadow-[0_-4px_24px_rgba(0,0,0,0.06)] px-6 py-3`
- Left: `{items.length} item(s)` in `text-sm text-muted-foreground`
- Centre: `{formatCurrency(calculateTotal())}` in `text-xl font-bold text-emerald-700`; total value change triggers a CSS `transition-transform` pop via a keyed `<span>` — when total changes, add class `scale-110` then remove after 150ms via `useEffect`
- Right: `<button type="submit">Create Bill</button>` — submits the outer `<form>` in `CreateBill`

---

## Section 5 — Hero upgrade (`components/dashboards/cashier-dashboard.tsx`)

### New Lucide imports required
Add `AlertTriangle` and `Download` to the existing import block. `HandCoins`, `Plus`, `CircleDollarSign`, `CreditCard` are already imported.

### KPI chip upgrades (CashierPill)
- Add `icon: ReactNode` prop to `CashierPill` — `ReactNode` is already imported in `cashier-dashboard.tsx` at line 4; no new import needed
- Add `alertIcon?: boolean` prop — when true, icon gets `animate-pulse`
- Render icon before label text
- Update all 4 call sites with appropriate icons

### Shift stats row
- New inline `<div>` below KPI chips row, separated by `border-t border-emerald-100/60 pt-2 mt-2`
- Content computed from existing dashboard-level variables:
  - `shiftBillCount = paidBills.filter(b => b.paymentDate === todayLocal).length`
  - `shiftTotal = todayRevenue` (already computed)
  - `shiftStartTime`: read from `sessionStorage.getItem("cashier_shift_start")` — the same key set by `ShiftSummary`. Parse with `new Date(stored).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })`. Falls back to `"—"` if not set.
- Styling: `text-xs text-emerald-900/70`

### Quick Action button upgrades
- `QuickActionButton` gains optional `icon?: ReactNode` prop
- Active feedback: `active:ring-2 active:ring-emerald-400 active:ring-offset-1`
- Portal Settings: `variant="ghost"` with `hover:bg-emerald-50`

---

## Section 6 — Export Panel

### `components/billing/format-preview-card.tsx`
```ts
interface FormatPreviewCardProps {
  format: "csv" | "xlsx" | "pdf"
  selected: boolean
  onSelect: () => void
}
```

- Icon: `FileText` (CSV, `h-12 w-12`), `FileSpreadsheet` (XLSX, `h-12 w-12`), `File` (PDF, `h-12 w-12`)
- Label: format name `font-semibold`
- Description: `"Raw data, any tool"` / `"Formatted spreadsheet"` / `"Branded report"` in `text-xs text-muted-foreground`
- Selected: `bg-emerald-50 border-emerald-300 ring-2 ring-emerald-200`
- Unselected: `border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm`
- Click: `active:scale-95 transition-transform duration-100`
- Three cards in `grid grid-cols-3 gap-3`

### Dataset selector in `ExportTransactions`
- Replaces `<Select>` with pill toggle: `inline-flex rounded-full bg-muted/60 p-1`
- Two `<button>` elements: "Billing Ledger" / "Payment Ledger"
- Active: `bg-white shadow-sm rounded-full text-foreground px-4 py-1 text-sm`
- Inactive: `text-muted-foreground px-4 py-1 text-sm`

### Recent exports log
- `localStorage` key scoped by userId: `cashier_recent_exports_{userId}` — read from `useAuth()` inside the component. Add `import { useAuth } from "@/lib/auth-context"` and `const { user } = useAuth()` at the top of `ExportTransactions`. Use `user?.id ?? "guest"` as the key suffix. No prop change to `ExportTransactionsProps` is needed.
- Type: `Array<{ dataset: string; format: string; dateRange: string; timestamp: string }>`, max 5 entries
- On successful export: `JSON.parse` existing, prepend new entry, `JSON.stringify` back
- Rendered below Export button, section header `"Recent exports"` in `text-xs uppercase tracking-widest`
- Each row: `"Billing Ledger · XLSX · Last 30 days · Today 14:32"` in `text-xs text-muted-foreground`
- Download icon on right (decorative)
- Empty state: `"No exports yet"`

---

## Implementation Order

1. `app/cashier/layout.tsx` + `app/cashier/cashier-animations.css` — layout file first so CSS is available globally in the cashier route; all keyframes defined here
2. `BillRow` + wire into `BillQueue` (move `getAgingBand` helper into `bill-row.tsx`)
3. `FormatPreviewCard` + wire into `ExportTransactions`
4. `CreateBillAccordion` + wire into `CreateBill`
5. `PaymentSuccessScreen` + wire into `ProcessPayment` (full-viewport overlay, independent of layout)
6. Process Payment 2-col layout refactor (remove `max-w-2xl`, add grid, sticky left panel)
7. Hero upgrade (lowest risk, no new files)

Steps 5 and 6 both touch `process-payment.tsx` but do not conflict: step 5 adds the success overlay (which is `fixed inset-0`) and step 6 changes the invoice/form layout below it.

---

## Constraints

- No external animation libraries (framer-motion, react-spring, etc.)
- All `@keyframes` in `cashier-animations.css`, wrapped in `@media (prefers-reduced-motion: no-preference)`
- Tailwind `motion-safe:animate-[...]` for all inline animation class applications
- All new components must be `"use client"`
- `max-w-2xl` removed from `process-payment.tsx` outer wrapper
- `Card` wrapper in `CreateBill` replaced with a plain `div` (same visual, no `overflow-hidden`) to enable `sticky` footer
