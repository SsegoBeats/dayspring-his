"use client"

import Link from "next/link"
import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { useBilling } from "@/lib/billing-context"
import { BillQueue } from "@/components/billing/bill-queue"
import { CashierAuditLookup } from "@/components/billing/cashier-audit-lookup"
import { ProcessPayment } from "@/components/billing/process-payment"
import { CreateBill } from "@/components/billing/create-bill"
import { EditBill } from "@/components/billing/edit-bill"
import { FinancialReports } from "@/components/analytics/financial-reports"
import { OverdueBills } from "@/components/billing/overdue-bills"
import { ExportTransactions } from "@/components/billing/export-transactions"
import { buildSearchParamsString } from "@/lib/search-params"
import { useFormatCurrency, useSettings } from "@/lib/settings-context"
import { ErrorBoundary } from "@/components/error-boundary"
import {
  ArrowUpRight,
  BellRing,
  CircleDollarSign,
  Clock3,
  CreditCard,
  HandCoins,
  Plus,
  Receipt,
  Search,
  Settings,
} from "lucide-react"

const CASHIER_SECTIONS = ["overview", "queue", "create", "reports", "overdue", "exports"] as const
type CashierSection = (typeof CASHIER_SECTIONS)[number]

const CASHIER_QUEUE_TABS = ["pending", "partially", "paid", "all"] as const
type CashierQueueTab = (typeof CASHIER_QUEUE_TABS)[number]

function isCashierSection(value: string | null | undefined): value is CashierSection {
  return Boolean(value && CASHIER_SECTIONS.includes(value as CashierSection))
}

function isCashierQueueTab(value: string | null | undefined): value is CashierQueueTab {
  return Boolean(value && CASHIER_QUEUE_TABS.includes(value as CashierQueueTab))
}

