"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { useAuth } from "@/lib/auth-context"
import { Loader2, ReceiptText, Wallet } from "lucide-react"
import { formatPatientNumber } from "@/lib/patients"

type CompactPatient = { id: string; patient_number: string; first_name: string; last_name: string }
type PaymentMethod = "cash" | "card" | "mobile_money" | "bank"
type FilterMethod = PaymentMethod | "all"
type PaymentRow = {
  id: string
  receipt_no: string
  amount: number
  method: PaymentMethod
  created_at: string
  first_name: string
  last_name: string
  patient_number: string
}

function buildIsoRange(from: string, to: string) {
  return {
    from: new Date(`${from}T00:00:00Z`).toISOString(),
    to: new Date(`${to}T23:59:59Z`).toISOString(),
  }
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export function PaymentsPanel() {
  const { user } = useAuth()
  const role = (user?.role || "").toLowerCase()
  const canRecordPayments = role === "cashier" || role === "hospital admin"
  const [q, setQ] = useState("")
  const [patients, setPatients] = useState<CompactPatient[]>([])
  const [selectedPatientId, setSelectedPatientId] = useState("")
  const [selectedPatient, setSelectedPatient] = useState<CompactPatient | null>(null)
  const [amount, setAmount] = useState("")
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash")
  const [filterMethod, setFilterMethod] = useState<FilterMethod>("all")
  const [reference, setReference] = useState("")
  const [creating, setCreating] = useState(false)
  const [loadingRecent, setLoadingRecent] = useState(false)
  const [exporting, setExporting] = useState<string | null>(null)
  const [recent, setRecent] = useState<PaymentRow[]>([])
  const [from, setFrom] = useState<string>(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10))
  const [to, setTo] = useState<string>(new Date().toISOString().slice(0, 10))
  const [items, setItems] = useState<{ description: string; amount: string }[]>([])
  const [searching, setSearching] = useState(false)
  const [errorMsg, setErrorMsg] = useState("")

  useEffect(() => {
    const h = setTimeout(() => {
      if (!q || q.length < 2) {
        setPatients([])
        return
      }
      void (async () => {
        try {
          setSearching(true)
          const res = await fetch(`/api/patients?q=${encodeURIComponent(q)}&limit=25&compact=1`, { credentials: "include" })
          if (res.ok) setPatients((await res.json()).patients || [])
        } catch {
          setPatients([])
        } finally {
          setSearching(false)
        }
      })()
    }, 250)
    return () => clearTimeout(h)
  }, [q])

  const loadRecent = useCallback(async (pid?: string) => {
    try {
      setLoadingRecent(true)
      const url = new URL("/api/payments", window.location.origin)
      const range = buildIsoRange(from, to)
      if (pid) url.searchParams.set("patientId", pid)
      if (filterMethod !== "all") url.searchParams.set("method", filterMethod)
      url.searchParams.set("from", range.from)
      url.searchParams.set("to", range.to)
      url.searchParams.set("limit", "100")
      const res = await fetch(url.toString(), { credentials: "include" })
      if (res.ok) setRecent((await res.json()).payments || [])
      else setRecent([])
    } catch {
      setRecent([])
    } finally {
      setLoadingRecent(false)
    }
  }, [filterMethod, from, to])

  useEffect(() => {
    void loadRecent(selectedPatientId || undefined)
  }, [loadRecent, selectedPatientId])

  const create = async () => {
    const hasItems = items.length > 0
    const computedAmount = hasItems ? items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0) : Number(amount)
    if (!selectedPatientId || !computedAmount || Number.isNaN(computedAmount)) {
      toast.error("Select a patient and enter a valid amount")
      return
    }

    setCreating(true)
    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: selectedPatientId,
          amount: hasItems ? undefined : computedAmount,
          method: paymentMethod,
          reference: reference || null,
          items: hasItems ? items.map((item) => ({ description: item.description, amount: Number(item.amount || 0) })) : undefined,
        }),
      })
      if (!res.ok) {
        const error = await res.json().catch(() => ({}))
        const message = error.error || "Failed to record payment"
        toast.error(message)
        setErrorMsg(String(message))
        return
      }

      const data = await res.json()
      toast.success("Payment recorded")
      setAmount("")
      setReference("")
      setItems([])
      setErrorMsg("")
      await loadRecent(selectedPatientId)
      try { window.open(`/api/receipts/${data.id}`, "_blank") } catch {}
    } catch {
      toast.error("Failed to record payment")
    } finally {
      setCreating(false)
    }
  }

  const exportPayments = async (format: "csv" | "xlsx" | "pdf") => {
    try {
      setExporting(format)
      const range = buildIsoRange(from, to)
      const response = await fetch("/api/exports/direct", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dataset: "payments",
          format,
          filters: {
            from: range.from,
            to: range.to,
            method: filterMethod === "all" ? undefined : filterMethod,
            patientId: selectedPatientId || undefined,
          },
        }),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || "Export failed")
      }
      const blob = await response.blob()
      downloadBlob(blob, `payments-${from}-${to}.${format}`)
      toast.success(`Downloaded payments-${from}-${to}.${format}`)
    } catch (error: any) {
      toast.error(error?.message || "Export failed")
    } finally {
      setExporting(null)
    }
  }

  const totalAmount = useMemo(
    () => recent.reduce((sum, payment) => sum + Number(payment.amount || 0), 0),
    [recent],
  )
  const latestReceipt = recent[0]?.receipt_no || "No receipts yet"

  return (
    <Card className="border-sky-100 bg-[linear-gradient(180deg,_rgba(248,250,252,0.98),_rgba(255,255,255,1))] shadow-sm">
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Payments</CardTitle>
          <CardDescription>Review receipts, filter payment activity, export registers, and hand off collection to Cashier when needed.</CardDescription>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" disabled={!!exporting} onClick={() => exportPayments("csv")}>CSV</Button>
          <Button variant="outline" size="sm" disabled={!!exporting} onClick={() => exportPayments("xlsx")}>XLSX</Button>
          <Button variant="outline" size="sm" disabled={!!exporting} onClick={() => exportPayments("pdf")}>PDF</Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!canRecordPayments && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Reception can review and export payments here. Recording new payments remains restricted to Cashier and Hospital Admin accounts.
          </div>
        )}

        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-sky-100 bg-sky-50/70 p-4">
            <div className="text-xs font-medium uppercase tracking-[0.18em] text-sky-700">Receipts</div>
            <div className="mt-2 text-2xl font-semibold text-slate-950">{recent.length}</div>
            <div className="mt-1 text-sm text-slate-600">Matching the current filter set.</div>
          </div>
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4">
            <div className="text-xs font-medium uppercase tracking-[0.18em] text-emerald-700">Total Value</div>
            <div className="mt-2 text-2xl font-semibold text-slate-950">{totalAmount.toLocaleString()}</div>
            <div className="mt-1 text-sm text-slate-600">Across the payments loaded into this panel.</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50/90 p-4">
            <div className="text-xs font-medium uppercase tracking-[0.18em] text-slate-700">Latest Receipt</div>
            <div className="mt-2 flex items-center gap-2 text-base font-semibold text-slate-950">
              <ReceiptText className="h-4 w-4 text-sky-600" />
              {latestReceipt}
            </div>
            <div className="mt-1 text-sm text-slate-600">Open any listed receipt directly from the ledger below.</div>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.35fr_0.95fr]">
          <div className="space-y-3 rounded-3xl border border-slate-200 bg-white/90 p-4 shadow-sm">
            <div className="space-y-2">
              <Input
                id="payments-search"
                name="paymentsSearch"
                placeholder="Search patient"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              {selectedPatientId && (
                <div className="text-xs text-muted-foreground">
                  Selected: {selectedPatient ? `${formatPatientNumber(selectedPatient.patient_number)} - ${selectedPatient.first_name} ${selectedPatient.last_name}` : selectedPatientId}
                  <button
                    type="button"
                    className="ml-2 text-blue-600 hover:underline"
                    onClick={() => {
                      setSelectedPatientId("")
                      setSelectedPatient(null)
                    }}
                  >
                    Clear
                  </button>
                </div>
              )}
              {searching && <div className="p-2 text-sm text-muted-foreground">Searching...</div>}
              <div className="max-h-40 overflow-auto rounded border">
                {(patients || []).length === 0 ? (
                  <div className="p-3 text-sm text-muted-foreground">
                    {q.length >= 2 ? "No patients found" : "Search by patient name, number, or phone to narrow the ledger."}
                  </div>
                ) : (
                  patients.map((patient) => (
                    <button
                      key={patient.id}
                      type="button"
                      onClick={() => {
                        setSelectedPatientId(patient.id)
                        setSelectedPatient(patient)
                      }}
                      className={`w-full px-3 py-2 text-left text-sm hover:bg-muted ${selectedPatientId === patient.id ? "bg-muted" : ""}`}
                    >
                      {formatPatientNumber(patient.patient_number)} - {patient.first_name} {patient.last_name}
                    </button>
                  ))
                )}
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-4">
              <div className="space-y-1">
                <label className="text-sm font-medium">From</label>
                <Input id="payments-dateFrom" name="dateFrom" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">To</label>
                <Input id="payments-dateTo" name="dateTo" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Method</label>
                <Select value={filterMethod} onValueChange={(value: FilterMethod) => setFilterMethod(value)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All methods</SelectItem>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="card">Card</SelectItem>
                    <SelectItem value="mobile_money">Mobile Money</SelectItem>
                    <SelectItem value="bank">Bank</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end gap-2">
                <Button variant="outline" className="w-full" onClick={() => loadRecent(selectedPatientId || undefined)} disabled={loadingRecent}>
                  {loadingRecent ? "Filtering..." : "Apply Filters"}
                </Button>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white/90 p-4 shadow-sm">
            {canRecordPayments ? (
              <div className="space-y-3">
                <div>
                  <div className="text-sm font-semibold text-foreground">Record Payment</div>
                  <div className="text-sm text-muted-foreground">Capture co-pays and print the receipt immediately after save.</div>
                </div>
                <div className="grid gap-2">
                  <Input placeholder="Amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))} />
                  <Select value={paymentMethod} onValueChange={(value: PaymentMethod) => setPaymentMethod(value)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="card">Card</SelectItem>
                      <SelectItem value="mobile_money">Mobile Money</SelectItem>
                      <SelectItem value="bank">Bank</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input id="payments-reference" name="reference" placeholder="Reference (optional)" value={reference} onChange={(e) => setReference(e.target.value)} />
                  {errorMsg && <div className="text-xs text-red-600">{errorMsg}</div>}
                  <Button onClick={create} disabled={creating}>
                    {creating ? (
                      <span className="inline-flex items-center"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</span>
                    ) : (
                      "Record Payment"
                    )}
                  </Button>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3">
                  <div className="mb-2 text-sm font-medium">Line Items (optional)</div>
                  <div className="space-y-2">
                    {items.map((item, index) => (
                      <div key={index} className="grid items-center gap-2 md:grid-cols-6">
                        <Input
                          id={`payments-item-desc-${index}`}
                          name={`itemDescription-${index}`}
                          className="md:col-span-4"
                          placeholder="Description"
                          value={item.description}
                          onChange={(e) => {
                            const next = [...items]
                            next[index].description = e.target.value
                            setItems(next)
                          }}
                        />
                        <Input
                          id={`payments-item-amount-${index}`}
                          name={`itemAmount-${index}`}
                          className="md:col-span-1"
                          placeholder="Amount"
                          inputMode="decimal"
                          value={item.amount}
                          onChange={(e) => {
                            const next = [...items]
                            next[index].amount = e.target.value.replace(/[^0-9.]/g, "")
                            setItems(next)
                          }}
                        />
                        <Button variant="outline" onClick={() => {
                          const next = [...items]
                          next.splice(index, 1)
                          setItems(next)
                        }}>
                          Remove
                        </Button>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <Button variant="outline" onClick={() => setItems([...items, { description: "", amount: "" }])}>Add Item</Button>
                    {items.length > 0 && (
                      <div className="text-sm text-muted-foreground">
                        Total: {items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0).toLocaleString()}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Wallet className="h-4 w-4 text-sky-600" />
                  Cashier handoff
                </div>
                <p className="text-sm text-muted-foreground">
                  Use this view to verify receipt activity, confirm the patient and amount, then direct the user to Cashier for collection if a new payment is needed.
                </p>
                <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3 text-sm text-slate-700">
                  Exports and receipt lookups remain available from reception for reconciliation and front-desk follow-up.
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white/95 shadow-sm">
          {loadingRecent ? (
            <div className="p-4 text-sm text-muted-foreground">Loading payments...</div>
          ) : recent.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground">No payments match the current filters.</div>
          ) : (
            <div className="divide-y">
              {recent.map((payment) => (
                <div key={payment.id} className="flex items-center justify-between gap-3 p-4 text-sm">
                  <div>
                    <div className="font-medium">
                      {payment.receipt_no} - {payment.first_name} {payment.last_name} ({formatPatientNumber(payment.patient_number)})
                    </div>
                    <div className="text-muted-foreground">
                      {payment.method} | {new Date(payment.created_at).toLocaleString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="font-semibold">{payment.amount.toLocaleString()}</div>
                    <Button variant="outline" size="sm" onClick={() => { try { window.open(`/api/receipts/${payment.id}`, "_blank") } catch {} }}>
                      Receipt
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
