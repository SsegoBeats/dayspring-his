"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import {
  formatCoverageOrder,
  getInsurancePayerTypeDescription,
  getInsurancePayerTypeLabel,
  getPanelStatusDescription,
  getPreauthorizationServiceDescription,
  getPreauthorizationStatusDescription,
  getSubscriberRelationshipLabel,
  getVerificationStatusDescription,
  INSURANCE_PANEL_STATUSES,
  INSURANCE_PAYER_TYPES,
  INSURANCE_PREAUTH_SERVICE_CATEGORIES,
  INSURANCE_PREAUTH_STATUSES,
  INSURANCE_SUBSCRIBER_RELATIONSHIPS,
  INSURANCE_VERIFICATION_STATUSES,
  type InsurancePanelStatus,
  type InsurancePayerType,
  type InsurancePreauthorizationServiceCategory,
  type InsurancePreauthorizationStatus,
  type InsuranceSubscriberRelationship,
  type InsuranceVerificationStatus,
} from "@/lib/insurance"
import { InsuranceFieldLabel, InsuranceHoverNote } from "@/components/patient/insurance-help"

type Payer = {
  id: string
  name: string
  payer_code?: string | null
  payer_type?: InsurancePayerType | null
  requires_preauth_default?: boolean | null
  scheme_stamp_required?: boolean | null
  panel_driven?: boolean | null
  contact_phone?: string | null
  contact_email?: string | null
  notes?: string | null
  active?: boolean | null
}

type Policy = {
  id: string
  payer_id: string
  payer_name: string
  payer_code?: string | null
  payer_type?: InsurancePayerType | null
  payer_notes?: string | null
  requires_preauth_default?: boolean | null
  scheme_stamp_required?: boolean | null
  panel_driven?: boolean | null
  policy_no: string
  member_id?: string | null
  group_no?: string | null
  plan_name?: string | null
  scheme_name?: string | null
  employer_name?: string | null
  staff_number?: string | null
  subscriber_name?: string | null
  subscriber_relationship?: InsuranceSubscriberRelationship | null
  coordination_order?: number | null
  panel_status?: InsurancePanelStatus | null
  effective_date?: string | null
  expiry_date?: string | null
  coverage_notes?: string | null
  verification_status?: InsuranceVerificationStatus | null
  verification_reference?: string | null
  verification_notes?: string | null
  verified_at?: string | null
  authorization_required?: boolean | null
  authorization_reference?: string | null
  active: boolean
  updated_at?: string | null
}

type Preauthorization = {
  id: string
  payer_id: string
  payer_name: string
  policy_id?: string | null
  policy_no?: string | null
  service_category?: InsurancePreauthorizationServiceCategory | null
  requested_service?: string | null
  request_reference?: string | null
  status: InsurancePreauthorizationStatus
  auth_code?: string | null
  response_due_at?: string | null
  valid_until?: string | null
  notes?: string | null
  updated_at?: string | null
}

type PolicyFormState = {
  payerId: string
  policyNo: string
  memberId: string
  groupNo: string
  planName: string
  schemeName: string
  employerName: string
  staffNumber: string
  subscriberName: string
  subscriberRelationship: InsuranceSubscriberRelationship | ""
  coordinationOrder: string
  panelStatus: InsurancePanelStatus
  effectiveDate: string
  expiryDate: string
  verificationStatus: InsuranceVerificationStatus
  verificationReference: string
  verificationNotes: string
  authorizationRequired: boolean
  authorizationReference: string
  coverageNotes: string
  active: boolean
}

type PreauthFormState = {
  payerId: string
  policyId: string
  serviceCategory: InsurancePreauthorizationServiceCategory
  requestedService: string
  requestReference: string
  status: InsurancePreauthorizationStatus
  authCode: string
  responseDueAt: string
  validUntil: string
  notes: string
}

type PayerFormState = {
  name: string
  payerCode: string
  payerType: InsurancePayerType
  requiresPreauthDefault: boolean
  schemeStampRequired: boolean
  panelDriven: boolean
  contactPhone: string
  contactEmail: string
  notes: string
  active: boolean
}

const emptyPolicyForm = (): PolicyFormState => ({
  payerId: "",
  policyNo: "",
  memberId: "",
  groupNo: "",
  planName: "",
  schemeName: "",
  employerName: "",
  staffNumber: "",
  subscriberName: "",
  subscriberRelationship: "",
  coordinationOrder: "1",
  panelStatus: "Unknown",
  effectiveDate: "",
  expiryDate: "",
  verificationStatus: "Unverified",
  verificationReference: "",
  verificationNotes: "",
  authorizationRequired: false,
  authorizationReference: "",
  coverageNotes: "",
  active: true,
})

const emptyPreauthForm = (): PreauthFormState => ({
  payerId: "",
  policyId: "",
  serviceCategory: "Admission",
  requestedService: "",
  requestReference: "",
  status: "Pending",
  authCode: "",
  responseDueAt: "",
  validUntil: "",
  notes: "",
})

const emptyPayerForm = (): PayerFormState => ({
  name: "",
  payerCode: "",
  payerType: "INSURER",
  requiresPreauthDefault: false,
  schemeStampRequired: false,
  panelDriven: false,
  contactPhone: "",
  contactEmail: "",
  notes: "",
  active: true,
})

function toPolicyForm(policy: Policy): PolicyFormState {
  return {
    payerId: policy.payer_id,
    policyNo: policy.policy_no,
    memberId: policy.member_id || "",
    groupNo: policy.group_no || "",
    planName: policy.plan_name || "",
    schemeName: policy.scheme_name || "",
    employerName: policy.employer_name || "",
    staffNumber: policy.staff_number || "",
    subscriberName: policy.subscriber_name || "",
    subscriberRelationship: policy.subscriber_relationship || "",
    coordinationOrder: String(policy.coordination_order || 1),
    panelStatus: policy.panel_status || "Unknown",
    effectiveDate: policy.effective_date || "",
    expiryDate: policy.expiry_date || "",
    verificationStatus: policy.verification_status || "Unverified",
    verificationReference: policy.verification_reference || "",
    verificationNotes: policy.verification_notes || "",
    authorizationRequired: !!policy.authorization_required,
    authorizationReference: policy.authorization_reference || "",
    coverageNotes: policy.coverage_notes || "",
    active: !!policy.active,
  }
}

function toPreauthForm(preauth: Preauthorization): PreauthFormState {
  return {
    payerId: preauth.payer_id,
    policyId: preauth.policy_id || "",
    serviceCategory: preauth.service_category || "Admission",
    requestedService: preauth.requested_service || "",
    requestReference: preauth.request_reference || "",
    status: preauth.status,
    authCode: preauth.auth_code || "",
    responseDueAt: preauth.response_due_at || "",
    validUntil: preauth.valid_until || "",
    notes: preauth.notes || "",
  }
}

function normalizePolicyPayload(form: PolicyFormState) {
  return {
    payerId: form.payerId,
    policyNo: form.policyNo.trim(),
    memberId: form.memberId.trim() || null,
    groupNo: form.groupNo.trim() || null,
    planName: form.planName.trim() || null,
    schemeName: form.schemeName.trim() || null,
    employerName: form.employerName.trim() || null,
    staffNumber: form.staffNumber.trim() || null,
    subscriberName: form.subscriberName.trim() || null,
    subscriberRelationship: form.subscriberRelationship || null,
    coordinationOrder: Number(form.coordinationOrder || 1),
    panelStatus: form.panelStatus,
    effectiveDate: form.effectiveDate || null,
    expiryDate: form.expiryDate || null,
    verificationStatus: form.verificationStatus,
    verificationReference: form.verificationReference.trim() || null,
    verificationNotes: form.verificationNotes.trim() || null,
    authorizationRequired: form.authorizationRequired,
    authorizationReference: form.authorizationReference.trim() || null,
    coverageNotes: form.coverageNotes.trim() || null,
    active: form.active,
  }
}

function normalizePreauthPayload(form: PreauthFormState) {
  return {
    payerId: form.payerId,
    policyId: form.policyId || null,
    serviceCategory: form.serviceCategory,
    requestedService: form.requestedService.trim(),
    requestReference: form.requestReference.trim() || null,
    status: form.status,
    authCode: form.authCode.trim() || null,
    responseDueAt: form.responseDueAt || null,
    validUntil: form.validUntil || null,
    notes: form.notes.trim() || null,
  }
}

