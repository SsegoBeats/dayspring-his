# Cashier Portal Phase 3 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Polish the cashier portal with animated bill rows, a 2-col payment layout, accordion bill creation, a payment success screen, upgraded export panel, and hero dashboard stats.

**Architecture:** Seven sequential tasks aligned with the spec's implementation order. Each task creates or rewires one unit of UI, committing after verification. Tasks 5 and 6 both touch `process-payment.tsx` but don't conflict — task 5 adds a fixed overlay, task 6 rearranges the underlying layout.

**Tech Stack:** Next.js 15 (App Router), TypeScript, Tailwind CSS v3, shadcn/ui, Lucide React, Recharts — no external animation libraries.

**Spec:** `docs/superpowers/specs/2026-03-19-cashier-phase3-design.md`

---

## File Map

| Status | File | Change |
|--------|------|--------|
| Create | `app/cashier/layout.tsx` | Cashier route layout; imports CSS |
| Create | `app/cashier/cashier-animations.css` | All `@keyframes` definitions |
| Create | `components/billing/bill-row.tsx` | Self-contained bill row |
| Create | `components/billing/payment-success-screen.tsx` | Animated success overlay |
| Create | `components/billing/create-bill-accordion.tsx` | Accordion form body |
| Create | `components/billing/format-preview-card.tsx` | Export format card |
| Modify | `components/billing/bill-queue.tsx` | Delegate rows to `BillRow`; remove `getAgingBand` |
| Modify | `components/billing/process-payment.tsx` | Success screen + 2-col layout |
| Modify | `components/billing/create-bill.tsx` | Delegate body to `CreateBillAccordion` |
| Modify | `components/billing/export-transactions.tsx` | FormatPreviewCard + pill toggle + recent exports |
| Modify | `components/dashboards/cashier-dashboard.tsx` | Icons, shift stats row |

---

## Task 1: CSS Foundation (`app/cashier/layout.tsx` + `cashier-animations.css`)

**Files:**
- Create: `app/cashier/cashier-animations.css`
- Create: `app/cashier/layout.tsx`

- [ ] **Step 1: Create `cashier-animations.css`**

```css
/* app/cashier/cashier-animations.css */
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

- [ ] **Step 2: Create `app/cashier/layout.tsx`**

```tsx
// app/cashier/layout.tsx
import "./cashier-animations.css"

export default function CashierLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors from these two new files.

- [ ] **Step 4: Commit**

```bash
git add app/cashier/cashier-animations.css app/cashier/layout.tsx
git commit -m "feat(cashier): phase 3 step 1 — CSS animations + cashier layout"
```

---

## Task 2: BillRow Component + Wire into BillQueue

**Files:**
- Create: `components/billing/bill-row.tsx`
- Modify: `components/billing/bill-queue.tsx`

### Context
`bill-queue.tsx` currently has `getAgingBand` at line 35 and renders rows inline from line 106. We move `getAgingBand` into `bill-row.tsx` and replace the inline row JSX with `<BillRow>`.

- [ ] **Step 1: Create `components/billing/bill-row.tsx`**