export function CashierDashboard() {
  const { bills, getPendingBills, getPartiallyPaidBills, getOverdueBills, refreshBills } = useBilling()
  const { settings, loading: settingsLoading } = useSettings()
  const formatCurrency = useFormatCurrency()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const sectionParam = searchParams.get("section")
  const queueTabParam = searchParams.get("queueTab")
  const searchParam = searchParams.get("q") || ""
  const detailModeParam = searchParams.get("mode")
  const detailBillId = searchParams.get("bill")
  const [activeSection, setActiveSection] = useState<CashierSection>("overview")
  const [activeQueueTab, setActiveQueueTab] = useState<CashierQueueTab>("pending")
  const [searchTerm, setSearchTerm] = useState(searchParam)
  const [focusBillId, setFocusBillId] = useState<string | null>(detailBillId)
  const [refreshing, setRefreshing] = useState(false)

  const pendingBills = getPendingBills()
  const partiallyPaidBills = getPartiallyPaidBills()
  const overdueBills = getOverdueBills()
  const paidBills = useMemo(() => bills.filter((bill) => bill.status === "paid"), [bills])
  const totalOutstanding = useMemo(
    () =>
      bills.reduce((sum, bill) => {
        if (bill.status === "paid" || bill.status === "cancelled") return sum
        return sum + Math.max(0, bill.total - (bill.paidAmount || 0))
      }, 0),
    [bills],
  )

  const todayLocal =
    typeof Intl !== "undefined"
      ? new Date().toLocaleDateString("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" })
      : `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}-${String(new Date().getDate()).padStart(2, "0")}`

  const todayRevenue = useMemo(
    () =>
      paidBills
        .filter((bill) => bill.paymentDate === todayLocal)
        .reduce((sum, bill) => sum + Math.max(0, bill.paidAmount || bill.total), 0),
    [paidBills, todayLocal],
  )

  const weekBounds = useMemo(() => {
    const now = new Date()
    const day = now.getDay()
    const daysToMonday = day === 0 ? 6 : day - 1
    const monday = new Date(now)
    monday.setDate(now.getDate() - daysToMonday)
    monday.setHours(0, 0, 0, 0)
    const sunday = new Date(monday)
    sunday.setDate(monday.getDate() + 6)
    const opts: Intl.DateTimeFormatOptions = { year: "numeric", month: "2-digit", day: "2-digit" }
    return {
      start: monday.toLocaleDateString("en-CA", opts),
      end: sunday.toLocaleDateString("en-CA", opts),
    }
  }, [])

  const weekRevenue = useMemo(
    () =>
      paidBills
        .filter((bill) => bill.paymentDate && bill.paymentDate >= weekBounds.start && bill.paymentDate <= weekBounds.end)
        .reduce((sum, bill) => sum + Math.max(0, bill.paidAmount || bill.total), 0),
    [paidBills, weekBounds.end, weekBounds.start],
  )

  const recentAttentionBills = useMemo(
    () => [...pendingBills, ...partiallyPaidBills].slice(0, 5),
    [partiallyPaidBills, pendingBills],
  )

  const recentCompletedBills = useMemo(() => paidBills.slice(0, 5), [paidBills])

  const detailMode = detailModeParam === "edit" ? "edit" : detailModeParam === "process" ? "process" : null

  const replaceParams = useCallback(
    (updates: Record<string, string | null | undefined>) => {
      const query = buildSearchParamsString(searchParams, updates)
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
    },
    [pathname, router, searchParams],
  )

  const syncSection = useCallback(
    (nextSection: CashierSection, extraUpdates?: Record<string, string | null | undefined>) => {
      setActiveSection(nextSection)
      replaceParams({
        section: nextSection === "overview" ? null : nextSection,
        bill: null,
        mode: null,
        ...(nextSection === "queue" ? {} : { queueTab: null, q: null }),
        ...extraUpdates,
      })
    },
    [replaceParams],
  )

  const syncQueueTab = useCallback(
    (nextTab: CashierQueueTab) => {
      setActiveQueueTab(nextTab)
      replaceParams({
        section: "queue",
        queueTab: nextTab === "pending" ? null : nextTab,
      })
    },
    [replaceParams],
  )

  const syncSearch = useCallback(
    (value: string) => {
      setSearchTerm(value)
      replaceParams({
        section: "queue",
        q: value.trim() ? value : null,
      })
    },
    [replaceParams],
  )

  const openBill = useCallback(
    (billId: string, mode: "process" | "edit" = "process", sectionOverride: CashierSection = "queue") => {
      setFocusBillId(billId)
      replaceParams({
        section: sectionOverride === "overview" ? null : sectionOverride,
        bill: billId,
        mode,
        queueTab: sectionOverride === "queue" && activeQueueTab !== "pending" ? activeQueueTab : sectionOverride === "queue" ? null : undefined,
        q: sectionOverride === "queue" && searchTerm.trim() ? searchTerm : sectionOverride === "queue" ? null : undefined,
      })
    },
    [activeQueueTab, replaceParams, searchTerm],
  )

  const closeDetail = useCallback(() => {
    replaceParams({
      bill: null,
      mode: null,
      section: activeSection === "overview" ? null : activeSection,
    })
  }, [activeSection, replaceParams])

  const refreshPortal = useCallback(async () => {
    setRefreshing(true)
    try {
      await refreshBills()
    } finally {
      setRefreshing(false)
    }
  }, [refreshBills])

  const filterBills = useCallback(
    (list: typeof bills) =>
      list.filter((bill) => {
        const query = searchTerm.trim().toLowerCase()
        if (!query) return true
        return (
          bill.patientName.toLowerCase().includes(query) ||
          bill.id.toLowerCase().includes(query) ||
          (bill.billNumber || "").toLowerCase().includes(query) ||
          (bill.patientNumber || "").toLowerCase().includes(query)
        )
      }),
    [searchTerm],
  )

  useEffect(() => {
    if (isCashierSection(sectionParam)) {
      setActiveSection(sectionParam)
      return
    }
    if (settingsLoading) return

    const mappedPreference: CashierSection =
      settings?.defaultDashboard === "cashier-queue"
        ? "queue"
        : settings?.defaultDashboard === "cashier-create"
          ? "create"
          : settings?.defaultDashboard === "cashier-reports"
            ? "reports"
            : settings?.defaultDashboard === "cashier-overdue"
              ? "overdue"
              : settings?.defaultDashboard === "cashier-exports"
                ? "exports"
                : "overview"

    setActiveSection(mappedPreference)
  }, [sectionParam, settings?.defaultDashboard, settingsLoading])

  useEffect(() => {
    setActiveQueueTab(isCashierQueueTab(queueTabParam) ? queueTabParam : "pending")
  }, [queueTabParam])

  useEffect(() => {
    setSearchTerm(searchParam)
  }, [searchParam])

  useEffect(() => {
    setFocusBillId(detailBillId)
  }, [detailBillId])

  useEffect(() => {
    const handler = async (event: Event) => {
      const detail = (event as CustomEvent).detail || {}
      if (detail.notificationId) {
        try {
          await fetch("/api/notifications", {
            method: "PATCH",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ids: [detail.notificationId] }),
          })
        } catch {}
      }

      if (detail.billId) {
        openBill(String(detail.billId), detail.mode === "edit" ? "edit" : "process", isCashierSection(detail.initialSection) ? detail.initialSection : "queue")
        return
      }

      syncSection(isCashierSection(detail.initialSection) ? detail.initialSection : "queue")
    }

    window.addEventListener("openCashierDesk", handler as EventListener)
    return () => window.removeEventListener("openCashierDesk", handler as EventListener)
  }, [openBill, syncSection])

  if (detailMode === "edit" && detailBillId) {
    return <EditBill billId={detailBillId} onBack={closeDetail} />
  }

  if (detailMode === "process" && detailBillId) {
    return <ProcessPayment billId={detailBillId} onBack={closeDetail} />
  }

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[2rem] border border-emerald-100 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.2),_transparent_36%),linear-gradient(135deg,_rgba(236,253,245,1),_rgba(255,255,255,0.98)_45%,_rgba(239,246,255,0.94))] p-6 shadow-[0_30px_80px_-44px_rgba(5,150,105,0.45)]">
        <div className="grid gap-6 xl:grid-cols-[1.45fr_0.95fr]">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white/85 px-3 py-1 text-xs font-medium uppercase tracking-[0.22em] text-emerald-900">
              <BellRing className="h-3.5 w-3.5" />
              Cash Control Center
            </div>
            <div>
              <h2 className="text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                Collect cleanly, keep invoices moving, and keep finance data aligned with the rest of the hospital.
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                Cashier now runs from one deep-linkable workflow for collections, manual bills, arrears, exports, receipts, and financial reporting.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-slate-700">
              <CashierPill label="Pending bills" value={String(pendingBills.length)} alert={pendingBills.length > 10} />
              <CashierPill label="Overdue" value={String(overdueBills.length)} alert={overdueBills.length > 0} />
              <CashierPill label="Outstanding" value={formatCurrency(totalOutstanding)} alert={totalOutstanding > 0} />
              <CashierPill label="Today collected" value={formatCurrency(todayRevenue)} />
            </div>
          </div>
          <div className="rounded-[1.5rem] border border-white/70 bg-white/88 p-5 shadow-sm">
            <div className="mb-3 text-sm font-semibold text-foreground">Quick Actions</div>
            <div className="grid gap-3">
              <QuickActionButton
                label="Open collections queue"
                description="Review pending and partially paid invoices in the payment lane."
                onClick={() => syncSection("queue")}
              />
              <QuickActionButton
                label="Create a new bill"
                description="Generate a manual invoice for services or medication right from cashier."
                onClick={() => syncSection("create")}
              />
              <QuickActionButton
                label="Review overdue balances"
                description="Jump straight into invoices that have aged past the normal collection window."
                onClick={() => syncSection("overdue")}
              />
              <QuickActionButton
                label="Open exports"
                description="Download the invoice ledger or the payment ledger in CSV, XLSX, or PDF."
                onClick={() => syncSection("exports")}
              />
              <Button asChild variant="outline">
                <Link href="/cashier/settings">
                  <Settings className="mr-2 h-4 w-4" />
                  Portal settings
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Collections Queue"
          value={pendingBills.length + partiallyPaidBills.length}
          hint={`${pendingBills.length} pending and ${partiallyPaidBills.length} partially paid invoices.`}
          icon={<HandCoins className="h-4 w-4 text-emerald-600" />}
          onClick={() => syncSection("queue")}
        />
        <MetricCard
          label="Outstanding Balance"
          value={formatCurrency(totalOutstanding)}
          hint="Open arrears and part-pay balances waiting to be settled."
          icon={<CircleDollarSign className="h-4 w-4 text-amber-600" />}
          onClick={() => syncSection("overdue")}
        />
        <MetricCard
          label="Today Collected"
          value={formatCurrency(todayRevenue)}
          hint="Collections captured on the cashier calendar day."
          icon={<CreditCard className="h-4 w-4 text-sky-600" />}
          onClick={() => syncSection("reports")}
        />
        <MetricCard
          label="This Week"
          value={formatCurrency(weekRevenue)}
          hint="Monday to Sunday collections for the current week."
          icon={<Receipt className="h-4 w-4 text-rose-600" />}
          onClick={() => syncSection("reports")}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.9fr]">
        <Card className="border-emerald-100 bg-white/95 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">Attention Queue</CardTitle>
              <CardDescription>Unpaid and partially settled invoices that need the cashier next.</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={refreshPortal} disabled={refreshing}>
              {refreshing ? <Clock3 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowUpRight className="mr-2 h-4 w-4" />}
              Refresh
            </Button>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            <AttentionListCard
              title="Ready for collection"
              description="Pending invoices that can be opened directly into payment processing."
              bills={recentAttentionBills}
              emptyMessage="No invoices are waiting in the queue."
              formatCurrency={formatCurrency}
              onOpen={(billId) => openBill(billId, "process", "queue")}
            />
            <AttentionListCard
              title="Recently completed"
              description="The latest paid invoices already reflected in the cashier ledger."
              bills={recentCompletedBills}
              emptyMessage="No completed collections yet."
              formatCurrency={formatCurrency}
              onOpen={(billId) => openBill(billId, "process", "queue")}
            />
          </CardContent>
        </Card>

        <CashierAuditLookup onOpenBill={(billId) => openBill(billId, "process", "queue")} />
      </div>

      <Alert className="border-amber-200 bg-amber-50/80 text-amber-950">
        <AlertTitle>Cashier improvement shipped</AlertTitle>
        <AlertDescription>
          Payment capture now writes real payment records behind every cashier settlement, so receipts, exports, and financial analytics no longer drift away from invoice status.
        </AlertDescription>
      </Alert>

      <ErrorBoundary
        fallbackTitle="Cashier portal error"
        fallbackDescription="Something went wrong in the cashier portal. Try again or refresh the page."
      >
        <Tabs value={activeSection} onValueChange={(next) => syncSection(next as CashierSection)}>
          <TabsList className="grid w-full grid-cols-2 gap-2 rounded-2xl bg-emerald-50 p-2 md:grid-cols-3 xl:grid-cols-6">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="queue">Queue</TabsTrigger>
            <TabsTrigger value="create">Create Bill</TabsTrigger>
            <TabsTrigger value="reports">Reports</TabsTrigger>
            <TabsTrigger value="overdue">Overdue</TabsTrigger>
            <TabsTrigger value="exports">Exports</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <Card className="border-emerald-100 bg-white/95 shadow-sm">
              <CardHeader>
                <CardTitle>Cashier Home</CardTitle>
                <CardDescription>Move straight into collection, billing, arrears review, finance reporting, or exports from here.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <ActionCard title="Queue" description="Open pending and partially paid invoices." onClick={() => syncSection("queue")} />
                <ActionCard title="Create" description="Generate a fresh manual invoice." onClick={() => syncSection("create")} />
                <ActionCard title="Overdue" description="Review aged balances and unpaid follow-up." onClick={() => syncSection("overdue")} />
                <ActionCard title="Exports" description="Download branded invoice and payment ledgers." onClick={() => syncSection("exports")} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="queue" className="space-y-4">
            <Card className="border-emerald-100 bg-white/95 shadow-sm">
              <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <CardTitle>Collections Queue</CardTitle>
                  <CardDescription>Search by patient or invoice, then jump directly into processing or editing.</CardDescription>
                </div>
                <div className="flex w-full flex-col gap-3 sm:flex-row lg:w-auto">
                  <div className="relative min-w-[240px]">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search patient or invoice..."
                      value={searchTerm}
                      onChange={(event) => syncSearch(event.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <Button onClick={() => syncSection("create")}>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Bill
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <Tabs value={activeQueueTab} onValueChange={(next) => syncQueueTab(next as CashierQueueTab)}>
                  <TabsList className="h-auto flex-wrap gap-1 bg-muted/60 p-1">
                    <TabsTrigger value="pending" className="gap-1.5 text-sm">
                      Pending
                      <Badge variant="secondary" className="ml-0.5 px-1.5 py-0 text-xs">{pendingBills.length}</Badge>
                    </TabsTrigger>
                    <TabsTrigger value="partially" className="gap-1.5 text-sm">
                      Partially Paid
                      <Badge variant="outline" className="ml-0.5 px-1.5 py-0 text-xs">{partiallyPaidBills.length}</Badge>
                    </TabsTrigger>
                    <TabsTrigger value="paid" className="gap-1.5 text-sm">
                      Paid
                      <Badge variant="outline" className="ml-0.5 px-1.5 py-0 text-xs">{paidBills.length}</Badge>
                    </TabsTrigger>
                    <TabsTrigger value="all" className="gap-1.5 text-sm">
                      All
                      <Badge variant="outline" className="ml-0.5 px-1.5 py-0 text-xs">{bills.length}</Badge>
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="pending" className="mt-4">
                    <BillQueue
                      bills={filterBills(pendingBills)}
                      onSelectBill={(billId) => openBill(billId, "process", "queue")}
                      onEditBill={(billId) => openBill(billId, "edit", "queue")}
                      onDeleteBill={async (billId) => {
                        await refreshBills()
                        if (focusBillId === billId) setFocusBillId(null)
                      }}
                      onCreateBill={() => syncSection("create")}
                      emptyMessage='No pending bills. Use "Create Bill" to start a new invoice.'
                      showCreateButton
                      highlightBillId={focusBillId}
                    />
                  </TabsContent>
                  <TabsContent value="partially" className="mt-4">
                    <BillQueue
                      bills={filterBills(partiallyPaidBills)}
                      onSelectBill={(billId) => openBill(billId, "process", "queue")}
                      emptyMessage="No partially paid bills."
                      highlightBillId={focusBillId}
                    />
                  </TabsContent>
                  <TabsContent value="paid" className="mt-4">
                    <BillQueue
                      bills={filterBills(paidBills)}
                      onSelectBill={(billId) => openBill(billId, "process", "queue")}
                      emptyMessage="No paid bills in this view."
                      highlightBillId={focusBillId}
                    />
                  </TabsContent>
                  <TabsContent value="all" className="mt-4">
                    <BillQueue
                      bills={filterBills(bills)}
                      onSelectBill={(billId) => openBill(billId, "process", "queue")}
                      onEditBill={(billId) => {
                        const bill = bills.find((entry) => entry.id === billId)
                        if (bill?.status === "pending") {
                          openBill(billId, "edit", "queue")
                        }
                      }}
                      onDeleteBill={async (billId) => {
                        await refreshBills()
                        if (focusBillId === billId) setFocusBillId(null)
                      }}
                      emptyMessage="No bills recorded yet."
                      highlightBillId={focusBillId}
                    />
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="create">
            <CreateBill onBack={() => syncSection("queue")} />
          </TabsContent>

          <TabsContent value="reports">
            <FinancialReports />
          </TabsContent>

          <TabsContent value="overdue">
            <OverdueBills
              onBack={() => syncSection("overview")}
              onSelectBill={(billId) => openBill(billId, "process", "overdue")}
              onEditBill={(billId) => openBill(billId, "edit", "overdue")}
            />
          </TabsContent>

          <TabsContent value="exports">
            <ExportTransactions onBack={() => syncSection("overview")} />
          </TabsContent>
        </Tabs>
      </ErrorBoundary>
    </div>
  )
}