function verificationBadgeClass(status: InsuranceVerificationStatus) {
  switch (status) {
    case "Verified":
      return "border-emerald-200 bg-emerald-50 text-emerald-700"
    case "Pending":
      return "border-amber-200 bg-amber-50 text-amber-700"
    case "Rejected":
    case "Expired":
      return "border-rose-200 bg-rose-50 text-rose-700"
    case "Unverified":
    default:
      return "border-slate-200 bg-slate-50 text-slate-700"
  }
}

function preauthBadgeClass(status: InsurancePreauthorizationStatus) {
  switch (status) {
    case "Approved":
      return "border-emerald-200 bg-emerald-50 text-emerald-700"
    case "Pending":
      return "border-amber-200 bg-amber-50 text-amber-700"
    case "Denied":
    case "Expired":
    default:
      return "border-rose-200 bg-rose-50 text-rose-700"
  }
}

function isExpired(policy: Policy) {
  if (!policy.expiry_date) return false
  return new Date(policy.expiry_date).getTime() < new Date(new Date().toDateString()).getTime()
}

function formatCoverageWindow(policy: Policy) {
  if (!policy.effective_date && !policy.expiry_date) return "Coverage dates not recorded"
  if (!policy.effective_date) return `Ends ${new Date(policy.expiry_date as string).toLocaleDateString()}`
  if (!policy.expiry_date) return `Active since ${new Date(policy.effective_date).toLocaleDateString()}`
  return `${new Date(policy.effective_date).toLocaleDateString()} to ${new Date(policy.expiry_date).toLocaleDateString()}`
}

function formatPreauthWindow(preauth: Preauthorization) {
  if (preauth.valid_until) return `Valid until ${new Date(preauth.valid_until).toLocaleDateString()}`
  if (preauth.response_due_at) return `Expected by ${new Date(preauth.response_due_at).toLocaleDateString()}`
  return "No decision date recorded"
}

const ugandaWorkflowGuides = [
  {
    title: "Insurer / HMO intake",
    description: "Capture the card or member number, scheme owner, panel status, and a traceable eligibility check before the patient reaches billing or triage.",
  },
  {
    title: "Corporate guarantee intake",
    description: "Corporate, school, church, NGO, and sponsor-backed visits should capture the employer or scheme name and keep the guarantee letter on file.",
  },
  {
    title: "Pre-authorization handoff",
    description: "Admissions, scans, surgery, maternity, and other restricted services should be tracked with request reference, approval code, and supporting document.",
  },
] as const

function PayerContextCallout({ payer }: { payer?: Payer | null }) {
  if (!payer) return null

  return (
    <div className="rounded-lg border border-sky-200 bg-sky-50/70 p-3 text-sm text-sky-950">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">{getInsurancePayerTypeLabel(payer.payer_type || "INSURER")}</Badge>
        {payer.requires_preauth_default ? <Badge variant="secondary">Pre-authorization usually needed</Badge> : null}
        {payer.scheme_stamp_required ? <Badge variant="secondary">Scheme or HR stamp commonly required</Badge> : null}
        {payer.panel_driven ? <Badge variant="secondary">Panel confirmation recommended</Badge> : null}
      </div>
      <div className="mt-2 leading-6">{payer.notes || getInsurancePayerTypeDescription(payer.payer_type || "INSURER")}</div>
    </div>
  )
}