```tsx
"use client"

import { Loader2, ReceiptText, Edit, Trash } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import type { Bill } from "@/lib/billing-context"
import { useFormatCurrency } from "@/lib/settings-context"
import { formatPatientNumber } from "@/lib/patients"

interface BillRowProps {
  bill: Bill
  highlightBillId?: string | null
  showAging?: boolean
  onSelect: (billId: string) => void
  onEdit?: (billId: string) => void
  onDelete?: (billId: string) => void
  onReprint?: (billId: string) => void
  deletingId?: string | null
  reprintLoadingId?: string | null
}

export function getAgingBand(dateStr: string): { label: string; rowClass: string; badgeClass: string } {
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24))
  if (days >= 90) return {
    label: `${days}d overdue`,
    rowClass: "border-purple-200 bg-purple-50/30",
    badgeClass: "border border-purple-200 bg-purple-50 text-purple-700",
  }
  if (days >= 60) return {
    label: `${days}d overdue`,
    rowClass: "border-red-200 bg-red-50/30",
    badgeClass: "border border-red-200 bg-red-50 text-red-700",
  }
  if (days >= 30) return {
    label: `${days}d overdue`,
    rowClass: "border-orange-200 bg-orange-50/30",
    badgeClass: "border border-orange-200 bg-orange-50 text-orange-700",
  }
  return {
    label: `${days}d`,
    rowClass: "border-amber-200 bg-amber-50/20",
    badgeClass: "border border-amber-200 bg-amber-50 text-amber-700",
  }
}

function getAvatarColors(bill: Bill, showAging: boolean): string {
  if (showAging) {
    const aging = getAgingBand(bill.date)
    if (aging.rowClass.includes("purple")) return "bg-purple-100 text-purple-700 ring-purple-200"
    if (aging.rowClass.includes("red"))    return "bg-red-100 text-red-700 ring-red-200"
    if (aging.rowClass.includes("orange")) return "bg-orange-100 text-orange-700 ring-orange-200"
    return "bg-amber-100 text-amber-700 ring-amber-200"
  }
  switch (bill.status) {
    case "paid":           return "bg-emerald-100 text-emerald-700 ring-emerald-200"
    case "partially paid": return "bg-orange-100 text-orange-700 ring-orange-200"
    case "cancelled":      return "bg-slate-100 text-slate-500 ring-slate-200"
    default:               return "bg-amber-100 text-amber-700 ring-amber-200" // pending
  }
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function BillRow({
  bill,
  highlightBillId,
  showAging = false,
  onSelect,
  onEdit,
  onDelete,
  onReprint,
  deletingId,
  reprintLoadingId,
}: BillRowProps) {
  const formatCurrency = useFormatCurrency()   // returns a bare function, NOT an object — do not destructure
  const aging = showAging ? getAgingBand(bill.date) : null
  const isHighlighted = highlightBillId === bill.id

  const rowBase = isHighlighted
    ? "border-sky-300 bg-sky-50/60 shadow-sm shadow-sky-100 ring-2 ring-sky-400 motion-safe:animate-[highlight-pulse_600ms_ease-out]"
    : aging
      ? aging.rowClass
      : "border-border/60 bg-card"

  const balance = bill.total - (bill.paidAmount ?? 0)

  return (
    <div
      className={`flex flex-col gap-3 rounded-xl border p-4 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md sm:flex-row sm:items-center sm:justify-between ${rowBase}`}
    >
      {/* Left zone — avatar */}
      <div className="flex shrink-0 items-center gap-3">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold ring-2 shadow-inner ${getAvatarColors(bill, showAging)}`}
        >
          {getInitials(bill.patientName)}
        </div>

        {/* Middle zone — bill info */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-foreground">{bill.patientName}</p>
            {bill.patientNumber && (
              <span className="font-mono text-xs text-muted-foreground">
                {formatPatientNumber(bill.patientNumber)}
              </span>
            )}
            <Badge
              variant={
                bill.status === "paid"
                  ? "default"
                  : bill.status === "pending"
                    ? "secondary"
                    : bill.status === "partially paid"
                      ? "outline"
                      : "destructive"
              }
            >
              {bill.status === "partially paid" ? "Partially Paid" : bill.status}
            </Badge>
            {aging && (
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${aging.badgeClass}`}>
                {aging.label}
              </span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span className="rounded-full border border-border/60 bg-muted/40 px-2 py-0.5">
              {bill.billNumber || `${bill.id.slice(0, 8)}…`}
            </span>
            <span className="rounded-full border border-border/60 bg-muted/40 px-2 py-0.5">
              {bill.date}
            </span>
            <span className="rounded-full border border-border/60 bg-muted/40 px-2 py-0.5">
              {bill.items.length} item(s)
            </span>
          </div>
          {(bill.paidAmount ?? 0) > 0 && (bill.paidAmount ?? 0) < bill.total && (
            <div className="mt-1 flex flex-wrap gap-3 text-xs">
              <span className="font-medium text-green-600">Paid: {formatCurrency(bill.paidAmount ?? 0)}</span>
              <span className="font-medium text-amber-600">Balance due: {formatCurrency(balance)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Right zone — amount + actions */}
      <div className="flex shrink-0 flex-wrap items-center gap-1.5">
        <span className="mr-2 text-lg font-bold text-foreground">
          {bill.status === "partially paid" ? formatCurrency(balance) : formatCurrency(bill.total)}
        </span>

        {bill.status === "paid" && onReprint && (
          <Button
            variant="outline"
            size="sm"
            disabled={reprintLoadingId === bill.id}
            title="Reprint receipt"
            onClick={() => onReprint(bill.id)}
          >
            {reprintLoadingId === bill.id
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <ReceiptText className="h-4 w-4" />}
          </Button>
        )}

        {bill.status === "pending" && onEdit && (
          <Button variant="outline" size="sm" onClick={() => onEdit(bill.id)} title="Edit bill">
            <Edit className="h-4 w-4" />
          </Button>
        )}

        {bill.status === "pending" && onDelete && (
          <Button
            variant="outline"
            size="sm"
            className="text-destructive hover:bg-destructive/10"
            disabled={deletingId === bill.id}
            onClick={() => onDelete(bill.id)}
            title="Delete bill"
          >
            {deletingId === bill.id
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <Trash className="h-4 w-4" />}
          </Button>
        )}

        <Button
          size="sm"
          className="rounded-full"
          onClick={() => onSelect(bill.id)}
        >
          {bill.status === "paid" ? "View" : "Process"}
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Update `components/billing/bill-queue.tsx` to use `BillRow`**

At the top of `bill-queue.tsx`:
1. Remove the `getAgingBand` function definition (lines 35–57) — it now lives in `bill-row.tsx`
2. Remove `formatCurrency` from the `useFormatCurrency()` destructure (no longer needed directly)
3. Add import: `import { BillRow, getAgingBand } from "./bill-row"`

Replace the `bills.map(...)` block (starting at line 106) with:

```tsx
<div className="space-y-2">
  {bills.map((bill) => (
    <BillRow
      key={bill.id}
      bill={bill}
      highlightBillId={highlightBillId}
      showAging={showAging}
      onSelect={onSelectBill}
      onEdit={onEditBill}
      onReprint={async (billId) => {
        setReprintLoadingId(billId)
        try {
          const res = await fetch(`/api/payments?billId=${encodeURIComponent(billId)}&limit=1`, {
            credentials: "include",
          })
          const data = await res.json().catch(() => ({})) as { payments?: { id: string }[] }
          const paymentId = data.payments?.[0]?.id
          if (paymentId) {
            window.open(`/api/receipts/${paymentId}`, "_blank", "noopener,noreferrer")
          } else {
            toast.error("No receipt found for this bill")
          }
        } catch {
          toast.error("Failed to load receipt")
        } finally {
          setReprintLoadingId(null)
        }
      }}
      onDelete={onDeleteBill ? (billId) => {
        // AlertDialog confirmation still handled by BillQueue below
        // Trigger by setting deletingId — AlertDialog opens via the dialog state
        setDeletingId(billId)
      } : undefined}
      deletingId={deletingId}
      reprintLoadingId={reprintLoadingId}
    />
  ))}
</div>
```

**Note on AlertDialog:** The AlertDialog confirmation for delete stays in `BillQueue`. Keep the existing `<AlertDialog>` and wire it to open when `deletingId` is set. You may need to add a separate `confirmDeleteId` state if you want the AlertDialog to wrap outside the map. The simplest approach: keep AlertDialog inside the row but rendered by BillQueue — pass the AlertDialog as the `onDelete` trigger rather than calling `setDeletingId` directly. Alternatively, keep the existing AlertDialog pattern by wrapping `BillRow` in a fragment with the AlertDialog, but **outside** `BillRow` — BillQueue controls the dialog state.

The recommended pattern:

```tsx
{bills.map((bill) => {
  const canDelete = bill.status === "pending" && (bill.paidAmount ?? 0) <= 0
  return (
    <div key={bill.id} className="relative">
      <BillRow
        bill={bill}
        highlightBillId={highlightBillId}
        showAging={showAging}
        onSelect={onSelectBill}
        onEdit={onEditBill}
        onReprint={/* ... reprint handler ... */}
        onDelete={canDelete && onDeleteBill ? () => setDeletingId(bill.id) : undefined}
        deletingId={deletingId}
        reprintLoadingId={reprintLoadingId}
      />
      {canDelete && onDeleteBill && (
        <AlertDialog open={deletingId === bill.id} onOpenChange={(open) => { if (!open) setDeletingId(null) }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this bill?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently remove the bill. Use this if the patient will not pay (e.g. cancelled visit). This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <Button variant="destructive" onClick={() => { onDeleteBill(bill.id); setDeletingId(null) }}>
                Delete
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  )
})}
```

Also remove `AlertDialogTrigger` from the imports since it's no longer needed (dialog is now controlled via `open`).

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Visual check**

Run `npm run dev`. Open the cashier portal bills list. Confirm:
- Rows render with status-colored avatars
- Paid rows show Receipt button
- Pending rows show Edit/Delete buttons
- Delete shows confirmation dialog
- Hover gives `-translate-y-0.5 shadow-md` lift

- [ ] **Step 5: Commit**

```bash
git add components/billing/bill-row.tsx components/billing/bill-queue.tsx
git commit -m "feat(cashier): phase 3 step 2 — BillRow component with status avatars and animations"
```

---

## Task 3: FormatPreviewCard + Wire into ExportTransactions

**Files:**
- Create: `components/billing/format-preview-card.tsx`
- Modify: `components/billing/export-transactions.tsx`

- [ ] **Step 1: Create `components/billing/format-preview-card.tsx`**

```tsx
"use client"

import { FileText, FileSpreadsheet, File } from "lucide-react"

interface FormatPreviewCardProps {
  format: "csv" | "xlsx" | "pdf"
  selected: boolean
  onSelect: () => void
}

const FORMAT_META = {
  csv:  { Icon: FileText,        label: "CSV",  description: "Raw data, any tool" },
  xlsx: { Icon: FileSpreadsheet, label: "XLSX", description: "Formatted spreadsheet" },
  pdf:  { Icon: File,            label: "PDF",  description: "Branded report" },
} as const

export function FormatPreviewCard({ format, selected, onSelect }: FormatPreviewCardProps) {
  const { Icon, label, description } = FORMAT_META[format]
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex flex-col items-center gap-2 rounded-xl border p-4 text-center transition-all duration-100 active:scale-95 ${
        selected
          ? "bg-emerald-50 border-emerald-300 ring-2 ring-emerald-200"
          : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm"
      }`}
    >
      <Icon className="h-12 w-12 text-muted-foreground" />
      <span className="font-semibold text-foreground">{label}</span>
      <span className="text-xs text-muted-foreground">{description}</span>
    </button>
  )
}
```

- [ ] **Step 2: Update `export-transactions.tsx`**

**2a. Add imports at the top:**
```tsx
import { useAuth } from "@/lib/auth-context"
import { FormatPreviewCard } from "./format-preview-card"
```
Keep the existing `import { useFormatDate } from "@/lib/date-utils"` — do not remove it.

**2b. Add inside the component body (after existing state):**
```tsx
const { user } = useAuth()

// Recent exports
const RECENT_KEY = `cashier_recent_exports_${user?.id ?? "guest"}`
type RecentExport = { dataset: string; format: string; dateRange: string; timestamp: string }
const [recentExports, setRecentExports] = useState<RecentExport[]>(() => {
  if (typeof window === "undefined") return []
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]") } catch { return [] }
})
```

**2c. After the `toast.success(...)` line in `handleExport`, add:**
```tsx
const newEntry: RecentExport = {
  dataset: dataset === "billing" ? "Billing Ledger" : "Payment Ledger",
  format: format.toUpperCase(),
  dateRange: dateRange === "7days" ? "Last 7 days" : dateRange === "30days" ? "Last 30 days" : dateRange === "90days" ? "Last 90 days" : `${startDate} – ${endDate}`,
  timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
}
const updated = [newEntry, ...recentExports].slice(0, 5)
setRecentExports(updated)
localStorage.setItem(RECENT_KEY, JSON.stringify(updated))
```

**2d. In the JSX, replace the dataset `<Select>` block with the pill toggle:**
```tsx
<div className="space-y-2">
  <label className="text-sm font-medium leading-none">Export Data</label>
  <div className="inline-flex rounded-full bg-muted/60 p-1">
    {(["billing", "payments"] as const).map((d) => (
      <button
        key={d}
        type="button"
        onClick={() => setDataset(d)}
        className={
          dataset === d
            ? "rounded-full bg-white px-4 py-1 text-sm font-medium text-foreground shadow-sm"
            : "px-4 py-1 text-sm text-muted-foreground"
        }
      >
        {d === "billing" ? "Billing Ledger" : "Payment Ledger"}
      </button>
    ))}
  </div>
</div>
```

**2e. Replace the format `<Select>` block with `FormatPreviewCard` grid:**
```tsx
<div className="space-y-2">
  <label className="text-sm font-medium leading-none">Export Format</label>
  <div className="grid grid-cols-3 gap-3">
    {(["csv", "xlsx", "pdf"] as const).map((f) => (
      <FormatPreviewCard key={f} format={f} selected={format === f} onSelect={() => setFormat(f)} />
    ))}
  </div>
</div>
```

**2f. After the Export button, add the recent exports section:**
```tsx
<div className="space-y-2">
  <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Recent exports</p>
  {recentExports.length === 0 ? (
    <p className="text-xs text-muted-foreground">No exports yet</p>
  ) : (
    <div className="space-y-1">
      {recentExports.map((e, i) => (
        <div key={i} className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{e.dataset} · {e.format} · {e.dateRange} · Today {e.timestamp}</span>
          <Download className="h-3 w-3 shrink-0 text-muted-foreground/50" />
        </div>
      ))}
    </div>
  )}
</div>
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Visual check**

Navigate to the cashier Export page. Confirm:
- Three format cards render in a grid, selected card gets emerald border + ring
- Dataset is a pill toggle, not a dropdown
- After exporting, the entry appears in "Recent exports" below
- The `useFormatDate` import is still present (no runtime errors on export filename)

- [ ] **Step 5: Commit**

```bash
git add components/billing/format-preview-card.tsx components/billing/export-transactions.tsx
git commit -m "feat(cashier): phase 3 step 3 — FormatPreviewCard, pill dataset toggle, recent exports log"
```

---

## Task 4: CreateBillAccordion + Wire into CreateBill

**Files:**
- Create: `components/billing/create-bill-accordion.tsx`
- Modify: `components/billing/create-bill.tsx`

This is the most complex extraction. Read `create-bill.tsx` in full before writing any code — the accordion takes all form body content from inside `<CardContent>` and wraps it in three collapsible sections.

- [ ] **Step 1: Read `create-bill.tsx` fully before starting**

Read the entire file to understand all state, handlers, and JSX sections before extracting.

- [ ] **Step 2: Create `components/billing/create-bill-accordion.tsx`**

The accordion receives all form state as props (see interface below) and renders three collapsible sections. The `<form>` tag stays in `CreateBill` — the accordion is a pure presentational component that renders form fields.

```tsx
"use client"

import { useState, useEffect } from "react"
import { ChevronDown, CheckCircle2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import type { BillItem } from "@/lib/billing-context"
import type { Patient } from "@/lib/patient-context"   // adjust import path if different

interface CreateBillAccordionProps {
  // Patient section
  patients: Patient[]
  patientId: string
  patientQuery: string
  onPatientQueryChange: (query: string) => void
  onPatientChange: (id: string) => void
  coverage: any | null
  coverageLoading: boolean
  onRefreshCoverage: () => void
  userRole: string
  adminOverride: boolean
  onAdminOverrideChange: (v: boolean) => void
  // Items section
  items: BillItem[]
  onItemsChange: (items: BillItem[]) => void
  onDeliverySubChange: (index: number, deliveryType: string) => void
  // Charges section
  applyTax: boolean
  onApplyTaxChange: (v: boolean) => void
  taxRate: number
  onTaxRateChange: (v: number) => void
  discountAmount: number
  onDiscountChange: (v: number) => void
  // Totals (computed)
  calculateSubtotal: () => number
  calculateTax: () => number
  calculateTotal: () => number
  // Submission
  isSubmitting: boolean
  formatCurrency: (n: number) => string
}

type SectionKey = "patient" | "items" | "charges"

export function CreateBillAccordion(props: CreateBillAccordionProps) {
  const [openSections, setOpenSections] = useState<Set<SectionKey>>(
    new Set<SectionKey>(["patient", "items", "charges"])
  )
  const [totalPop, setTotalPop] = useState(false)
  const prevTotal = props.calculateTotal()

  useEffect(() => {
    setTotalPop(true)
    const t = setTimeout(() => setTotalPop(false), 150)
    return () => clearTimeout(t)
  }, [prevTotal])

  function toggle(key: SectionKey) {
    setOpenSections((prev) => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  return (
    <div className="relative">
      {/* Section 1: Patient */}
      <AccordionSection
        id="patient"
        open={openSections.has("patient")}
        onToggle={() => toggle("patient")}
        label="Patient"
        valid={!!props.patientId}
        summary={props.patientId ? props.patients.find(p => p.id === props.patientId)?.name : undefined}
        validIcon={<CheckCircle2 className="h-4 w-4 text-emerald-500" />}
      >
        {/* Move patient search + select + insurance panel JSX here from create-bill.tsx */}
        {/* This is the content currently inside the "Find Patient" Label + Input + Select block */}
        <p className="text-sm text-muted-foreground">
          [Patient section content moved here from create-bill.tsx]
        </p>
      </AccordionSection>

      {/* Section 2: Bill Items */}
      <AccordionSection
        id="items"
        open={openSections.has("items")}
        onToggle={() => toggle("items")}
        label="Bill Items"
        valid={props.items.length > 0}
        badge={<Badge variant="secondary">{props.items.length}</Badge>}
      >
        {/* Move items JSX here */}
        <p className="text-sm text-muted-foreground">
          [Items section content moved here from create-bill.tsx]
        </p>
      </AccordionSection>

      {/* Section 3: Charges */}
      <AccordionSection
        id="charges"
        open={openSections.has("charges")}
        onToggle={() => toggle("charges")}
        label="Charges"
        valid={true}
        summary={!openSections.has("charges") ? props.formatCurrency(props.calculateTotal()) : undefined}
      >
        {/* Move tax/discount/totals JSX here */}
        <p className="text-sm text-muted-foreground">
          [Charges section content moved here from create-bill.tsx]
        </p>
      </AccordionSection>

      {/* Floating footer */}
      <div className="sticky bottom-0 border-t border-emerald-100 bg-white/95 px-6 py-3 backdrop-blur-sm shadow-[0_-4px_24px_rgba(0,0,0,0.06)]">
        <div className="flex items-center justify-between gap-4">
          <span className="text-sm text-muted-foreground">{props.items.length} item(s)</span>
          <span
            className={`text-xl font-bold text-emerald-700 transition-transform duration-150 ${totalPop ? "scale-110" : "scale-100"}`}
          >
            {props.formatCurrency(props.calculateTotal())}
          </span>
          <button
            type="submit"
            disabled={props.isSubmitting}
            className="rounded-full bg-primary px-6 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
          >
            {props.isSubmitting ? "Creating…" : "Create Bill"}
          </button>
        </div>
      </div>
    </div>
  )
}

interface AccordionSectionProps {
  id: string
  open: boolean
  onToggle: () => void
  label: string
  valid: boolean
  summary?: string
  badge?: React.ReactNode
  validIcon?: React.ReactNode
  children: React.ReactNode
}

function AccordionSection({ open, onToggle, label, valid, summary, badge, validIcon, children }: AccordionSectionProps) {
  return (
    <div className="border-b border-border/40 last:border-0">
      <div
        className="flex cursor-pointer items-center justify-between rounded-xl px-4 py-3 hover:bg-muted/40"
        onClick={onToggle}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" || e.key === " " ? onToggle() : null}
      >
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${valid ? "bg-emerald-500" : "bg-muted"}`} />
          <span className={`text-sm font-medium ${valid ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
            {label}
          </span>
          {badge}
          {validIcon && valid && validIcon}
          {!open && summary && (
            <span className="text-xs text-muted-foreground">— {summary}</span>
          )}
        </div>
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </div>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  )
}
```

**Required additional imports for `create-bill-accordion.tsx`** — the accordion needs these from `create-bill.tsx`:
```tsx
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Loader2, Plus, Trash2, Pill, Stethoscope } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import {
  SERVICE_CATEGORIES,
  SERVICE_CATEGORY_OPTIONS,
  DELIVERY_TYPES,
  DELIVERY_TYPE_OPTIONS,
} from "@/lib/service-categories"
```

**Extraction guide — replace the three `[placeholder]` sections with JSX cut from `create-bill.tsx`:**
- **Patient section:** everything from `<div className="space-y-2"><Label htmlFor="patientSearch">` (line ~295) through the insurance readiness panel closing `</div>`, before the items section
- **Items section:** the `items.map(...)` block including the "Add Item" button at the bottom; add `border-l-4 border-emerald-400` to service item cards and `border-l-4 border-sky-400` to medication item cards (check item `type` field)
- **Charges section:** the tax toggle + rate + discount + breakdown rows

After moving the JSX, delete the corresponding blocks from `create-bill.tsx` — all that remains inside the outer `<div>` in `CreateBill` should be the `<CreateBillAccordion ... />` call and the form wrapper.

- [ ] **Step 3: Update `create-bill.tsx` to use `CreateBillAccordion`**

**3a.** Add import:
```tsx
import { CreateBillAccordion } from "./create-bill-accordion"
```

**3b.** Replace the `<Card>` at line 288 with a plain div (same styles, removes flex context):
```tsx
<div className="rounded-xl border border-border bg-card shadow-sm relative">
  <div className="px-6 pt-6">
    <h3 className="font-semibold text-card-foreground">Create New Bill</h3>
    <p className="mt-1 text-sm text-muted-foreground">Generate a new invoice for a patient</p>
  </div>
  <form onSubmit={handleSubmit} className="mt-4">
    <CreateBillAccordion
      patients={patients}
      patientId={patientId}
      patientQuery={patientQuery}
      onPatientQueryChange={setPatientQuery}
      onPatientChange={setPatientId}
      coverage={coverage}
      coverageLoading={coverageLoading}
      onRefreshCoverage={loadCoverage}
      userRole={userRole}
      adminOverride={adminOverride}
      onAdminOverrideChange={setAdminOverride}
      items={items}
      onItemsChange={setItems}
      onDeliverySubChange={handleDeliverySubChange}
      applyTax={applyTax}
      onApplyTaxChange={setApplyTax}
      taxRate={taxRate}
      onTaxRateChange={setTaxRate}
      discountAmount={discountAmount}
      onDiscountChange={setDiscountAmount}
      calculateSubtotal={calculateSubtotal}
      calculateTax={calculateTax}
      calculateTotal={calculateTotal}
      isSubmitting={isSubmitting}
      formatCurrency={formatCurrency}
    />
  </form>
</div>
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Visual check**

Open Create Bill in the cashier portal. Confirm:
- Three accordion sections visible, all open by default
- Patient section shows CheckCircle2 when patient is selected
- Items section shows live badge count
- Charges section shows total in header when collapsed
- Sticky footer shows item count + total + Create Bill button
- Total amount animates (scale-110 pop) when total changes
- Form submit still works end-to-end

- [ ] **Step 6: Commit**

```bash
git add components/billing/create-bill-accordion.tsx components/billing/create-bill.tsx
git commit -m "feat(cashier): phase 3 step 4 — CreateBillAccordion with sticky footer"
```

---

## Task 5: PaymentSuccessScreen + Wire into ProcessPayment

**Files:**
- Create: `components/billing/payment-success-screen.tsx`
- Modify: `components/billing/process-payment.tsx`

- [ ] **Step 1: Create `components/billing/payment-success-screen.tsx`**

```tsx
"use client"

import { useEffect } from "react"
import { useFormatCurrency } from "@/lib/settings-context"

interface PaymentSuccessScreenProps {
  amount: number
  method: string
  paymentType: "full" | "partial" | "split"
  onComplete: () => void
}

const CONFETTI_COLORS = ["#34d399", "#38bdf8", "#fbbf24", "#fb7185"]

function randomBetween(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

export function PaymentSuccessScreen({ amount, method, paymentType, onComplete }: PaymentSuccessScreenProps) {
  const formatCurrency = useFormatCurrency()   // returns a bare function, NOT an object — do not destructure

  useEffect(() => {
    const t = setTimeout(onComplete, 1800)
    return () => clearTimeout(t)
  }, [onComplete])

  const message =
    paymentType === "full"    ? "Payment received"          :
    paymentType === "partial" ? "Partial payment recorded"  :
                                "Split payment recorded"

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center motion-safe:animate-[fade-in_300ms]"
      style={{ background: "radial-gradient(ellipse at center, #d1fae5 0%, #e0f2fe 100%)" }}
    >
      {/* Skip button */}
      <button
        type="button"
        onClick={onComplete}
        className="absolute right-3 top-3 cursor-pointer text-xs text-black/40 hover:text-black/70"
      >
        Skip →
      </button>

      {/* Confetti (full payment only) */}
      {paymentType === "full" && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {Array.from({ length: 18 }).map((_, i) => (
            <div
              key={i}
              className="absolute motion-safe:animate-[confetti-fly_700ms_200ms_ease-out_forwards]"
              style={{
                width:  `${randomBetween(6, 10)}px`,
                height: `${randomBetween(6, 10)}px`,
                borderRadius: i % 3 === 0 ? "50%" : "2px",
                backgroundColor: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
                left:  `${randomBetween(20, 80)}%`,
                top:   `${randomBetween(20, 60)}%`,
                "--dx": `${randomBetween(-120, 120)}px`,
                "--dy": `${randomBetween(40, 180)}px`,
                "--dr": `${randomBetween(-360, 360)}deg`,
              } as React.CSSProperties}
            />
          ))}
        </div>
      )}

      {/* Circle + checkmark */}
      <div className="relative flex items-center justify-center">
        {/* Partial ring pulse */}
        {paymentType === "partial" && (
          <div className="absolute h-24 w-24 rounded-full motion-safe:animate-[ring-pulse_600ms_200ms_ease-out]" />
        )}
        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-emerald-500 shadow-xl motion-safe:animate-[circle-pop_600ms_ease-out]">
          <svg viewBox="0 0 52 52" className="h-12 w-12" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
            <path
              d="M14 27l9 9 16-18"
              strokeDasharray={100}
              strokeDashoffset={100}
              className="motion-safe:animate-[checkmark-draw_500ms_100ms_ease-out_forwards]"
            />
          </svg>
        </div>
      </div>

      {/* Message */}
      <p className="mt-6 text-lg font-semibold text-emerald-900 opacity-0 motion-safe:animate-[slide-up_300ms_500ms_ease-out_forwards]">
        {message}
      </p>

      {/* Amount */}
      <p className="mt-2 text-3xl font-bold text-emerald-700 opacity-0 motion-safe:animate-[slide-up_300ms_600ms_ease-out_forwards]">
        {formatCurrency(amount)}
      </p>

      {/* Method */}
      <p className="mt-1 text-sm text-emerald-800/70 opacity-0 motion-safe:animate-[slide-up_300ms_650ms_ease-out_forwards]">
        {method}
      </p>
    </div>
  )
}
```

- [ ] **Step 2: Add state and wire into `process-payment.tsx`**

**2a.** Add import at top of `process-payment.tsx`:
```tsx
import { PaymentSuccessScreen } from "./payment-success-screen"
```

**2b.** Add two new state variables after existing state declarations:
```tsx
const [showSuccessScreen, setShowSuccessScreen] = useState(false)
const [pendingReceiptState, setPendingReceiptState] = useState<ReceiptState | null>(null)
```

**2c.** In `handleProcessPayment`, replace the `setReceiptState({...})` call at line ~263 with:
```tsx
setPendingReceiptState({
  receiptNumber: data.payment?.receiptNo || bill.billNumber || bill.id,
  amount: transactionAmount,
  method: formatPaymentMethodLabel(data.payment?.method || paymentMethod),
  items: buildReceiptItems(transactionAmount),
  originalTotal: bill.total,
  remainingBalance: Math.max(0, bill.total - newPaidAmount),
  paymentId: data.payment?.id || null,
})
setShowSuccessScreen(true)
```

**2d.** In `handleSplitPayment`, replace the `setReceiptState({...})` call at line ~390 with:
```tsx
setPendingReceiptState({
  receiptNumber: data2.payment?.receiptNo || bill.billNumber || bill.id,
  amount: bill.total,
  method: `${splitMethod1} + ${splitMethod2}`,
  items: bill.items,           // preserve original items, matching existing handleSplitPayment behaviour
  originalTotal: bill.total,
  remainingBalance: 0,
  paymentId: data2.payment?.id || null,
})
setShowSuccessScreen(true)
```
*(Do NOT modify the Pesapal "Check Payment Status" path — it calls `setReceiptState` directly and intentionally bypasses the success screen.)*

**2e.** Add the success screen render condition. In the main return, BEFORE the `if (receiptState)` check, add:
```tsx
if (showSuccessScreen && pendingReceiptState) {
  return (
    <PaymentSuccessScreen
      amount={pendingReceiptState.amount}
      method={pendingReceiptState.method}
      paymentType={isSplit ? "split" : (paymentType as "full" | "partial")}
      onComplete={() => {
        setReceiptState(pendingReceiptState)
        setShowSuccessScreen(false)
      }}
    />
  )
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Visual check**

Process a test payment (use a pending bill). Confirm:
- After submitting, the green full-screen overlay appears
- Checkmark draws itself (stroke-dashoffset animation)
- For full payment: 18 confetti pieces fly out
- For partial: amber ring pulses around the circle
- Auto-advances to receipt after ~1.8s
- Skip button works immediately

- [ ] **Step 5: Commit**

```bash
git add components/billing/payment-success-screen.tsx components/billing/process-payment.tsx
git commit -m "feat(cashier): phase 3 step 5 — PaymentSuccessScreen animated overlay"
```

---

## Task 6: Process Payment 2-col Layout

**Files:**
- Modify: `components/billing/process-payment.tsx`

This task only changes layout/styling — no logic changes. `process-payment.tsx` was already modified in Task 5; continue in the same file.

> **Note:** All line numbers below (e.g. "~408") are pre-Task-5 numbers. Task 5 adds ~15 lines of state + render guard before the `return`. Add ~15 to all line references if searching by number; searching by code string is safer.

- [ ] **Step 1: Update the outer wrapper**

Find the line (currently ~408):
```tsx
<div className="mx-auto max-w-2xl space-y-4">
```
Replace with:
```tsx
<div className="space-y-4">
```

- [ ] **Step 2: Extract toolbar into sticky bar**

Find the existing `<div className="flex flex-wrap items-center gap-2 print:hidden">` toolbar block (lines ~409–448). Wrap it in the new sticky toolbar:
```tsx
<div className="sticky top-0 z-10 rounded-2xl border bg-white/80 backdrop-blur-sm px-4 py-2 print:hidden">
  <div className="flex flex-wrap items-center gap-2">
    {/* Back, Open Official Invoice, Print Screen Copy, Delete — keep all four exactly as they are */}
  </div>
</div>
```

- [ ] **Step 3: Wrap invoice + payment form in 2-col grid**

After the toolbar, wrap the existing invoice `<Card>` and payment form `<Card>` in:
```tsx
<div className="grid gap-6 xl:grid-cols-[1fr_420px] xl:items-start">
  {/* Left panel — invoice */}
  <div className="xl:sticky xl:top-6 xl:max-h-[calc(100vh-5rem)] xl:overflow-y-auto">
    {/* existing invoice Card — remove overflow-hidden from its className */}
    {/* CardHeader gets: className="bg-gradient-to-b from-emerald-50/60 to-transparent" */}
  </div>

  {/* Right panel — payment form */}
  <div>
    <Card className="border-emerald-100 shadow-sm">
      {/* existing payment fields */}
    </Card>
  </div>
</div>
```

Specifically for the invoice `<Card>`:
- Remove `overflow-hidden` from its `className` (currently: `<Card className="overflow-hidden border-border/80 ...">`)
- Change inner cards for patient info + invoice info to `rounded-2xl`
- Add `odd:bg-muted/20` to line-item table rows

For the payment form `<Card>`:
- Find the "Payment" section label and replace it with:
```tsx
<span className="rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs px-3 py-1">
  Payment
</span>
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Visual check**

Open a bill's payment screen on a large screen (>1280px). Confirm:
- Invoice panel is on the left, sticky as you scroll the right panel
- Payment form is on the right in a 420px column
- Toolbar sticks at the top with all 4 controls visible
- On mobile (< xl), layout is single-column with invoice first

- [ ] **Step 6: Commit**

```bash
git add components/billing/process-payment.tsx
git commit -m "feat(cashier): phase 3 step 6 — Process Payment 2-col layout with sticky invoice panel"
```

---

## Task 7: Hero Dashboard Upgrade

**Files:**
- Modify: `components/dashboards/cashier-dashboard.tsx`

- [ ] **Step 1: Add missing Lucide imports**

Find the existing import line in `cashier-dashboard.tsx` (around line 24–35). Add only `AlertTriangle`:
```tsx
import { ..., AlertTriangle } from "lucide-react"
```
(`HandCoins`, `Plus`, `CircleDollarSign`, `CreditCard` are already there.) Do **not** add `Download` — it is already imported in `export-transactions.tsx` and is not used in `cashier-dashboard.tsx`.

- [ ] **Step 2: Update `CashierPill` to accept an `icon` prop**

Find `CashierPill` at line ~580. Replace with:
```tsx
function CashierPill({
  label,
  value,
  alert = false,
  icon,
}: {
  label: string
  value: string
  alert?: boolean
  icon?: React.ReactNode
}) {
  return (
    <div className={`rounded-full border px-3 py-1 flex items-center gap-1.5 ${
      alert ? "border-amber-200 bg-amber-50 text-amber-900" : "border-white/70 bg-white/82"
    }`}>
      {icon && (
        <span className={alert ? "animate-pulse" : ""}>{icon}</span>
      )}
      <span className="font-medium">{label}:</span> {value}
    </div>
  )
}
```

- [ ] **Step 3: Update all 4 `CashierPill` call sites with icons**

Find the four `<CashierPill>` usages in the JSX. Add appropriate icons. Example:
```tsx
<CashierPill
  label="Awaiting"
  value={String(awaitingCount)}
  alert={awaitingCount > 0}
  icon={<HandCoins className="h-3 w-3" />}
/>
<CashierPill
  label="Overdue"
  value={String(overdueCount)}
  alert={overdueCount > 0}
  icon={<AlertTriangle className="h-3 w-3" />}
/>
<CashierPill
  label="Today"
  value={formatCurrency(todayRevenue)}
  icon={<CircleDollarSign className="h-3 w-3" />}
/>
<CashierPill
  label="This Week"
  value={formatCurrency(weekRevenue)}
  icon={<CreditCard className="h-3 w-3" />}
/>
```
*(Adapt label/value names to match the actual state variables in the file.)*

- [ ] **Step 4: Add shift stats row**

Find the KPI chips `<div>` that wraps the `CashierPill` components. After its closing `</div>`, add:
```tsx
<div className="mt-2 border-t border-emerald-100/60 pt-2 text-xs text-emerald-900/70">
  {(() => {
    const stored = typeof window !== "undefined" ? sessionStorage.getItem("cashier_shift_start") : null
    const shiftStartTime = stored
      ? new Date(stored).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : "—"
    const shiftBillCount = paidBills.filter(
      (b: any) => b.paymentDate === todayLocal
    ).length
    return (
      <span>
        Shift since {shiftStartTime} · {shiftBillCount} bill(s) collected · {formatCurrency(todayRevenue)}
      </span>
    )
  })()}
</div>
```
*(Use the actual variable names from the file for `paidBills`, `todayLocal`, `todayRevenue`, `formatCurrency`.)*

- [ ] **Step 5: Update `QuickActionButton` with icon support and active feedback**

Find `QuickActionButton` at line ~588. Replace with:
```tsx
function QuickActionButton({
  label,
  description,
  onClick,
  icon,
  variant = "default",
}: {
  label: string
  description: string
  onClick: () => void
  icon?: React.ReactNode
  variant?: "default" | "ghost"
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border px-4 py-3 text-left transition active:ring-2 active:ring-emerald-400 active:ring-offset-1 hover:border-emerald-300 hover:bg-white hover:shadow-sm ${
        variant === "ghost"
          ? "border-transparent bg-transparent hover:bg-emerald-50"
          : "border-slate-200 bg-slate-50/80"
      }`}
    >
      <div className="flex items-center gap-2 font-medium text-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-1 text-sm text-muted-foreground">{description}</div>
    </button>
  )
}
```

Update all `QuickActionButton` call sites with relevant icons. The Portal Settings button should use `variant="ghost"`.

- [ ] **Step 6: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Visual check**

Open the cashier dashboard. Confirm:
- KPI chips show icons; overdue/awaiting chips pulse when counts > 0
- Shift stats row appears below KPI chips with today's bill count + total
- Quick Action buttons have icon prefixes and active ring on click

- [ ] **Step 8: Commit**

```bash
git add components/dashboards/cashier-dashboard.tsx
git commit -m "feat(cashier): phase 3 step 7 — hero KPI icons, shift stats row, Quick Action upgrades"
```

---

## Final Verification

- [ ] Run `npx tsc --noEmit` — zero errors across all modified files
- [ ] Run `npm run build` — no build errors
- [ ] Smoke test: create a bill → process payment → receipt appears (full flow)
- [ ] Smoke test: overdue bills list shows aging bands on rows
- [ ] Smoke test: export transactions — format cards + pill toggle + recent exports log persists after refresh

```bash
git log --oneline -7
# should show all 7 phase 3 commits
```
