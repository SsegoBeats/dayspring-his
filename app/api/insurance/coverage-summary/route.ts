import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifyToken, can } from "@/lib/security"
import { queryWithSession } from "@/lib/db"
import { PATIENT_DOCUMENT_TYPES, type PatientDocumentType } from "@/lib/insurance"

function isExpired(expiryDate?: string | null) {
  if (!expiryDate) return false
  return new Date(expiryDate).getTime() < new Date(new Date().toDateString()).getTime()
}

async function requireAuth() {
  const cookieStore = await cookies()
  const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
  return token ? verifyToken(token) : null
}

export async function GET(req: Request) {
  const auth = await requireAuth()
  if (!auth || !can(auth.role, "insurance", "read")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const url = new URL(req.url)
  const patientId = url.searchParams.get("patientId")
  if (!patientId) return NextResponse.json({ error: "patientId required" }, { status: 400 })

  // Policies (with payer workflow flags)
  const { rows: policyRows } = await queryWithSession<any>(
    { role: auth.role, userId: auth.userId },
    `SELECT pol.id,
            pol.patient_id,
            pol.policy_no,
            pol.member_id,
            pol.group_no,
            pol.plan_name,
            pol.scheme_name,
            pol.employer_name,
            pol.staff_number,
            pol.subscriber_name,
            pol.subscriber_relationship,
            pol.coordination_order,
            pol.panel_status,
            pol.effective_date,
            pol.expiry_date,
            pol.coverage_notes,
            pol.verification_status,
            pol.verification_reference,
            pol.verification_notes,
            pol.verified_at,
            pol.authorization_required,
            pol.authorization_reference,
            pol.active,
            pol.updated_at,
            pay.id AS payer_id,
            pay.name AS payer_name,
            pay.payer_code,
            pay.payer_type,
            pay.requires_preauth_default,
            pay.scheme_stamp_required,
            pay.panel_driven,
            pay.notes AS payer_notes
       FROM insurance_policies pol
       JOIN insurance_payers pay ON pay.id = pol.payer_id
      WHERE pol.patient_id = $1
      ORDER BY COALESCE(pol.coordination_order, 1) ASC, pol.active DESC, pay.name ASC`,
    [patientId],
  )

  const policies = policyRows || []
  const activePolicies = policies.filter((p: any) => !!p.active)
  const primaryPolicy =
    activePolicies.find((p: any) => (p.coordination_order || 1) === 1) ?? activePolicies[0] ?? null

  const verifiedPolicies = activePolicies.filter((p: any) => {
    const status = isExpired(p.expiry_date) ? "Expired" : (p.verification_status || "Unverified")
    return status === "Verified"
  })

  const policiesNeedingVerification = activePolicies.filter((p: any) => {
    const status = isExpired(p.expiry_date) ? "Expired" : (p.verification_status || "Unverified")
    return status !== "Verified"
  })

  // Preauth records
  const { rows: preauthRows } = await queryWithSession<any>(
    { role: auth.role, userId: auth.userId },
    `SELECT pa.id,
            pa.patient_id,
            pa.payer_id,
            pa.policy_id,
            pa.status,
            pa.auth_code,
            pa.request_reference,
            pa.service_category,
            pa.requested_service,
            pa.response_due_at,
            pa.valid_until,
            pa.updated_at,
            pay.name AS payer_name,
            pol.policy_no
       FROM preauthorizations pa
       JOIN insurance_payers pay ON pay.id = pa.payer_id
       LEFT JOIN insurance_policies pol ON pol.id = pa.policy_id
      WHERE pa.patient_id = $1
      ORDER BY pa.updated_at DESC, pa.created_at DESC`,
    [patientId],
  )
  const preauthorizations = preauthRows || []
  const openPreauths = preauthorizations.filter((p: any) => p.status === "Pending" || p.status === "Approved")
  const approvedPreauths = preauthorizations.filter((p: any) => p.status === "Approved")
  const policyIdsWithOpenPreauth = new Set(openPreauths.map((p: any) => p.policy_id).filter(Boolean))

  const policiesNeedingAuth = activePolicies.filter((p: any) => !!p.authorization_required || !!p.requires_preauth_default)
  const policiesMissingPreauth = policiesNeedingAuth.filter((p: any) => !policyIdsWithOpenPreauth.has(p.id))

  // Documents by type
  const { rows: docRows } = await queryWithSession<any>(
    { role: auth.role, userId: auth.userId },
    `SELECT id, type FROM documents WHERE patient_id = $1`,
    [patientId],
  )
  const presentTypes = new Set<string>((docRows || []).map((d: any) => String(d.type)))
  const hasType = (t: PatientDocumentType) => presentTypes.has(t)

  // Required document types derived from cover + preauth readiness.
  // Keep in sync with patient documents UI.
  const hasInsuranceCover = activePolicies.some((p: any) => String(p.payer_type || "").toUpperCase() !== "CORPORATE")
  const needsGuarantee = activePolicies.some(
    (p: any) => String(p.payer_type || "").toUpperCase() === "CORPORATE" || !!p.employer_name || !!p.scheme_stamp_required,
  )
  const needsPreauthPaper = approvedPreauths.length > 0 || policiesNeedingAuth.length > 0
  const requiredDocumentTypes: PatientDocumentType[] = []
  if (activePolicies.length > 0) requiredDocumentTypes.push("ID")
  if (hasInsuranceCover) requiredDocumentTypes.push("INSURANCE")
  if (needsGuarantee) requiredDocumentTypes.push("GUARANTEE")
  if (needsPreauthPaper) requiredDocumentTypes.push("PREAUTH")

  const missingRequiredDocumentTypes = requiredDocumentTypes.filter((t) => !hasType(t))

  // Sanity: keep within supported enum list (defense)
  const safeMissing = missingRequiredDocumentTypes.filter((t) => (PATIENT_DOCUMENT_TYPES as readonly string[]).includes(t))

  return NextResponse.json({
    patientId,
    summary: {
      policies: {
        total: policies.length,
        active: activePolicies.length,
        verifiedActive: verifiedPolicies.length,
        needsVerificationCount: policiesNeedingVerification.length,
        needsAuthorizationCount: policiesNeedingAuth.length,
        missingPreauthCount: policiesMissingPreauth.length,
      },
      preauthorizations: {
        total: preauthorizations.length,
        open: openPreauths.length,
        approved: approvedPreauths.length,
      },
      documents: {
        requiredTypes: requiredDocumentTypes,
        missingRequiredTypes: safeMissing,
      },
      readiness: {
        hasActivePolicy: activePolicies.length > 0,
        hasVerifiedPolicy: verifiedPolicies.length > 0,
        missingVerification: policiesNeedingVerification.length > 0,
        missingPreauth: policiesMissingPreauth.length > 0,
        missingDocuments: safeMissing.length > 0,
        readyForRestrictedServices:
          activePolicies.length === 0
            ? true
            : policiesNeedingVerification.length === 0 && policiesMissingPreauth.length === 0 && safeMissing.length === 0,
      },
    },
    primaryPolicy,
    policies,
    preauthorizations,
    documents: {
      presentTypes: Array.from(presentTypes),
    },
  })
}