function CashierPill({ label, value, alert = false }: { label: string; value: string; alert?: boolean }) {
  return (
    <div className={`rounded-full border px-3 py-1 ${alert ? "border-amber-200 bg-amber-50 text-amber-900" : "border-white/70 bg-white/82"}`}>
      <span className="font-medium">{label}:</span> {value}
    </div>
  )
}

function QuickActionButton({
  label,
  description,
  onClick,
}: {
  label: string
  description: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-left transition hover:border-emerald-300 hover:bg-white hover:shadow-sm"
    >
      <div className="font-medium text-foreground">{label}</div>
      <div className="mt-1 text-sm text-muted-foreground">{description}</div>
    </button>
  )
}

function MetricCard({
  label,
  value,
  hint,
  icon,
  onClick,
}: {
  label: string
  value: string | number
  hint: string
  icon: ReactNode
  onClick: () => void
}) {
  return (
    <button type="button" onClick={onClick} className="text-left">
      <Card className="h-full border-emerald-100 bg-white/95 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">{label}</div>
            {icon}
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-semibold tracking-tight text-foreground">{value}</div>
          <p className="mt-2 text-sm text-muted-foreground">{hint}</p>
        </CardContent>
      </Card>
    </button>
  )
}

function AttentionListCard({
  title,
  description,
  bills,
  emptyMessage,
  formatCurrency,
  onOpen,
}: {
  title: string
  description: string
  bills: Array<{
    id: string
    patientName: string
    billNumber?: string
    total: number
    paidAmount?: number
    status: string
  }>
  emptyMessage: string
  formatCurrency: (amountUGX: number) => string
  onOpen: (billId: string) => void
}) {
  return (
    <div className="space-y-3 rounded-3xl border border-slate-200 bg-slate-50/70 p-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-foreground">{title}</div>
          <div className="text-sm text-muted-foreground">{description}</div>
        </div>
      </div>
      {bills.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white/80 px-4 py-5 text-sm text-muted-foreground">
          {emptyMessage}
        </div>
      ) : (
        <div className="space-y-2">
          {bills.map((bill) => {
            const balance = Math.max(0, bill.total - (bill.paidAmount || 0))
            return (
              <button
                key={bill.id}
                type="button"
                onClick={() => onOpen(bill.id)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left transition hover:border-emerald-300 hover:shadow-sm"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-medium text-foreground">{bill.patientName}</div>
                    <div className="text-sm text-muted-foreground">
                      {bill.billNumber || bill.id.slice(0, 8)} | {bill.status === "partially paid" ? "Partially paid" : bill.status}
                    </div>
                  </div>
                  <div className="text-right text-sm">
                    <div className="font-semibold text-foreground">{formatCurrency(balance > 0 ? balance : bill.total)}</div>
                    <div className="text-muted-foreground">{balance > 0 ? "Balance due" : "Collected"}</div>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function ActionCard({
  title,
  description,
  onClick,
}: {
  title: string
  description: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-3xl border border-slate-200 bg-slate-50/70 p-4 text-left transition hover:border-emerald-300 hover:bg-white hover:shadow-sm"
    >
      <div className="flex items-center justify-between">
        <div className="text-base font-semibold text-foreground">{title}</div>
        <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
      </div>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
    </button>
  )
}