function PolicyEditor({
  form,
  onChange,
  payerOptions,
  idPrefix,
}: {
  form: PolicyFormState
  onChange: (field: keyof PolicyFormState, value: string | boolean) => void
  payerOptions: Payer[]
  idPrefix: string
}) {
  const selectedPayer = payerOptions.find((payer) => payer.id === form.payerId)
  const selectedPayerType = (selectedPayer?.payer_type || "INSURER") as InsurancePayerType
  const needsCorporateOwner = selectedPayerType === "CORPORATE"
  const verificationNeedsReference = form.verificationStatus === "Verified"

  return (
    <div className="space-y-4">
      <PayerContextCallout payer={selectedPayer} />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="space-y-2">
          <InsuranceFieldLabel htmlFor={`${idPrefix}-payer`} help="Select the insurer, HMO, or corporate guarantor responsible for the visit." required>
            Payer
          </InsuranceFieldLabel>
          <Select value={form.payerId} onValueChange={(value) => onChange("payerId", value)} disabled={!payerOptions.length}>
            <SelectTrigger id={`${idPrefix}-payer`} aria-label="Payer" className="w-full">
              <SelectValue placeholder={payerOptions.length ? "Select payer" : "No payers available"} />
            </SelectTrigger>
            <SelectContent>
              {payerOptions.map((payer) => (
                <SelectItem key={payer.id} value={payer.id}>
                  {payer.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <InsuranceFieldLabel htmlFor={`${idPrefix}-plan-name`} help="Benefit option or plan name printed on the card or member schedule.">
            Plan / benefit option
          </InsuranceFieldLabel>
          <Input
            id={`${idPrefix}-plan-name`}
            name={`${idPrefix}-planName`}
            value={form.planName}
            onChange={(event) => onChange("planName", event.target.value)}
            placeholder="Outpatient, inpatient, executive, family"
          />
        </div>

        <div className="space-y-2">
          <InsuranceFieldLabel htmlFor={`${idPrefix}-scheme-name`} help="Employer or organisation scheme name as shown on the card or sponsor letter.">
            Scheme name
          </InsuranceFieldLabel>
          <Input
            id={`${idPrefix}-scheme-name`}
            name={`${idPrefix}-schemeName`}
            value={form.schemeName}
            onChange={(event) => onChange("schemeName", event.target.value)}
            placeholder="Employer or sponsored scheme"
          />
          {needsCorporateOwner && (
            <p className="text-xs text-muted-foreground">
              For corporate guarantees, capture either a scheme name or employer/sponsor.
            </p>
          )}
        </div>

        <div className="space-y-2">
          <InsuranceFieldLabel htmlFor={`${idPrefix}-policy-number`} help="Card number, policy number, or payer serial used to identify the cover." required>
            Policy / card number
          </InsuranceFieldLabel>
          <Input
            id={`${idPrefix}-policy-number`}
            name={`${idPrefix}-policyNo`}
            value={form.policyNo}
            onChange={(event) => onChange("policyNo", event.target.value)}
            placeholder="Policy or card number"
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="space-y-2">
          <InsuranceFieldLabel htmlFor={`${idPrefix}-member-id`} help="Member or principal number recognised by the payer.">
            Member / principal number
          </InsuranceFieldLabel>
          <Input
            id={`${idPrefix}-member-id`}
            name={`${idPrefix}-memberId`}
            value={form.memberId}
            onChange={(event) => onChange("memberId", event.target.value)}
            placeholder="Member or principal number"
          />
        </div>

        <div className="space-y-2">
          <InsuranceFieldLabel htmlFor={`${idPrefix}-group-number`} help="Group, contract, or scheme code used by the payer.">
            Group / contract number
          </InsuranceFieldLabel>
          <Input
            id={`${idPrefix}-group-number`}
            name={`${idPrefix}-groupNo`}
            value={form.groupNo}
            onChange={(event) => onChange("groupNo", event.target.value)}
            placeholder="Scheme or group number"
          />
        </div>

        <div className="space-y-2">
          <InsuranceFieldLabel
            htmlFor={`${idPrefix}-employer-name`}
            help="Employer, school, NGO, church, or sponsor attached to the scheme."
            required={needsCorporateOwner && !form.schemeName.trim()}
          >
            Employer / sponsor
          </InsuranceFieldLabel>
          <Input
            id={`${idPrefix}-employer-name`}
            name={`${idPrefix}-employerName`}
            value={form.employerName}
            onChange={(event) => onChange("employerName", event.target.value)}
            placeholder="Employer, school, NGO, church"
          />
        </div>

        <div className="space-y-2">
          <InsuranceFieldLabel htmlFor={`${idPrefix}-staff-number`} help="Staff, payroll, or HR number used when the scheme is employer-based.">
            Staff / payroll number
          </InsuranceFieldLabel>
          <Input
            id={`${idPrefix}-staff-number`}
            name={`${idPrefix}-staffNumber`}
            value={form.staffNumber}
            onChange={(event) => onChange("staffNumber", event.target.value)}
            placeholder="Employee or payroll number"
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="space-y-2">
          <InsuranceFieldLabel htmlFor={`${idPrefix}-subscriber-name`} help="If the patient is not the principal member, capture the policyholder or subscriber name here.">
            Principal member / subscriber
          </InsuranceFieldLabel>
          <Input
            id={`${idPrefix}-subscriber-name`}
            name={`${idPrefix}-subscriberName`}
            value={form.subscriberName}
            onChange={(event) => onChange("subscriberName", event.target.value)}
            placeholder="Principal member or sponsor name"
          />
        </div>

        <div className="space-y-2">
          <InsuranceFieldLabel htmlFor={`${idPrefix}-relationship`} help="Shows whether the patient is the principal member or a dependant.">
            Relationship to principal member
          </InsuranceFieldLabel>
          <Select
            value={form.subscriberRelationship || "__empty__"}
            onValueChange={(value) => onChange("subscriberRelationship", value === "__empty__" ? "" : value)}
          >
            <SelectTrigger id={`${idPrefix}-relationship`} aria-label="Relationship to principal member" className="w-full">
              <SelectValue placeholder="Select relationship" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__empty__">Not recorded</SelectItem>
              {INSURANCE_SUBSCRIBER_RELATIONSHIPS.map((relationship) => (
                <SelectItem key={relationship} value={relationship}>
                  {getSubscriberRelationshipLabel(relationship)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <InsuranceFieldLabel htmlFor={`${idPrefix}-coverage-order`} help="Only use this when the patient has more than one active cover.">
            Other cover order
          </InsuranceFieldLabel>
          <Select value={form.coordinationOrder} onValueChange={(value) => onChange("coordinationOrder", value)}>
            <SelectTrigger id={`${idPrefix}-coverage-order`} aria-label="Coverage order" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[1, 2, 3, 4].map((order) => (
                <SelectItem key={order} value={String(order)}>
                  {formatCoverageOrder(order)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <InsuranceFieldLabel htmlFor={`${idPrefix}-panel-status`} help="Confirms whether the facility or service is allowed under the payer's panel network.">
            Provider panel status
          </InsuranceFieldLabel>
          <Select value={form.panelStatus} onValueChange={(value: InsurancePanelStatus) => onChange("panelStatus", value)}>
            <SelectTrigger id={`${idPrefix}-panel-status`} aria-label="Provider panel status" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {INSURANCE_PANEL_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {status}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">{getPanelStatusDescription(form.panelStatus)}</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="space-y-2">
          <InsuranceFieldLabel htmlFor={`${idPrefix}-effective-date`} help="Date from which the payer says the cover is active.">
            Effective date
          </InsuranceFieldLabel>
          <Input id={`${idPrefix}-effective-date`} name={`${idPrefix}-effectiveDate`} type="date" value={form.effectiveDate} onChange={(event) => onChange("effectiveDate", event.target.value)} />
        </div>

        <div className="space-y-2">
          <InsuranceFieldLabel htmlFor={`${idPrefix}-expiry-date`} help="Date the cover ends or the card expires.">
            Expiry date
          </InsuranceFieldLabel>
          <Input id={`${idPrefix}-expiry-date`} name={`${idPrefix}-expiryDate`} type="date" value={form.expiryDate} onChange={(event) => onChange("expiryDate", event.target.value)} />
        </div>

        <div className="space-y-2">
          <InsuranceFieldLabel htmlFor={`${idPrefix}-verification-status`} help="Use Verified only after an actual eligibility check has happened.">
            Eligibility verification
          </InsuranceFieldLabel>
          <Select value={form.verificationStatus} onValueChange={(value: InsuranceVerificationStatus) => onChange("verificationStatus", value)}>
            <SelectTrigger id={`${idPrefix}-verification-status`} aria-label="Eligibility verification" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {INSURANCE_VERIFICATION_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {status}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">{getVerificationStatusDescription(form.verificationStatus)}</p>
        </div>

        <div className="space-y-2">
          <InsuranceFieldLabel
            htmlFor={`${idPrefix}-verification-reference`}
            help="Call reference, portal trace, email trail, or ticket proving the verification."
            required={verificationNeedsReference}
          >
            Verification reference
          </InsuranceFieldLabel>
          <Input
            id={`${idPrefix}-verification-reference`}
            name={`${idPrefix}-verificationReference`}
            value={form.verificationReference}
            onChange={(event) => onChange("verificationReference", event.target.value)}
            placeholder="Call ref, portal trace, email"
          />
          {verificationNeedsReference && !form.verificationReference.trim() ? (
            <p className="text-xs text-amber-700">
              Verified cover must have a traceable reference.
            </p>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_1fr_260px]">
        <div className="space-y-2">
          <InsuranceFieldLabel htmlFor={`${idPrefix}-coverage-notes`} help="Benefits, exclusions, copays, visit caps, maternity limits, or sponsor billing instructions.">
            Coverage notes
          </InsuranceFieldLabel>
          <Textarea
            id={`${idPrefix}-coverage-notes`}
            name={`${idPrefix}-coverageNotes`}
            rows={4}
            value={form.coverageNotes}
            onChange={(event) => onChange("coverageNotes", event.target.value)}
            placeholder="Benefits, exclusions, co-pay instructions, visit caps, or front-desk remarks."
          />
        </div>

        <div className="space-y-2">
          <InsuranceFieldLabel htmlFor={`${idPrefix}-verification-notes`} help="Who confirmed cover, what they allowed, and any pending restrictions.">
            Verification notes
          </InsuranceFieldLabel>
          <Textarea
            id={`${idPrefix}-verification-notes`}
            name={`${idPrefix}-verificationNotes`}
            rows={4}
            value={form.verificationNotes}
            onChange={(event) => onChange("verificationNotes", event.target.value)}
            placeholder="Who confirmed cover, what was allowed, and any pending restrictions."
          />
        </div>

        <div className="rounded-lg border p-3">
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-foreground">Active cover</div>
                <p className="text-xs text-muted-foreground">Inactive cover stays in history but should not be used for billing.</p>
              </div>
              <Switch id={`${idPrefix}-active`} checked={form.active} onCheckedChange={(value) => onChange("active", value)} aria-label="Active policy" />
            </div>

            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-foreground">Authorization required</div>
                <p className="text-xs text-muted-foreground">Turn this on when the payer requires prior approval for the visit or service.</p>
              </div>
              <Switch id={`${idPrefix}-authorization-required`} checked={form.authorizationRequired} onCheckedChange={(value) => onChange("authorizationRequired", value)} aria-label="Authorization required" />
            </div>

            <div className="space-y-2">
              <InsuranceFieldLabel htmlFor={`${idPrefix}-authorization-reference`} help="Approval number, email ref, or pre-auth note received from the payer.">
                Authorization reference
              </InsuranceFieldLabel>
              <Input
                id={`${idPrefix}-authorization-reference`}
                name={`${idPrefix}-authorizationReference`}
                value={form.authorizationReference}
                onChange={(event) => onChange("authorizationReference", event.target.value)}
                placeholder="Pre-auth code or approval note"
                disabled={!form.authorizationRequired}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function PreauthorizationEditor({
  form,
  onChange,
  payerOptions,
  policyOptions,
  idPrefix,
}: {
  form: PreauthFormState
  onChange: (field: keyof PreauthFormState, value: string) => void
  payerOptions: Payer[]
  policyOptions: Policy[]
  idPrefix: string
}) {
  const filteredPolicies = policyOptions.filter((policy) => !form.payerId || policy.payer_id === form.payerId)
  const selectedPayer = payerOptions.find((payer) => payer.id === form.payerId)

  return (
    <div className="space-y-4">
      <PayerContextCallout payer={selectedPayer} />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="space-y-2">
          <InsuranceFieldLabel htmlFor={`${idPrefix}-payer`} help="Use the payer that must authorize the service." required>
            Payer
          </InsuranceFieldLabel>
          <Select value={form.payerId} onValueChange={(value) => onChange("payerId", value)}>
            <SelectTrigger id={`${idPrefix}-payer`} aria-label="Preauthorization payer" className="w-full">
              <SelectValue placeholder="Select payer" />
            </SelectTrigger>
            <SelectContent>
              {payerOptions.map((payer) => (
                <SelectItem key={payer.id} value={payer.id}>
                  {payer.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <InsuranceFieldLabel htmlFor={`${idPrefix}-policy`} help="Link the authorization to the exact policy when the patient has more than one active cover.">
            Related policy
          </InsuranceFieldLabel>
          <Select value={form.policyId || "__empty__"} onValueChange={(value) => onChange("policyId", value === "__empty__" ? "" : value)}>
            <SelectTrigger id={`${idPrefix}-policy`} aria-label="Related policy" className="w-full">
              <SelectValue placeholder="Select policy" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__empty__">Not linked</SelectItem>
              {filteredPolicies.map((policy) => (
                <SelectItem key={policy.id} value={policy.id}>
                  {policy.policy_no} {policy.scheme_name ? `| ${policy.scheme_name}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <InsuranceFieldLabel htmlFor={`${idPrefix}-service-category`} help="Choose the type of service the payer is being asked to approve.">
            Service category
          </InsuranceFieldLabel>
          <Select value={form.serviceCategory} onValueChange={(value: InsurancePreauthorizationServiceCategory) => onChange("serviceCategory", value)}>
            <SelectTrigger id={`${idPrefix}-service-category`} aria-label="Authorization service category" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {INSURANCE_PREAUTH_SERVICE_CATEGORIES.map((category) => (
                <SelectItem key={category} value={category}>
                  {category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">{getPreauthorizationServiceDescription(form.serviceCategory)}</p>
        </div>

        <div className="space-y-2">
          <InsuranceFieldLabel htmlFor={`${idPrefix}-status`} help="Pending means the request is still with the payer. Approved and denied should be used only after response.">
            Decision status
          </InsuranceFieldLabel>
          <Select value={form.status} onValueChange={(value: InsurancePreauthorizationStatus) => onChange("status", value)}>
            <SelectTrigger id={`${idPrefix}-status`} aria-label="Authorization status" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {INSURANCE_PREAUTH_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {status}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">{getPreauthorizationStatusDescription(form.status)}</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="space-y-2 xl:col-span-2">
          <InsuranceFieldLabel htmlFor={`${idPrefix}-requested-service`} help="Describe exactly what needs approval, for example CT scan abdomen, theatre admission, or maternity package.">
            Requested service
          </InsuranceFieldLabel>
          <Input
            id={`${idPrefix}-requested-service`}
            name={`${idPrefix}-requestedService`}
            value={form.requestedService}
            onChange={(event) => onChange("requestedService", event.target.value)}
            placeholder="CT scan, theatre admission, maternity package, MRI, surgery"
          />
        </div>

        <div className="space-y-2">
          <InsuranceFieldLabel htmlFor={`${idPrefix}-request-reference`} help="Internal request number, email trail, portal case ID, or insurer ticket.">
            Request reference
          </InsuranceFieldLabel>
          <Input
            id={`${idPrefix}-request-reference`}
            name={`${idPrefix}-requestReference`}
            value={form.requestReference}
            onChange={(event) => onChange("requestReference", event.target.value)}
            placeholder="Case ID, portal ref, email thread"
          />
        </div>

        <div className="space-y-2">
          <InsuranceFieldLabel htmlFor={`${idPrefix}-auth-code`} help="Approval code or authorization number once the payer grants it.">
            Authorization code
          </InsuranceFieldLabel>
          <Input
            id={`${idPrefix}-auth-code`}
            name={`${idPrefix}-authCode`}
            value={form.authCode}
            onChange={(event) => onChange("authCode", event.target.value)}
            placeholder="Approval code"
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <div className="space-y-2">
          <InsuranceFieldLabel htmlFor={`${idPrefix}-response-due`} help="Date by which the payer promised to respond or the desk expects a decision.">
            Response due
          </InsuranceFieldLabel>
          <Input id={`${idPrefix}-response-due`} name={`${idPrefix}-responseDueAt`} type="date" value={form.responseDueAt} onChange={(event) => onChange("responseDueAt", event.target.value)} />
        </div>

        <div className="space-y-2">
          <InsuranceFieldLabel htmlFor={`${idPrefix}-valid-until`} help="If the approval has a validity date, capture it here.">
            Approval valid until
          </InsuranceFieldLabel>
          <Input id={`${idPrefix}-valid-until`} name={`${idPrefix}-validUntil`} type="date" value={form.validUntil} onChange={(event) => onChange("validUntil", event.target.value)} />
        </div>

        <div className="space-y-2">
          <InsuranceFieldLabel htmlFor={`${idPrefix}-notes`} help="Who was contacted, what was approved, and any limitation or denial explanation.">
            Authorization notes
          </InsuranceFieldLabel>
          <Textarea
            id={`${idPrefix}-notes`}
            name={`${idPrefix}-notes`}
            rows={3}
            value={form.notes}
            onChange={(event) => onChange("notes", event.target.value)}
            placeholder="Who was contacted, what was approved, and what still needs follow-up."
          />
        </div>
      </div>
    </div>
  )
}

export function InsurancePolicies({
  patientId,
  hideAuthorizations,
  hideIntake,
  hideRecords,
  hideAddPayer,
  compact,
}: {
  patientId: string
  hideAuthorizations?: boolean
  hideIntake?: boolean
  hideRecords?: boolean
  hideAddPayer?: boolean
  compact?: boolean
}) {
  const [payers, setPayers] = useState<Payer[]>([])
  const [policies, setPolicies] = useState<Policy[]>([])
  const [preauthorizations, setPreauthorizations] = useState<Preauthorization[]>([])
  const [createForm, setCreateForm] = useState<PolicyFormState>(emptyPolicyForm())
  const [preauthForm, setPreauthForm] = useState<PreauthFormState>(emptyPreauthForm())
  const [newPayer, setNewPayer] = useState<PayerFormState>(emptyPayerForm())
  const [policyDrafts, setPolicyDrafts] = useState<Record<string, PolicyFormState>>({})
  const [preauthDrafts, setPreauthDrafts] = useState<Record<string, PreauthFormState>>({})
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [creatingPreauth, setCreatingPreauth] = useState(false)
  const [addingPayer, setAddingPayer] = useState(false)
  const [savingPolicyId, setSavingPolicyId] = useState<string | null>(null)
  const [savingPreauthId, setSavingPreauthId] = useState<string | null>(null)
  const [deletingPolicyId, setDeletingPolicyId] = useState<string | null>(null)
  const [deletingPreauthId, setDeletingPreauthId] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const [payersRes, policiesRes, preauthRes] = await Promise.all([
        fetch("/api/insurance/payers", { credentials: "include" }),
        fetch(`/api/insurance/policies?patientId=${patientId}`, { credentials: "include" }),
        fetch(`/api/insurance/preauthorizations?patientId=${patientId}`, { credentials: "include" }),
      ])

      if (payersRes.ok) {
        setPayers((await payersRes.json()).payers || [])
      } else if (payersRes.status === 401 || payersRes.status === 403) {
        setPayers([])
      }

      if (policiesRes.ok) {
        const nextPolicies = (await policiesRes.json()).policies || []
        setPolicies(nextPolicies)
        const nextDrafts: Record<string, PolicyFormState> = {}
        nextPolicies.forEach((policy: Policy) => {
          nextDrafts[policy.id] = toPolicyForm(policy)
        })
        setPolicyDrafts(nextDrafts)
      }

      if (preauthRes.ok) {
        const nextPreauths = (await preauthRes.json()).preauthorizations || []
        setPreauthorizations(nextPreauths)
        const nextDrafts: Record<string, PreauthFormState> = {}
        nextPreauths.forEach((preauth: Preauthorization) => {
          nextDrafts[preauth.id] = toPreauthForm(preauth)
        })
        setPreauthDrafts(nextDrafts)
      }
    } catch {
      // Silent load failure; the current state remains visible.
    } finally {
      setLoading(false)
    }
  }, [patientId])

  useEffect(() => {
    void load()
  }, [load])

  const activePolicies = useMemo(() => policies.filter((policy) => policy.active), [policies])
  const verifiedPolicies = useMemo(() => policies.filter((policy) => policy.verification_status === "Verified" && !isExpired(policy)), [policies])
  const policiesNeedingAuth = useMemo(() => policies.filter((policy) => !!policy.authorization_required), [policies])
  const openPreauthorizations = useMemo(
    () => preauthorizations.filter((preauth) => preauth.status === "Pending" || preauth.status === "Approved"),
    [preauthorizations],
  )
  const missingVerificationCount = useMemo(
    () => activePolicies.filter((policy) => (policy.verification_status || "Unverified") !== "Verified").length,
    [activePolicies],
  )
  const missingPreauthCount = useMemo(() => {
    const policyIdsWithOpenPreauth = new Set(openPreauthorizations.map((item) => item.policy_id).filter(Boolean))
    return policiesNeedingAuth.filter((policy) => !policyIdsWithOpenPreauth.has(policy.id)).length
  }, [openPreauthorizations, policiesNeedingAuth])

  const selectedCreatePayer = payers.find((payer) => payer.id === createForm.payerId)

  const updateCreateForm = (field: keyof PolicyFormState, value: string | boolean) => {
    setCreateForm((current) => {
      const next = { ...current, [field]: value }
      if (field === "payerId") {
        const payer = payers.find((item) => item.id === value)
        if (payer) {
          next.authorizationRequired = current.authorizationRequired || !!payer.requires_preauth_default
        }
      }
      return next
    })
  }

  const updatePolicyDraft = (policyId: string, field: keyof PolicyFormState, value: string | boolean) => {
    setPolicyDrafts((current) => ({
      ...current,
      [policyId]: {
        ...(current[policyId] || emptyPolicyForm()),
        [field]: value,
      },
    }))
  }

  const updatePreauthForm = (field: keyof PreauthFormState, value: string) => {
    setPreauthForm((current) => ({ ...current, [field]: value }))
  }

  const updatePreauthDraft = (preauthId: string, field: keyof PreauthFormState, value: string) => {
    setPreauthDrafts((current) => ({
      ...current,
      [preauthId]: {
        ...(current[preauthId] || emptyPreauthForm()),
        [field]: value,
      },
    }))
  }

  const updateNewPayer = (field: keyof PayerFormState, value: string | boolean) => {
    setNewPayer((current) => ({ ...current, [field]: value }))
  }

  const addPolicy = async () => {
    const payload = normalizePolicyPayload(createForm)
    if (!payload.payerId || !payload.policyNo) {
      toast.error("Select payer and enter a policy or card number")
      return
    }
    if (selectedCreatePayer?.payer_type === "CORPORATE" && !payload.employerName && !payload.schemeName) {
      toast.error("Corporate or sponsor cover should include an employer or scheme name")
      return
    }
    if (payload.verificationStatus === "Verified" && !payload.verificationReference) {
      toast.error("Verified cover needs a verification reference")
      return
    }

    setCreating(true)
    try {
      const res = await fetch("/api/insurance/policies", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientId, ...payload }),
      })
      if (!res.ok) {
        const error = await res.json().catch(() => ({}))
        toast.error(error.error || "Failed to add policy")
      } else {
        toast.success("Coverage added")
        setCreateForm(emptyPolicyForm())
        await load()
      }
    } catch {
      toast.error("Failed to add policy")
    } finally {
      setCreating(false)
    }
  }

  const savePolicy = async (policyId: string) => {
    const draft = policyDrafts[policyId]
    if (!draft) return
    const payload = normalizePolicyPayload(draft)
    if (!payload.payerId || !payload.policyNo) {
      toast.error("Payer and policy number are required")
      return
    }
    const selectedPayer = payers.find((item) => item.id === payload.payerId)
    if (selectedPayer?.payer_type === "CORPORATE" && !payload.employerName && !payload.schemeName) {
      toast.error("Corporate or sponsor cover should include an employer or scheme name")
      return
    }
    if (payload.verificationStatus === "Verified" && !payload.verificationReference) {
      toast.error("Verified cover needs a verification reference")
      return
    }

    setSavingPolicyId(policyId)
    try {
      const res = await fetch(`/api/insurance/policies?id=${policyId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const error = await res.json().catch(() => ({}))
        toast.error(error.error || "Failed to save policy")
      } else {
        toast.success("Coverage updated")
        await load()
      }
    } catch {
      toast.error("Failed to save policy")
    } finally {
      setSavingPolicyId(null)
    }
  }

  const deletePolicy = async (policyId: string) => {
    if (!window.confirm("Remove this policy from the patient record?")) return
    setDeletingPolicyId(policyId)
    try {
      const res = await fetch(`/api/insurance/policies?id=${policyId}`, {
        method: "DELETE",
        credentials: "include",
      })
      if (!res.ok) {
        const error = await res.json().catch(() => ({}))
        toast.error(error.error || "Failed to delete policy")
      } else {
        toast.success("Policy removed")
        await load()
      }
    } catch {
      toast.error("Failed to delete policy")
    } finally {
      setDeletingPolicyId(null)
    }
  }

  const addPreauthorization = async () => {
    const payload = normalizePreauthPayload(preauthForm)
    if (!payload.payerId || !payload.requestedService) {
      toast.error("Select payer and describe the requested service")
      return
    }
    if (payload.status === "Approved" && !payload.authCode && !payload.requestReference) {
      toast.error("Approved authorization needs an auth code or request reference")
      return
    }
    if (payload.status === "Denied" && !payload.notes) {
      toast.error("Denied authorization should include outcome notes")
      return
    }

    setCreatingPreauth(true)
    try {
      const res = await fetch("/api/insurance/preauthorizations", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientId, ...payload }),
      })
      if (!res.ok) {
        const error = await res.json().catch(() => ({}))
        toast.error(error.error || "Failed to add authorization")
      } else {
        toast.success("Authorization record added")
        setPreauthForm(emptyPreauthForm())
        await load()
      }
    } catch {
      toast.error("Failed to add authorization")
    } finally {
      setCreatingPreauth(false)
    }
  }

  const savePreauthorization = async (preauthId: string) => {
    const draft = preauthDrafts[preauthId]
    if (!draft) return
    const payload = normalizePreauthPayload(draft)
    if (!payload.payerId || !payload.requestedService) {
      toast.error("Payer and requested service are required")
      return
    }
    if (payload.status === "Approved" && !payload.authCode && !payload.requestReference) {
      toast.error("Approved authorization needs an auth code or request reference")
      return
    }
    if (payload.status === "Denied" && !payload.notes) {
      toast.error("Denied authorization should include outcome notes")
      return
    }

    setSavingPreauthId(preauthId)
    try {
      const res = await fetch(`/api/insurance/preauthorizations?id=${preauthId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const error = await res.json().catch(() => ({}))
        toast.error(error.error || "Failed to save authorization")
      } else {
        toast.success("Authorization updated")
        await load()
      }
    } catch {
      toast.error("Failed to save authorization")
    } finally {
      setSavingPreauthId(null)
    }
  }

  const deletePreauthorization = async (preauthId: string) => {
    if (!window.confirm("Remove this authorization record?")) return
    setDeletingPreauthId(preauthId)
    try {
      const res = await fetch(`/api/insurance/preauthorizations?id=${preauthId}`, {
        method: "DELETE",
        credentials: "include",
      })
      if (!res.ok) {
        const error = await res.json().catch(() => ({}))
        toast.error(error.error || "Failed to delete authorization")
      } else {
        toast.success("Authorization removed")
        await load()
      }
    } catch {
      toast.error("Failed to delete authorization")
    } finally {
      setDeletingPreauthId(null)
    }
  }

  const addPayer = async () => {
    if (!newPayer.name.trim()) {
      toast.error("Enter payer name")
      return
    }
    setAddingPayer(true)
    try {
      const res = await fetch("/api/insurance/payers", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newPayer.name.trim(),
          payerCode: newPayer.payerCode.trim() || null,
          payerType: newPayer.payerType,
          requiresPreauthDefault: newPayer.requiresPreauthDefault,
          schemeStampRequired: newPayer.schemeStampRequired,
          panelDriven: newPayer.panelDriven,
          contactPhone: newPayer.contactPhone.trim() || null,
          contactEmail: newPayer.contactEmail.trim() || null,
          notes: newPayer.notes.trim() || null,
          active: newPayer.active,
        }),
      })
      if (!res.ok) {
        const error = await res.json().catch(() => ({}))
        toast.error(error.error || "Failed to add payer")
      } else {
        toast.success("Payer added")
        setNewPayer(emptyPayerForm())
        await load()
      }
    } catch {
      toast.error("Failed to add payer")
    } finally {
      setAddingPayer(false)
    }
  }

  return (
    <Card className="border-0 bg-transparent shadow-none">
      {!compact ? (
        <CardHeader className="px-0 pt-0">
          <CardTitle>Insurance</CardTitle>
          <CardDescription>
            Capture insurer, HMO, or corporate guarantee details the way Ugandan reception desks actually work: member identity, scheme ownership, panel check, eligibility verification, and service authorization.
          </CardDescription>
        </CardHeader>
      ) : null}
      <CardContent className="space-y-4 px-0 pb-0">
        {!compact && (missingVerificationCount > 0 || missingPreauthCount > 0) ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-4 text-sm">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="font-semibold text-foreground">Reception checklist</div>
                <div className="text-xs text-muted-foreground">
                  Resolve these before billing or restricted services so teams do not chase paperwork mid-visit.
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {missingVerificationCount > 0 ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      try {
                        const el = document.querySelector('[data-payer-name]') as HTMLElement | null
                        el?.scrollIntoView({ behavior: "smooth", block: "start" })
                      } catch {}
                    }}
                  >
                    Fix verification ({missingVerificationCount})
                  </Button>
                ) : null}
                {missingPreauthCount > 0 ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      try {
                        const el = document.querySelector('[data-preauth-id]') as HTMLElement | null
                        el?.scrollIntoView({ behavior: "smooth", block: "start" })
                      } catch {}
                    }}
                  >
                    Track authorizations ({missingPreauthCount})
                  </Button>
                ) : null}
                <Button
                  size="sm"
                  onClick={() => {
                    try {
                      window.dispatchEvent(new CustomEvent("insuranceJumpToDocuments", { detail: { patientId } }))
                    } catch {}
                  }}
                >
                  Open documents checklist
                </Button>
              </div>
            </div>
          </div>
        ) : null}

        {!compact ? (
          <>
            <div className="grid gap-3 md:grid-cols-4">
              <InsuranceHoverNote title="Active cover" description="Policies available for the current visit. Inactive records stay as history only.">
                <div className="rounded-lg border bg-slate-50/80 p-3">
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Active cover</div>
                  <div className="mt-2 text-2xl font-semibold text-slate-950">{activePolicies.length}</div>
                  <p className="text-xs text-muted-foreground">Policies currently available to reception and billing.</p>
                </div>
              </InsuranceHoverNote>
              <InsuranceHoverNote title="Verified cover" description="Cover already checked against a payer call, portal, email, or traceable eligibility source.">
                <div className="rounded-lg border bg-emerald-50/70 p-3">
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Verified</div>
                  <div className="mt-2 text-2xl font-semibold text-emerald-900">{verifiedPolicies.length}</div>
                  <p className="text-xs text-muted-foreground">Eligibility already confirmed by the payer or sponsor.</p>
                </div>
              </InsuranceHoverNote>
              <InsuranceHoverNote title="Verification gaps" description="Active policies that still need a proper eligibility check.">
                <div className="rounded-lg border bg-amber-50/70 p-3">
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">Needs verification</div>
                  <div className="mt-2 text-2xl font-semibold text-amber-900">{missingVerificationCount}</div>
                  <p className="text-xs text-muted-foreground">Clear these before the patient reaches billing or a restricted service.</p>
                </div>
              </InsuranceHoverNote>
              <InsuranceHoverNote title="Authorization tracker" description="Policies that require approval should be matched to an open or approved authorization record.">
                <div className="rounded-lg border bg-sky-50/70 p-3">
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">Auth follow-up</div>
                  <div className="mt-2 text-2xl font-semibold text-sky-900">{missingPreauthCount}</div>
                  <p className="text-xs text-muted-foreground">Policies that still need an authorization record attached.</p>
                </div>
              </InsuranceHoverNote>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              {ugandaWorkflowGuides.map((guide) => (
                <InsuranceHoverNote key={guide.title} title={guide.title} description={guide.description}>
                  <div className="rounded-lg border bg-white px-4 py-3">
                    <div className="text-sm font-semibold text-foreground">{guide.title}</div>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">{guide.description}</p>
                  </div>
                </InsuranceHoverNote>
              ))}
            </div>
          </>
        ) : null}

        {!hideIntake ? (
          <div className="rounded-lg border p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Add cover</h3>
                <p className="text-xs text-muted-foreground">
                  Record the payer, scheme, member identity, verification trail, and any pre-authorization requirement before the patient leaves reception.
                </p>
              </div>
              <Button onClick={addPolicy} disabled={creating || !payers.length}>
                {creating ? "Adding..." : "Add Policy"}
              </Button>
            </div>
            <PolicyEditor form={createForm} onChange={updateCreateForm} payerOptions={payers} idPrefix="insurance-create" />
          </div>
        ) : null}

        {!hideRecords ? (
          <Card className="flex h-full flex-col border-border/80 bg-card shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Policy records</CardTitle>
              <CardDescription>Expand a policy to update it, refine verification notes, or change authorization flags.</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 pt-0">
              {loading ? (
                <div className="grid min-h-[10rem] place-items-center text-sm text-muted-foreground">Loading coverage records...</div>
              ) : policies.length === 0 ? (
                <div className="grid min-h-[10rem] place-items-center text-sm text-muted-foreground">No policies recorded for this patient yet.</div>
              ) : (
                <Accordion type="single" collapsible className="px-4">
                  {policies.map((policy) => {
                    const draft = policyDrafts[policy.id] || toPolicyForm(policy)
                    const verificationStatus = isExpired(policy) ? "Expired" : policy.verification_status || "Unverified"
                    return (
                      <AccordionItem key={policy.id} value={policy.id} data-payer-name={policy.payer_name} data-policy-number={policy.policy_no}>
                        <AccordionTrigger className="hover:no-underline">
                          <div className="flex w-full flex-col gap-3 text-left md:flex-row md:items-start md:justify-between">
                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-base font-semibold text-foreground">{policy.payer_name}</span>
                                <InsuranceHoverNote
                                  title="Payer type"
                                  description={getInsurancePayerTypeDescription((policy.payer_type || "INSURER") as InsurancePayerType)}
                                >
                                  <Badge variant="outline">{getInsurancePayerTypeLabel(policy.payer_type || "INSURER")}</Badge>
                                </InsuranceHoverNote>
                                {policy.plan_name ? <span className="text-sm text-muted-foreground">{policy.plan_name}</span> : null}
                                {policy.scheme_name ? <span className="text-sm text-muted-foreground">| {policy.scheme_name}</span> : null}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                Policy {policy.policy_no}
                                {policy.member_id ? ` | Member ${policy.member_id}` : ""}
                                {policy.staff_number ? ` | Staff ${policy.staff_number}` : ""}
                              </div>
                              <div className="text-xs text-muted-foreground">{formatCoverageWindow(policy)}</div>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant={policy.active ? "default" : "secondary"}>{policy.active ? "Active" : "Inactive"}</Badge>
                              <Badge variant="outline">{formatCoverageOrder(policy.coordination_order || 1)}</Badge>
                              <InsuranceHoverNote title="Eligibility verification" description={getVerificationStatusDescription(verificationStatus as any)}>
                                <Badge variant="outline" className={verificationBadgeClass(verificationStatus)}>{verificationStatus}</Badge>
                              </InsuranceHoverNote>
                              <InsuranceHoverNote title="Provider panel status" description={getPanelStatusDescription((policy.panel_status || "Unknown") as any)}>
                                <Badge variant="outline">{policy.panel_status || "Unknown panel"}</Badge>
                              </InsuranceHoverNote>
                              {policy.authorization_required ? <Badge variant="secondary">Authorization required</Badge> : null}
                            </div>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="space-y-4">
                          <PolicyEditor
                            form={draft}
                            onChange={(field, value) => updatePolicyDraft(policy.id, field, value)}
                            payerOptions={payers}
                            idPrefix={`insurance-policy-${policy.id}`}
                          />
                          <div className="flex flex-col gap-2 rounded-lg border bg-muted/20 p-3 text-xs text-muted-foreground lg:flex-row lg:items-center lg:justify-between">
                            <div>
                              Last updated {policy.updated_at ? new Date(policy.updated_at).toLocaleString() : "-"}
                              {policy.verified_at ? ` | Verified ${new Date(policy.verified_at).toLocaleString()}` : ""}
                            </div>
                            <div className="flex items-center gap-2">
                              <Button size="sm" variant="outline" onClick={() => savePolicy(policy.id)} disabled={savingPolicyId === policy.id}>
                                {savingPolicyId === policy.id ? "Saving..." : "Save changes"}
                              </Button>
                              <Button size="sm" variant="destructive" onClick={() => deletePolicy(policy.id)} disabled={deletingPolicyId === policy.id}>
                                {deletingPolicyId === policy.id ? "Removing..." : "Remove"}
                              </Button>
                            </div>
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    )
                  })}
                </Accordion>
              )}
            </CardContent>
          </Card>
        ) : null}

        {!hideAuthorizations ? (
          <div className="space-y-4">
            <Card className="border-border/80 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-sm">Authorization tracker</CardTitle>
                    <CardDescription>
                      Log payer approvals for admission, scans, surgery, maternity, and other services that cannot proceed without clearance.
                    </CardDescription>
                  </div>
                  <Button onClick={addPreauthorization} disabled={creatingPreauth || !payers.length}>
                    {creatingPreauth ? "Adding..." : "Add Authorization"}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <PreauthorizationEditor
                  form={preauthForm}
                  onChange={updatePreauthForm}
                  payerOptions={payers}
                  policyOptions={policies}
                  idPrefix="insurance-preauth-create"
                />
              </CardContent>
            </Card>

            <Card className="border-border/80 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Pre-authorization records</CardTitle>
                <CardDescription>Track pending, approved, denied, and expired authorizations against the patient and payer.</CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                {loading ? (
                  <div className="text-sm text-muted-foreground">Loading authorization records...</div>
                ) : preauthorizations.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No authorization records for this patient yet.</div>
                ) : (
                  <ScrollArea className="h-[32rem]">
                    <Accordion type="single" collapsible className="px-4">
                      {preauthorizations.map((preauth) => {
                        const draft = preauthDrafts[preauth.id] || toPreauthForm(preauth)
                        return (
                          <AccordionItem key={preauth.id} value={preauth.id} data-preauth-id={preauth.id}>
                            <AccordionTrigger className="hover:no-underline">
                              <div className="flex w-full flex-col gap-3 text-left md:flex-row md:items-start md:justify-between">
                                <div className="space-y-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-base font-semibold text-foreground">{preauth.payer_name}</span>
                                    <span className="text-sm text-muted-foreground">{preauth.service_category || "Other"}</span>
                                  </div>
                                  <div className="text-sm text-muted-foreground">{preauth.requested_service || "Requested service not recorded"}</div>
                                  <div className="text-xs text-muted-foreground">{formatPreauthWindow(preauth)}</div>
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <Badge variant="outline" className={preauthBadgeClass(preauth.status)}>
                                    {preauth.status}
                                  </Badge>
                                  {preauth.policy_no ? <Badge variant="outline">Policy {preauth.policy_no}</Badge> : null}
                                  {preauth.auth_code ? <Badge variant="secondary">Code {preauth.auth_code}</Badge> : null}
                                </div>
                              </div>
                            </AccordionTrigger>
                            <AccordionContent className="space-y-4">
                              <PreauthorizationEditor
                                form={draft}
                                onChange={(field, value) => updatePreauthDraft(preauth.id, field, value)}
                                payerOptions={payers}
                                policyOptions={policies}
                                idPrefix={`insurance-preauth-${preauth.id}`}
                              />
                              <div className="flex flex-col gap-2 rounded-lg border bg-muted/20 p-3 text-xs text-muted-foreground lg:flex-row lg:items-center lg:justify-between">
                                <div>Last updated {preauth.updated_at ? new Date(preauth.updated_at).toLocaleString() : "-"}</div>
                                <div className="flex items-center gap-2">
                                  <Button size="sm" variant="outline" onClick={() => savePreauthorization(preauth.id)} disabled={savingPreauthId === preauth.id}>
                                    {savingPreauthId === preauth.id ? "Saving..." : "Save changes"}
                                  </Button>
                                  <Button size="sm" variant="destructive" onClick={() => deletePreauthorization(preauth.id)} disabled={deletingPreauthId === preauth.id}>
                                    {deletingPreauthId === preauth.id ? "Removing..." : "Remove"}
                                  </Button>
                                </div>
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        )
                      })}
                    </Accordion>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </div>
        ) : null}

        {!hideAddPayer ? (
          <Card className="border-border/80 bg-card shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Add new payer</CardTitle>
              <CardDescription>Only add a payer when the master list does not already cover the insurer, HMO, or sponsor handling the patient.</CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="space-y-2">
                <InsuranceFieldLabel htmlFor="insurance-payer-name" help="Official payer, HMO, employer, or sponsor name as it appears on the card or letter." required>
                  Payer name
                </InsuranceFieldLabel>
                <Input id="insurance-payer-name" name="insurancePayerName" value={newPayer.name} onChange={(event) => updateNewPayer("name", event.target.value)} placeholder="AAR, Jubilee, APA, employer guarantee" />
              </div>
              <div className="space-y-2">
                <InsuranceFieldLabel htmlFor="insurance-payer-code" help="Facility internal code or billing code for the payer.">
                  Payer code
                </InsuranceFieldLabel>
                <Input id="insurance-payer-code" name="insurancePayerCode" value={newPayer.payerCode} onChange={(event) => updateNewPayer("payerCode", event.target.value)} placeholder="Optional internal code" />
              </div>
              <div className="space-y-2">
                <InsuranceFieldLabel htmlFor="insurance-payer-type" help="Choose whether this payer is an insurer, HMO, corporate guarantor, government scheme, or broker.">
                  Payer type
                </InsuranceFieldLabel>
                <Select value={newPayer.payerType} onValueChange={(value: InsurancePayerType) => updateNewPayer("payerType", value)}>
                  <SelectTrigger id="insurance-payer-type" aria-label="Payer type" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INSURANCE_PAYER_TYPES.map((payerType) => (
                      <SelectItem key={payerType} value={payerType}>
                        {getInsurancePayerTypeLabel(payerType)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">{getInsurancePayerTypeDescription(newPayer.payerType)}</p>
              </div>
              <div className="space-y-2">
                <InsuranceFieldLabel htmlFor="insurance-payer-phone" help="Optional reception contact for payer verification calls or sponsor follow-up.">
                  Contact phone
                </InsuranceFieldLabel>
                <Input id="insurance-payer-phone" name="insurancePayerPhone" value={newPayer.contactPhone} onChange={(event) => updateNewPayer("contactPhone", event.target.value)} placeholder="+256..." />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <div className="space-y-2">
                <InsuranceFieldLabel htmlFor="insurance-payer-email" help="Optional email used for reimbursement packs, authorizations, or sponsor confirmations.">
                  Contact email
                </InsuranceFieldLabel>
                <Input id="insurance-payer-email" name="insurancePayerEmail" value={newPayer.contactEmail} onChange={(event) => updateNewPayer("contactEmail", event.target.value)} placeholder="claims@payer.ug" />
              </div>
              <div className="space-y-2 xl:col-span-2">
                <InsuranceFieldLabel htmlFor="insurance-payer-notes" help="Known workflow behavior, such as pre-authorization requirement, panel restriction, or scheme stamp expectation.">
                  Workflow notes
                </InsuranceFieldLabel>
                <Textarea id="insurance-payer-notes" name="insurancePayerNotes" rows={3} value={newPayer.notes} onChange={(event) => updateNewPayer("notes", event.target.value)} placeholder="Known payer behavior, workflow notes, or sponsor instructions." />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <InsuranceHoverNote title="Pre-authorization by default" description="Turn this on for payers that normally require approval for admission, surgery, scans, maternity, or other restricted services.">
                <div className="flex items-start justify-between rounded-lg border p-3">
                  <div>
                    <div className="text-sm font-semibold text-foreground">Pre-authorization by default</div>
                    <p className="text-xs text-muted-foreground">Turn this on when the payer commonly needs prior approval for major services.</p>
                  </div>
                  <Switch checked={newPayer.requiresPreauthDefault} onCheckedChange={(value) => updateNewPayer("requiresPreauthDefault", value)} />
                </div>
              </InsuranceHoverNote>
              <InsuranceHoverNote title="Scheme or HR stamp" description="Use this for employer or sponsor workflows where the guarantee must be endorsed by HR, scheme administration, or finance before billing is safe.">
                <div className="flex items-start justify-between rounded-lg border p-3">
                  <div>
                    <div className="text-sm font-semibold text-foreground">Scheme / HR stamp usually required</div>
                    <p className="text-xs text-muted-foreground">Useful for corporate guarantees and some reimbursement workflows.</p>
                  </div>
                  <Switch checked={newPayer.schemeStampRequired} onCheckedChange={(value) => updateNewPayer("schemeStampRequired", value)} />
                </div>
              </InsuranceHoverNote>
              <InsuranceHoverNote title="Panel-driven cover" description="Use this when facility network status matters and reception must check whether the patient is allowed to use this provider or service line.">
                <div className="flex items-start justify-between rounded-lg border p-3">
                  <div>
                    <div className="text-sm font-semibold text-foreground">Panel-driven cover</div>
                    <p className="text-xs text-muted-foreground">Use this for HMOs and managed-care payers where facility network status matters.</p>
                  </div>
                  <Switch checked={newPayer.panelDriven} onCheckedChange={(value) => updateNewPayer("panelDriven", value)} />
                </div>
              </InsuranceHoverNote>
            </div>

            <div className="flex justify-end">
              <Button onClick={addPayer} disabled={addingPayer}>
                {addingPayer ? "Adding..." : "Add Payer"}
              </Button>
            </div>
              </div>
            </CardContent>
          </Card>
        ) : null}
      </CardContent>
    </Card>
  )
}

export function InsuranceAuthorizations({
  patientId,
  hideTracker,
  hideRecords,
}: {
  patientId: string
  hideTracker?: boolean
  hideRecords?: boolean
}) {
  const [payers, setPayers] = useState<Payer[]>([])
  const [policies, setPolicies] = useState<Policy[]>([])
  const [preauthorizations, setPreauthorizations] = useState<Preauthorization[]>([])
  const [preauthForm, setPreauthForm] = useState<PreauthFormState>(emptyPreauthForm())
  const [preauthDrafts, setPreauthDrafts] = useState<Record<string, PreauthFormState>>({})
  const [loading, setLoading] = useState(false)
  const [creatingPreauth, setCreatingPreauth] = useState(false)
  const [savingPreauthId, setSavingPreauthId] = useState<string | null>(null)
  const [deletingPreauthId, setDeletingPreauthId] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const [payersRes, policiesRes, preauthRes] = await Promise.all([
        fetch("/api/insurance/payers", { credentials: "include" }),
        fetch(`/api/insurance/policies?patientId=${patientId}`, { credentials: "include" }),
        fetch(`/api/insurance/preauthorizations?patientId=${patientId}`, { credentials: "include" }),
      ])

      if (payersRes.ok) setPayers((await payersRes.json()).payers || [])
      if (policiesRes.ok) setPolicies((await policiesRes.json()).policies || [])
      if (preauthRes.ok) {
        const next = (await preauthRes.json()).preauthorizations || []
        setPreauthorizations(next)
        const nextDrafts: Record<string, PreauthFormState> = {}
        next.forEach((preauth: Preauthorization) => {
          nextDrafts[preauth.id] = toPreauthForm(preauth)
        })
        setPreauthDrafts(nextDrafts)
      }
    } catch {
      // Silent load failure; the current state remains visible.
    } finally {
      setLoading(false)
    }
  }, [patientId])

  useEffect(() => {
    void load()
  }, [load])

  const updatePreauthForm = (field: keyof PreauthFormState, value: string) => {
    setPreauthForm((current) => ({
      ...current,
      [field]: value,
    }))
  }

  const updatePreauthDraft = (preauthId: string, field: keyof PreauthFormState, value: string) => {
    setPreauthDrafts((current) => ({
      ...current,
      [preauthId]: {
        ...(current[preauthId] || emptyPreauthForm()),
        [field]: value,
      },
    }))
  }

  const addPreauthorization = async () => {
    const payload = normalizePreauthPayload(preauthForm)
    setCreatingPreauth(true)
    try {
      const res = await fetch("/api/insurance/preauthorizations", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientId, ...payload }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error || "Failed to add authorization")
        return
      }
      toast.success("Authorization created")
      setPreauthForm(emptyPreauthForm())
      await load()
    } catch (e: any) {
      toast.error(e?.message || "Failed to add authorization")
    } finally {
      setCreatingPreauth(false)
    }
  }

  const savePreauthorization = async (preauthId: string) => {
    const draft = preauthDrafts[preauthId]
    if (!draft) return
    const payload = normalizePreauthPayload(draft)
    setSavingPreauthId(preauthId)
    try {
      const res = await fetch(`/api/insurance/preauthorizations?id=${encodeURIComponent(preauthId)}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error || "Failed to save authorization")
        return
      }
      toast.success("Authorization updated")
    } catch (e: any) {
      toast.error(e?.message || "Failed to save authorization")
    } finally {
      setSavingPreauthId(null)
    }
  }

  const deletePreauthorization = async (preauthId: string) => {
    setDeletingPreauthId(preauthId)
    try {
      const res = await fetch(`/api/insurance/preauthorizations?id=${encodeURIComponent(preauthId)}`, {
        method: "DELETE",
        credentials: "include",
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error || "Failed to remove authorization")
        return
      }
      toast.success("Authorization removed")
      setPreauthorizations((prev) => prev.filter((p) => p.id !== preauthId))
      setPreauthDrafts((prev) => {
        const next = { ...prev }
        delete next[preauthId]
        return next
      })
    } catch (e: any) {
      toast.error(e?.message || "Failed to remove authorization")
    } finally {
      setDeletingPreauthId(null)
    }
  }

  return (
    <div className="space-y-4">
      {!hideTracker ? (
        <Card className="border-border/80 bg-card shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="text-sm">Authorization tracker</CardTitle>
                <CardDescription>
                  Log payer approvals for admission, scans, surgery, maternity, and other services that cannot proceed without clearance.
                </CardDescription>
              </div>
              <Button onClick={addPreauthorization} disabled={creatingPreauth || !payers.length}>
                {creatingPreauth ? "Adding..." : "Add Authorization"}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <PreauthorizationEditor
              form={preauthForm}
              onChange={updatePreauthForm}
              payerOptions={payers}
              policyOptions={policies}
              idPrefix="insurance-preauth-create"
            />
          </CardContent>
        </Card>
      ) : null}

      {!hideRecords ? (
        <Card className="flex h-full flex-col border-border/80 bg-card shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Pre-authorization records</CardTitle>
            <CardDescription>Track pending, approved, denied, and expired authorizations against the patient and payer.</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 pt-0">
            {loading ? (
              <div className="grid min-h-[10rem] place-items-center text-sm text-muted-foreground">Loading authorization records...</div>
            ) : preauthorizations.length === 0 ? (
              <div className="grid min-h-[10rem] place-items-center text-sm text-muted-foreground">No authorization records for this patient yet.</div>
            ) : (
              <Accordion type="single" collapsible className="px-4">
                {preauthorizations.map((preauth) => {
                  const draft = preauthDrafts[preauth.id] || toPreauthForm(preauth)
                  return (
                    <AccordionItem key={preauth.id} value={preauth.id} data-preauth-id={preauth.id}>
                      <AccordionTrigger className="hover:no-underline">
                        <div className="flex w-full flex-col gap-3 text-left md:flex-row md:items-start md:justify-between">
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-base font-semibold text-foreground">{preauth.payer_name}</span>
                              <span className="text-sm text-muted-foreground">{preauth.service_category || "Other"}</span>
                            </div>
                            <div className="text-sm text-muted-foreground">{preauth.requested_service || "Requested service not recorded"}</div>
                            <div className="text-xs text-muted-foreground">{formatPreauthWindow(preauth)}</div>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline" className={preauthBadgeClass(preauth.status)}>
                              {preauth.status}
                            </Badge>
                            {preauth.policy_no ? <Badge variant="outline">Policy {preauth.policy_no}</Badge> : null}
                            {preauth.auth_code ? <Badge variant="secondary">Code {preauth.auth_code}</Badge> : null}
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="space-y-4">
                        <PreauthorizationEditor
                          form={draft}
                          onChange={(field, value) => updatePreauthDraft(preauth.id, field, value)}
                          payerOptions={payers}
                          policyOptions={policies}
                          idPrefix={`insurance-preauth-${preauth.id}`}
                        />
                        <div className="flex flex-col gap-2 rounded-lg border bg-muted/20 p-3 text-xs text-muted-foreground lg:flex-row lg:items-center lg:justify-between">
                          <div>Last updated {preauth.updated_at ? new Date(preauth.updated_at).toLocaleString() : "-"}</div>
                          <div className="flex items-center gap-2">
                            <Button size="sm" variant="outline" onClick={() => savePreauthorization(preauth.id)} disabled={savingPreauthId === preauth.id}>
                              {savingPreauthId === preauth.id ? "Saving..." : "Save changes"}
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => deletePreauthorization(preauth.id)} disabled={deletingPreauthId === preauth.id}>
                              {deletingPreauthId === preauth.id ? "Removing..." : "Remove"}
                            </Button>
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  )
                })}
              </Accordion>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
