"use client"

import { useState, useEffect } from "react"
import { ChevronDown, CheckCircle2, Loader2, Plus, Trash2, Pill, Stethoscope } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { BillItem } from "@/lib/billing-context"
import type { Patient } from "@/lib/patient-context"
import { formatPatientNumber } from "@/lib/patients"
import {
  SERVICE_CATEGORIES,
  SERVICE_CATEGORY_OPTIONS,
  DELIVERY_TYPES,
  DELIVERY_TYPE_OPTIONS,
} from "@/lib/service-categories"

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
  onDeliverySubChange?: (index: number, deliveryType: string) => void
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

// ---------------------------------------------------------------------------
// AccordionSection helper
// ---------------------------------------------------------------------------

interface AccordionSectionProps {
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
        onKeyDown={(e) => (e.key === "Enter" || e.key === " " ? onToggle() : null)}
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

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

type SectionKey = "patient" | "items" | "charges"

export function CreateBillAccordion(props: CreateBillAccordionProps) {
  const [openSections, setOpenSections] = useState<Set<SectionKey>>(
    new Set<SectionKey>(["patient", "items", "charges"])
  )
  const [totalPop, setTotalPop] = useState(false)
  const total = props.calculateTotal()

  useEffect(() => {
    setTotalPop(true)
    const t = setTimeout(() => setTotalPop(false), 150)
    return () => clearTimeout(t)
  }, [total])

  function toggle(key: SectionKey) {
    setOpenSections((prev) => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  // Filtered patients (local derived, mirroring create-bill logic)
  const filteredPatients = props.patients.filter((patient) => {
    const query = props.patientQuery.trim().toLowerCase()
    if (!query) return true
    return (
      `${patient.firstName} ${patient.lastName}`.toLowerCase().includes(query) ||
      (patient.patientNumber || "").toLowerCase().includes(query) ||
      patient.phone.toLowerCase().includes(query)
    )
  })

  // Item handlers (operate on props.onItemsChange)
  function handleAddItem() {
    props.onItemsChange([
      ...props.items,
      { description: "", quantity: 1, unitPrice: 0, total: 0, itemType: "medication" },
    ])
  }

  function handleRemoveItem(index: number) {
    props.onItemsChange(props.items.filter((_, i) => i !== index))
  }

  function handleItemChange(index: number, field: keyof BillItem, value: string | number) {
    const newItems = [...props.items]
    const item = { ...newItems[index], [field]: value }

    if (field === "itemType") {
      const type = value as "medication" | "service"
      item.itemType = type
      if (type === "service") {
        item.unitPrice = 0
        item.total = 0
        item.serviceCategory = undefined
      } else {
        item.serviceCategory = undefined
        item.total = item.quantity * item.unitPrice
      }
    } else if (field === "serviceCategory") {
      item.serviceCategory = value as string
      const desc =
        value === "Delivery"
          ? "Delivery"
          : DELIVERY_TYPES[value as string] || SERVICE_CATEGORIES[value as string] || (value as string)
      item.description = desc
    } else if (field === "quantity" || field === "unitPrice") {
      if (item.itemType !== "service") {
        item.total = item.quantity * item.unitPrice
      }
    } else if (field === "total" && item.itemType === "service") {
      item.total = Number(value) || 0
    }

    newItems[index] = item
    props.onItemsChange(newItems)
  }

  const selectedPatient = props.patients.find((p) => p.id === props.patientId)
  const selectedPatientName = selectedPatient
    ? `${selectedPatient.firstName} ${selectedPatient.lastName}`
    : undefined

  return (
    <div className="relative">
      {/* ------------------------------------------------------------------ */}
      {/* Section 1: Patient                                                   */}
      {/* ------------------------------------------------------------------ */}
      <AccordionSection
        open={openSections.has("patient")}
        onToggle={() => toggle("patient")}
        label="Patient"
        valid={!!props.patientId}
        summary={props.patientId ? selectedPatientName : undefined}
        validIcon={<CheckCircle2 className="h-4 w-4 text-emerald-500" />}
      >
        <div className="space-y-4 pt-2">
          {/* Patient search */}
          <div className="space-y-2">
            <Label htmlFor="patientSearch">Find Patient</Label>
            <Input
              id="patientSearch"
              placeholder="Search by patient name, ID, or phone"
              value={props.patientQuery}
              onChange={(e) => props.onPatientQueryChange(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              {filteredPatients.length} patient{filteredPatients.length === 1 ? "" : "s"} available in the selector below
            </p>
          </div>

          {/* Patient select */}
          <div className="space-y-2">
            <Label htmlFor="patient">Select Patient *</Label>
            <Select
              value={props.patientId}
              onValueChange={(next) => {
                props.onPatientChange(next)
                props.onAdminOverrideChange(false)
              }}
            >
              <SelectTrigger id="patient">
                <SelectValue placeholder="Choose a patient" />
              </SelectTrigger>
              <SelectContent>
                {filteredPatients.map((patient) => (
                  <SelectItem key={patient.id} value={patient.id}>
                    {patient.firstName} {patient.lastName} ({formatPatientNumber(patient.patientNumber)})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {filteredPatients.length === 0 && (
              <p className="text-xs text-amber-700">No patients match that search yet.</p>
            )}
          </div>

          {/* Insurance readiness panel */}
          {props.patientId ? (
            <div className="rounded-lg border bg-muted/20 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-foreground">Insurance readiness</div>
                  <div className="text-xs text-muted-foreground">
                    Helps Cashier know whether restricted services should proceed under cover.
                  </div>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={props.coverageLoading}
                  onClick={props.onRefreshCoverage}
                >
                  {props.coverageLoading ? "Loading..." : "Refresh"}
                </Button>
              </div>

              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <div className="rounded-md border bg-white p-3">
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Primary cover</div>
                  <div className="mt-2 text-sm font-semibold text-foreground">
                    {props.coverage?.primaryPolicy?.payer_name ? props.coverage.primaryPolicy.payer_name : "—"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {props.coverage?.primaryPolicy?.policy_no
                      ? `Policy ${props.coverage.primaryPolicy.policy_no}`
                      : "No policy on file"}
                  </div>
                </div>
                <div className="rounded-md border bg-white p-3">
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Verification</div>
                  <div className="mt-2">
                    <Badge variant={props.coverage?.summary?.readiness?.missingVerification ? "destructive" : "default"}>
                      {props.coverage?.summary?.readiness?.missingVerification ? "Missing" : "OK"}
                    </Badge>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {props.coverage?.summary?.policies?.needsVerificationCount != null
                      ? `${props.coverage.summary.policies.needsVerificationCount} policy(ies) need verification`
                      : "—"}
                  </div>
                </div>
                <div className="rounded-md border bg-white p-3">
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Docs / preauth</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge variant={props.coverage?.summary?.readiness?.missingDocuments ? "destructive" : "outline"}>
                      Docs {props.coverage?.summary?.documents?.missingRequiredTypes?.length ? "Missing" : "OK"}
                    </Badge>
                    <Badge variant={props.coverage?.summary?.readiness?.missingPreauth ? "destructive" : "outline"}>
                      Preauth {props.coverage?.summary?.readiness?.missingPreauth ? "Missing" : "OK"}
                    </Badge>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {Array.isArray(props.coverage?.summary?.documents?.missingRequiredTypes) &&
                    props.coverage.summary.documents.missingRequiredTypes.length
                      ? `Missing: ${props.coverage.summary.documents.missingRequiredTypes.join(", ")}`
                      : "—"}
                  </div>
                </div>
              </div>

              {props.userRole === "Hospital Admin" &&
              props.coverage?.summary?.readiness?.readyForRestrictedServices === false ? (
                <div className="mt-3 flex items-center justify-between gap-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm">
                  <div>
                    <div className="font-semibold text-amber-900">Admin override</div>
                    <div className="text-xs text-amber-800/80">
                      Enable only if you approve proceeding despite missing verification/preauth/documents.
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="adminOverride"
                      checked={props.adminOverride}
                      onCheckedChange={(v) => props.onAdminOverrideChange(v === true)}
                    />
                    <Label htmlFor="adminOverride" className="cursor-pointer text-amber-900">
                      Proceed anyway
                    </Label>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </AccordionSection>

      {/* ------------------------------------------------------------------ */}
      {/* Section 2: Bill Items                                                */}
      {/* ------------------------------------------------------------------ */}
      <AccordionSection
        open={openSections.has("items")}
        onToggle={() => toggle("items")}
        label="Bill Items"
        valid={props.items.length > 0}
        badge={<Badge variant="secondary">{props.items.length}</Badge>}
      >
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Add services or medications to this bill.</span>
            <Button type="button" variant="outline" size="sm" onClick={handleAddItem}>
              <Plus className="mr-2 h-4 w-4" />
              Add Item
            </Button>
          </div>

          <div className="space-y-3">
            {props.items.map((item, index) => {
              const isService = item.itemType === "service"
              const isDelivery = item.serviceCategory === "Delivery"
              return (
                <Card
                  key={index}
                  className={isService ? "border-l-4 border-l-emerald-400" : "border-l-4 border-l-sky-400"}
                >
                  <CardContent className="p-4">
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-medium text-foreground">Item {index + 1}</h4>
                          <Badge variant={isService ? "secondary" : "outline"} className="text-xs">
                            {isService ? (
                              <>
                                <Stethoscope className="mr-1 h-3 w-3" />
                                Service
                              </>
                            ) : (
                              <>
                                <Pill className="mr-1 h-3 w-3" />
                                Medication
                              </>
                            )}
                          </Badge>
                        </div>
                        {props.items.length > 1 && (
                          <Button type="button" variant="ghost" size="sm" onClick={() => handleRemoveItem(index)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label>Item type</Label>
                        <Select
                          value={item.itemType ?? "medication"}
                          onValueChange={(v) => handleItemChange(index, "itemType", v as "medication" | "service")}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="medication">Medication</SelectItem>
                            <SelectItem value="service">Service</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {isService && (
                        <>
                          <div className="space-y-2">
                            <Label>Service</Label>
                            <Select
                              value={item.serviceCategory ?? ""}
                              onValueChange={(v) => handleItemChange(index, "serviceCategory", v)}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select service" />
                              </SelectTrigger>
                              <SelectContent>
                                {SERVICE_CATEGORY_OPTIONS.map((key) => (
                                  <SelectItem key={key} value={key}>
                                    {key}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          {isDelivery && (
                            <div className="space-y-2">
                              <Label>Delivery type</Label>
                              <Select
                                value={
                                  item.description.startsWith("Delivery - ")
                                    ? item.description.replace("Delivery - ", "")
                                    : ""
                                }
                                onValueChange={(v) => props.onDeliverySubChange?.(index, v)}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select type" />
                                </SelectTrigger>
                                <SelectContent>
                                  {DELIVERY_TYPE_OPTIONS.map((key) => (
                                    <SelectItem key={key} value={key}>
                                      {DELIVERY_TYPES[key]}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                        </>
                      )}

                      <div className="grid gap-3 md:grid-cols-4">
                        <div className="space-y-2 md:col-span-2">
                          <Label>Description</Label>
                          <Input
                            placeholder={isService ? "e.g., Laboratory Tests" : "e.g., General Consultation"}
                            value={item.description}
                            onChange={(e) => handleItemChange(index, "description", e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Quantity</Label>
                          <Input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) =>
                              handleItemChange(index, "quantity", Math.max(1, Number.parseInt(e.target.value) || 1))
                            }
                          />
                        </div>
                        {isService ? (
                          <div className="space-y-2">
                            <Label>Total</Label>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              value={item.total || ""}
                              onChange={(e) =>
                                handleItemChange(index, "total", Number.parseFloat(e.target.value) || 0)
                              }
                            />
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <Label>Unit Price</Label>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              value={item.unitPrice}
                              onChange={(e) =>
                                handleItemChange(index, "unitPrice", Number.parseFloat(e.target.value) || 0)
                              }
                            />
                          </div>
                        )}
                      </div>

                      <div className="text-right">
                        <span className="text-sm text-muted-foreground">Total: </span>
                        <span className="text-sm font-medium text-foreground">
                          {props.formatCurrency(isService ? item.total : item.quantity * item.unitPrice)}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      </AccordionSection>

      {/* ------------------------------------------------------------------ */}
      {/* Section 3: Charges                                                   */}
      {/* ------------------------------------------------------------------ */}
      <AccordionSection
        open={openSections.has("charges")}
        onToggle={() => toggle("charges")}
        label="Charges"
        valid={true}
        summary={!openSections.has("charges") ? props.formatCurrency(props.calculateTotal()) : undefined}
      >
        <div className="space-y-4 pt-2 rounded-lg border border-border bg-muted/30 p-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="applyTax"
              checked={props.applyTax}
              onCheckedChange={(checked) => props.onApplyTaxChange(checked === true)}
            />
            <Label htmlFor="applyTax" className="cursor-pointer">
              Apply Tax
            </Label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="taxRate">Tax Rate (%)</Label>
              <Input
                id="taxRate"
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={props.taxRate}
                onChange={(e) => props.onTaxRateChange(Number.parseFloat(e.target.value) || 0)}
                disabled={!props.applyTax}
                className={!props.applyTax ? "opacity-50" : ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="discount">Discount Amount</Label>
              <Input
                id="discount"
                type="number"
                min="0"
                step="0.01"
                value={props.discountAmount}
                onChange={(e) => props.onDiscountChange(Number.parseFloat(e.target.value) || 0)}
              />
            </div>
          </div>

          <div className="space-y-2 border-t border-border pt-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal:</span>
              <span className="text-foreground">{props.formatCurrency(props.calculateSubtotal())}</span>
            </div>
            {props.applyTax && props.calculateTax() > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Tax ({props.taxRate}%):</span>
                <span className="text-foreground">{props.formatCurrency(props.calculateTax())}</span>
              </div>
            )}
            {props.discountAmount > 0 && (
              <div className="flex justify-between text-sm text-green-600">
                <span className="text-muted-foreground">Discount:</span>
                <span className="text-foreground">-{props.formatCurrency(props.discountAmount)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-border pt-2 text-base font-semibold">
              <span className="text-foreground">Total:</span>
              <span className="text-foreground">{props.formatCurrency(props.calculateTotal())}</span>
            </div>
          </div>
        </div>
      </AccordionSection>

      {/* ------------------------------------------------------------------ */}
      {/* Floating footer                                                      */}
      {/* ------------------------------------------------------------------ */}
      <div className="sticky bottom-0 border-t border-emerald-100 bg-background/95 px-6 py-3 backdrop-blur-sm shadow-[0_-4px_24px_rgba(0,0,0,0.06)]">
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
