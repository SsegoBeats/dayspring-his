"use client"

import { startTransition, useDeferredValue, useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useFormatCurrency } from "@/lib/settings-context"
import { ArrowUpRight, FileText, Loader2, ReceiptText, Search } from "lucide-react"

type BillMatch = {
  id: string
  bill_number?: string | null
  patient_number?: string | null
  first_name?: string | null
  last_name?: string | null
  total_amount?: number | string
  final_amount?: number | string
  paid_amount?: number | string
  status?: string | null
  created_at?: string
}

type PaymentMatch = {
  id: string
  receipt_no: string
  bill_id?: string | null
  bill_number?: string | null
  amount: number | string
  method: string
  reference?: string | null
  created_at: string
  first_name?: string | null
  last_name?: string | null
  patient_number?: string | null
}

interface CashierAuditLookupProps {
  onOpenBill: (billId: string) => void
}

const MIN_QUERY_LENGTH = 2

export function CashierAuditLookup({ onOpenBill }: CashierAuditLookupProps) {
  const formatCurrency = useFormatCurrency()
  const [query, setQuery] = useState("")
  const deferredQuery = useDeferredValue(query)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [billMatches, setBillMatches] = useState<BillMatch[]>([])
  const [paymentMatches, setPaymentMatches] = useState<PaymentMatch[]>([])

  useEffect(() => {
    const search = deferredQuery.trim()
    if (!search) {
      setLoading(false)
      setError(null)
      setBillMatches([])
      setPaymentMatches([])
      return
    }

    if (search.length < MIN_QUERY_LENGTH) {
      setLoading(false)
      setError(null)
      setBillMatches([])
      setPaymentMatches([])
      return
    }

    const controller = new AbortController()
    const timeout = window.setTimeout(async () => {
      setLoading(true)
      setError(null)
      try {
        const [billRes, paymentRes] = await Promise.all([
          fetch(`/api/billing?search=${encodeURIComponent(search)}&limit=6`, {
            credentials: "include",
            signal: controller.signal,
          }),
          fetch(`/api/payments?search=${encodeURIComponent(search)}&limit=6`, {
            credentials: "include",
            signal: controller.signal,
          }),
        ])

        const [billData, paymentData] = await Promise.all([
          billRes.json().catch(() => ({})),
          paymentRes.json().catch(() => ({})),
        ])

        if (!billRes.ok || !paymentRes.ok) {
          throw new Error(
            (billData as { error?: string }).error ||
              (paymentData as { error?: string }).error ||
              "Search failed",
          )
        }

        startTransition(() => {
          setBillMatches(Array.isArray((billData as { bills?: BillMatch[] }).bills) ? (billData as { bills: BillMatch[] }).bills : [])
          setPaymentMatches(
            Array.isArray((paymentData as { payments?: PaymentMatch[] }).payments)
              ? (paymentData as { payments: PaymentMatch[] }).payments
              : [],
          )
          setError(null)
        })
      } catch (searchError) {
        if (controller.signal.aborted) return
        startTransition(() => {
          setBillMatches([])
          setPaymentMatches([])
          setError(searchError instanceof Error ? searchError.message : "Search failed")
        })
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }, 250)

    return () => {
      controller.abort()
      window.clearTimeout(timeout)
    }
  }, [deferredQuery])

  const hasMatches = billMatches.length > 0 || paymentMatches.length > 0

  return (
    <Card className="border-sky-100 bg-[linear-gradient(180deg,_rgba(239,246,255,0.95),_rgba(255,255,255,0.98))] shadow-sm">
      <CardHeader>
        <CardTitle className="text-base">Cashier Audit Lookup</CardTitle>
        <CardDescription>Search by invoice number, receipt number, payment reference, patient name, or patient number.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="audit-lookup-search"
            name="auditSearch"
            autoComplete="off"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search invoice, receipt, or payment reference..."
            className="pl-9"
          />
        </div>

        {query.trim().length > 0 && query.trim().length < MIN_QUERY_LENGTH && (
          <p className="text-sm text-muted-foreground">Type at least {MIN_QUERY_LENGTH} characters to search the cashier ledger.</p>
        )}

        {loading && (
          <div className="flex items-center gap-2 rounded-2xl border border-dashed border-slate-200 bg-white/85 px-4 py-5 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Searching invoices and receipts...
          </div>
        )}

        {error && !loading && (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {!loading && !error && query.trim().length >= MIN_QUERY_LENGTH && !hasMatches && (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white/85 px-4 py-5 text-sm text-muted-foreground">
            No invoice or payment matches were found for this search.
          </div>
        )}

        {!loading && hasMatches && (
          <div className="grid gap-4 xl:grid-cols-2">
            <div className="space-y-3 rounded-3xl border border-slate-200 bg-white/85 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-foreground">Invoice Matches</div>
                  <div className="text-sm text-muted-foreground">Open the invoice, process payment, or review balance due.</div>
                </div>
                <Badge variant="secondary">{billMatches.length}</Badge>
              </div>
              {billMatches.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-5 text-sm text-muted-foreground">
                  No invoice matches for this query.
                </div>
              ) : (
                <div className="space-y-3">
                  {billMatches.map((bill) => {
                    const patientName = `${bill.first_name || ""} ${bill.last_name || ""}`.trim() || "Unknown patient"
                    const total = Number(bill.final_amount || bill.total_amount || 0)
                    const paid = Number(bill.paid_amount || 0)
                    const balance = Math.max(0, total - paid)
                    return (
                      <div key={bill.id} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <div className="font-medium text-foreground">{bill.bill_number || bill.id.slice(0, 8)}</div>
                            <div className="text-sm text-muted-foreground">
                              {patientName}
                              {bill.patient_number ? ` | ${bill.patient_number}` : ""}
                            </div>
                          </div>
                          <Badge variant={String(bill.status || "").toLowerCase() === "paid" ? "default" : "outline"}>
                            {bill.status || "Pending"}
                          </Badge>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm">
                          <span className="text-muted-foreground">Total: <span className="font-medium text-foreground">{formatCurrency(total)}</span></span>
                          <span className="text-muted-foreground">Balance: <span className="font-medium text-foreground">{formatCurrency(balance)}</span></span>
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <Button size="sm" onClick={() => onOpenBill(bill.id)}>
                            <ArrowUpRight className="mr-2 h-4 w-4" />
                            Open Bill
                          </Button>
                          <Button size="sm" variant="outline" asChild>
                            <a href={`/api/billing/${bill.id}/invoice`} target="_blank" rel="noreferrer">
                              <FileText className="mr-2 h-4 w-4" />
                              Invoice PDF
                            </a>
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="space-y-3 rounded-3xl border border-slate-200 bg-white/85 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-foreground">Receipt Matches</div>
                  <div className="text-sm text-muted-foreground">Search by receipt number or payment reference and jump to the linked invoice.</div>
                </div>
                <Badge variant="secondary">{paymentMatches.length}</Badge>
              </div>
              {paymentMatches.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-5 text-sm text-muted-foreground">
                  No receipt matches for this query.
                </div>
              ) : (
                <div className="space-y-3">
                  {paymentMatches.map((payment) => {
                    const patientName = `${payment.first_name || ""} ${payment.last_name || ""}`.trim() || "Unknown patient"
                    return (
                      <div key={payment.id} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <div className="font-medium text-foreground">{payment.receipt_no}</div>
                            <div className="text-sm text-muted-foreground">
                              {patientName}
                              {payment.patient_number ? ` | ${payment.patient_number}` : ""}
                            </div>
                          </div>
                          <Badge variant="outline" className="capitalize">
                            {String(payment.method || "").replace("_", " ")}
                          </Badge>
                        </div>
                        <div className="mt-3 space-y-1 text-sm text-muted-foreground">
                          <div>Amount: <span className="font-medium text-foreground">{formatCurrency(Number(payment.amount || 0))}</span></div>
                          {payment.bill_number && <div>Invoice: <span className="font-medium text-foreground">{payment.bill_number}</span></div>}
                          {payment.reference && <div>Reference: <span className="font-medium text-foreground">{payment.reference}</span></div>}
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <Button size="sm" variant="outline" asChild>
                            <a href={`/api/receipts/${payment.id}`} target="_blank" rel="noreferrer">
                              <ReceiptText className="mr-2 h-4 w-4" />
                              Receipt PDF
                            </a>
                          </Button>
                          {payment.bill_id && (
                            <Button size="sm" onClick={() => onOpenBill(payment.bill_id as string)}>
                              <ArrowUpRight className="mr-2 h-4 w-4" />
                              Open Bill
                            </Button>
                          )}
                          {payment.bill_id && (
                            <Button size="sm" variant="outline" asChild>
                              <a href={`/api/billing/${payment.bill_id}/invoice`} target="_blank" rel="noreferrer">
                                <FileText className="mr-2 h-4 w-4" />
                                Invoice PDF
                              </a>
                            </Button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
