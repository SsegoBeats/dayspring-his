"use client"

import { useCallback, useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import {
  formatCoverageOrder,
  INSURANCE_SUBSCRIBER_RELATIONSHIPS,
  INSURANCE_VERIFICATION_STATUSES,
  type InsuranceSubscriberRelationship,
  type InsuranceVerificationStatus,
} from "@/lib/insurance"

type Payer = { id: string; name: string; payer_code?: string | null }

type Policy = {
  id: string
  payer_id: string
  payer_name: string
  policy_no: string
  member_id?: string | null
  group_no?: string | null
  plan_name?: string | null
  subscriber_name?: string | null
  subscriber_relationship?: InsuranceSubscriberRelationship | null
  coordination_order?: number | null
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
  payer_code?: string | null
  updated_at?: string | null
}

type PolicyFormState = {
  payerId: string
  policyNo: string
  memberId: string
  groupNo: string
  planName: string
  subscriberName: string
  subscriberRelationship: InsuranceSubscriberRelationship | ""
  coordinationOrder: string
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

const emptyPolicyForm = (): PolicyFormState => ({
  payerId: "",
  policyNo: "",
  memberId: "",
  groupNo: "",
  planName: "",
  subscriberName: "",
  subscriberRelationship: "",
  coordinationOrder: "1",
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

function toPolicyForm(policy: Policy): PolicyFormState {
  return {
    payerId: policy.payer_id,
    policyNo: policy.policy_no,
    memberId: policy.member_id || "",
    groupNo: policy.group_no || "",
    planName: policy.plan_name || "",
    subscriberName: policy.subscriber_name || "",
    subscriberRelationship: policy.subscriber_relationship || "",
    coordinationOrder: String(policy.coordination_order || 1),
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

function normalizePolicyPayload(form: PolicyFormState) {
  return {
    payerId: form.payerId,
    policyNo: form.policyNo.trim(),
    memberId: form.memberId.trim() || null,
    groupNo: form.groupNo.trim() || null,
    planName: form.planName.trim() || null,
    subscriberName: form.subscriberName.trim() || null,
    subscriberRelationship: form.subscriberRelationship || null,
    coordinationOrder: Number(form.coordinationOrder || 1),
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
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-payer`}>Payer</Label>
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
          <Label htmlFor={`${idPrefix}-plan-name`}>Plan name</Label>
          <Input
            id={`${idPrefix}-plan-name`}
            name={`${idPrefix}-planName`}
            value={form.planName}
            onChange={(event) => onChange("planName", event.target.value)}
            placeholder="Standard, corporate, HMO plan"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-policy-number`}>Policy number</Label>
          <Input
            id={`${idPrefix}-policy-number`}
            name={`${idPrefix}-policyNo`}
            value={form.policyNo}
            onChange={(event) => onChange("policyNo", event.target.value)}
            placeholder="Policy or card number"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-coverage-order`}>Coverage order</Label>
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
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-member-id`}>Member ID</Label>
          <Input
            id={`${idPrefix}-member-id`}
            name={`${idPrefix}-memberId`}
            value={form.memberId}
            onChange={(event) => onChange("memberId", event.target.value)}
            placeholder="Subscriber or member identifier"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-group-number`}>Group number</Label>
          <Input
            id={`${idPrefix}-group-number`}
            name={`${idPrefix}-groupNo`}
            value={form.groupNo}
            onChange={(event) => onChange("groupNo", event.target.value)}
            placeholder="Employer or group number"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-subscriber-name`}>Subscriber name</Label>
          <Input
            id={`${idPrefix}-subscriber-name`}
            name={`${idPrefix}-subscriberName`}
            value={form.subscriberName}
            onChange={(event) => onChange("subscriberName", event.target.value)}
            placeholder="Leave blank if patient is self"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-relationship`}>Relationship to subscriber</Label>
          <Select
            value={form.subscriberRelationship || "__empty__"}
            onValueChange={(value) => onChange("subscriberRelationship", value === "__empty__" ? "" : value)}
          >
            <SelectTrigger id={`${idPrefix}-relationship`} aria-label="Relationship to subscriber" className="w-full">
              <SelectValue placeholder="Select relationship" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__empty__">Not recorded</SelectItem>
              {INSURANCE_SUBSCRIBER_RELATIONSHIPS.map((relationship) => (
                <SelectItem key={relationship} value={relationship}>
                  {relationship}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-effective-date`}>Effective date</Label>
          <Input
            id={`${idPrefix}-effective-date`}
            name={`${idPrefix}-effectiveDate`}
            type="date"
            value={form.effectiveDate}
            onChange={(event) => onChange("effectiveDate", event.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-expiry-date`}>Expiry date</Label>
          <Input
            id={`${idPrefix}-expiry-date`}
            name={`${idPrefix}-expiryDate`}
            type="date"
            value={form.expiryDate}
            onChange={(event) => onChange("expiryDate", event.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-verification-status`}>Eligibility verification</Label>
          <Select
            value={form.verificationStatus}
            onValueChange={(value: InsuranceVerificationStatus) => onChange("verificationStatus", value)}
          >
            <SelectTrigger
              id={`${idPrefix}-verification-status`}
              aria-label="Eligibility verification"
              className="w-full"
            >
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
        </div>

        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-verification-reference`}>Verification reference</Label>
          <Input
            id={`${idPrefix}-verification-reference`}
            name={`${idPrefix}-verificationReference`}
            value={form.verificationReference}
            onChange={(event) => onChange("verificationReference", event.target.value)}
            placeholder="Call ref, portal trace, or ticket"
          />
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_1fr_220px]">
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-coverage-notes`}>Coverage notes</Label>
          <Textarea
            id={`${idPrefix}-coverage-notes`}
            name={`${idPrefix}-coverageNotes`}
            rows={3}
            value={form.coverageNotes}
            onChange={(event) => onChange("coverageNotes", event.target.value)}
            placeholder="Benefits, exclusions, copay instructions, or front-desk remarks."
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-verification-notes`}>Verification notes</Label>
          <Textarea
            id={`${idPrefix}-verification-notes`}
            name={`${idPrefix}-verificationNotes`}
            rows={3}
            value={form.verificationNotes}
            onChange={(event) => onChange("verificationNotes", event.target.value)}
            placeholder="What was checked, who confirmed it, and any restrictions."
          />
        </div>

        <div className="rounded-lg border p-3">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <Label htmlFor={`${idPrefix}-active`} className="text-sm font-semibold">
                  Active policy
                </Label>
                <p className="text-xs text-muted-foreground">Inactive cover stays in history but is excluded from front-desk use.</p>
              </div>
              <Switch
                id={`${idPrefix}-active`}
                checked={form.active}
                onCheckedChange={(value) => onChange("active", value)}
                aria-label="Active policy"
              />
            </div>

            <div className="flex items-center justify-between gap-3">
              <div>
                <Label htmlFor={`${idPrefix}-authorization-required`} className="text-sm font-semibold">
                  Authorization required
                </Label>
                <p className="text-xs text-muted-foreground">Flag cover that needs pre-approval before service.</p>
              </div>
              <Switch
                id={`${idPrefix}-authorization-required`}
                checked={form.authorizationRequired}
                onCheckedChange={(value) => onChange("authorizationRequired", value)}
                aria-label="Authorization required"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor={`${idPrefix}-authorization-reference`}>Authorization reference</Label>
              <Input
                id={`${idPrefix}-authorization-reference`}
                name={`${idPrefix}-authorizationReference`}
                value={form.authorizationReference}
                onChange={(event) => onChange("authorizationReference", event.target.value)}
                placeholder="Pre-auth code or note"
                disabled={!form.authorizationRequired}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function InsurancePolicies({ patientId }: { patientId: string }) {
  const [payers, setPayers] = useState<Payer[]>([])
  const [policies, setPolicies] = useState<Policy[]>([])
  const [createForm, setCreateForm] = useState<PolicyFormState>(emptyPolicyForm())
  const [policyDrafts, setPolicyDrafts] = useState<Record<string, PolicyFormState>>({})
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [addingPayer, setAddingPayer] = useState(false)
  const [newPayerName, setNewPayerName] = useState("")
  const [newPayerCode, setNewPayerCode] = useState("")
  const [savingPolicyId, setSavingPolicyId] = useState<string | null>(null)
  const [deletingPolicyId, setDeletingPolicyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const [payersRes, policiesRes] = await Promise.all([
        fetch("/api/insurance/payers", { credentials: "include" }),
        fetch(`/api/insurance/policies?patientId=${patientId}`, { credentials: "include" }),
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
    } catch {
      // Silent load failure; the current state remains visible.
    } finally {
      setLoading(false)
    }
  }, [patientId])

  useEffect(() => {
    void load()
  }, [load])

  const updateCreateForm = (field: keyof PolicyFormState, value: string | boolean) => {
    setCreateForm((current) => ({ ...current, [field]: value }))
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

  const addPolicy = async () => {
    const payload = normalizePolicyPayload(createForm)
    if (!payload.payerId || !payload.policyNo) {
      toast.error("Select payer and enter a policy number")
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
        toast.success("Policy added")
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

  const addPayer = async () => {
    if (!newPayerName.trim()) {
      toast.error("Enter payer name")
      return
    }
    setAddingPayer(true)
    try {
      const res = await fetch("/api/insurance/payers", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newPayerName.trim(), payerCode: newPayerCode.trim() || null }),
      })
      if (!res.ok) {
        const error = await res.json().catch(() => ({}))
        toast.error(error.error || "Failed to add payer")
      } else {
        toast.success("Payer added")
        setNewPayerName("")
        setNewPayerCode("")
        await load()
      }
    } catch {
      toast.error("Failed to add payer")
    } finally {
      setAddingPayer(false)
    }
  }

  const activePolicies = policies.filter((policy) => policy.active)
  const verifiedPolicies = policies.filter((policy) => policy.verification_status === "Verified")
  const authorizationPolicies = policies.filter((policy) => !!policy.authorization_required)

  return (
    <Card className="border-0 shadow-none">
      <CardHeader className="px-0 pt-0">
        <CardTitle>Insurance</CardTitle>
        <CardDescription>
          Capture payer, subscriber, eligibility, and authorization details before the patient reaches billing or triage.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 px-0 pb-0">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border bg-slate-50/80 p-3">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Active cover</div>
            <div className="mt-2 text-2xl font-semibold text-slate-950">{activePolicies.length}</div>
            <p className="text-xs text-muted-foreground">Policies currently available for registration and billing.</p>
          </div>
          <div className="rounded-lg border bg-emerald-50/70 p-3">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Verified</div>
            <div className="mt-2 text-2xl font-semibold text-emerald-900">{verifiedPolicies.length}</div>
            <p className="text-xs text-muted-foreground">Coverage records already checked against payer data.</p>
          </div>
          <div className="rounded-lg border bg-amber-50/70 p-3">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">Auth required</div>
            <div className="mt-2 text-2xl font-semibold text-amber-900">{authorizationPolicies.length}</div>
            <p className="text-xs text-muted-foreground">Policies flagged for prior approval before service is rendered.</p>
          </div>
        </div>

        <div className="rounded-lg border p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Add coverage</h3>
              <p className="text-xs text-muted-foreground">
                Record the payer, card details, subscriber relationship, eligibility status, and any authorization note.
              </p>
            </div>
            <Button onClick={addPolicy} disabled={creating || !payers.length}>
              {creating ? "Adding..." : "Add Policy"}
            </Button>
          </div>
          <PolicyEditor form={createForm} onChange={updateCreateForm} payerOptions={payers} idPrefix="insurance-create" />
        </div>

        <div className="rounded-lg border">
          {loading ? (
            <div className="p-4 text-sm text-muted-foreground">Loading coverage records...</div>
          ) : policies.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground">No policies recorded for this patient yet.</div>
          ) : (
            <ScrollArea className="h-[28rem]">
              <Accordion type="single" collapsible className="px-4">
                {policies.map((policy) => {
                  const draft = policyDrafts[policy.id] || toPolicyForm(policy)
                  const expired = isExpired(policy)
                  const verificationStatus = expired ? "Expired" : policy.verification_status || "Unverified"
                  return (
                    <AccordionItem
                      key={policy.id}
                      value={policy.id}
                      data-payer-name={policy.payer_name}
                      data-policy-number={policy.policy_no}
                    >
                      <AccordionTrigger className="hover:no-underline">
                        <div className="flex w-full flex-col gap-3 text-left md:flex-row md:items-start md:justify-between">
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-base font-semibold text-foreground">{policy.payer_name}</span>
                              {policy.plan_name ? <span className="text-sm text-muted-foreground">{policy.plan_name}</span> : null}
                              {policy.payer_code ? (
                                <span className="text-xs text-muted-foreground">Code {policy.payer_code}</span>
                              ) : null}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              Policy {policy.policy_no}
                              {policy.member_id ? ` • Member ${policy.member_id}` : ""}
                              {policy.group_no ? ` • Group ${policy.group_no}` : ""}
                            </div>
                            <div className="text-xs text-muted-foreground">{formatCoverageWindow(policy)}</div>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant={policy.active ? "default" : "secondary"}>
                              {policy.active ? "Active" : "Inactive"}
                            </Badge>
                            <Badge variant="outline">{formatCoverageOrder(policy.coordination_order || 1)}</Badge>
                            <Badge variant="outline" className={verificationBadgeClass(verificationStatus)}>
                              {verificationStatus}
                            </Badge>
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
                            {policy.verified_at ? ` • Verified ${new Date(policy.verified_at).toLocaleString()}` : ""}
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => savePolicy(policy.id)}
                              disabled={savingPolicyId === policy.id}
                            >
                              {savingPolicyId === policy.id ? "Saving..." : "Save changes"}
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => deletePolicy(policy.id)}
                              disabled={deletingPolicyId === policy.id}
                            >
                              {deletingPolicyId === policy.id ? "Removing..." : "Remove"}
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
        </div>

        <div className="rounded-lg border p-4">
          <div className="mb-3">
            <h3 className="text-sm font-semibold text-foreground">Add new payer</h3>
            <p className="text-xs text-muted-foreground">Use this when reception needs to register a payer that is not yet in the master list.</p>
          </div>
          <div className="grid gap-3 md:grid-cols-[1fr_220px_auto]">
            <div className="space-y-2">
              <Label htmlFor="insurance-payer-name">Payer name</Label>
              <Input
                id="insurance-payer-name"
                name="insurancePayerName"
                placeholder="AAR, Jubilee, NHIF, corporate scheme"
                value={newPayerName}
                onChange={(event) => setNewPayerName(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="insurance-payer-code">Payer code</Label>
              <Input
                id="insurance-payer-code"
                name="insurancePayerCode"
                placeholder="Optional internal code"
                value={newPayerCode}
                onChange={(event) => setNewPayerCode(event.target.value)}
              />
            </div>
            <div className="flex items-end">
              <Button onClick={addPayer} disabled={addingPayer} className="w-full">
                {addingPayer ? "Adding..." : "Add Payer"}
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
