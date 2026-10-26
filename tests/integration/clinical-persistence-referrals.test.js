const assert = require("node:assert/strict")
const bcrypt = require("bcryptjs")
const { Client } = require("pg")

function randomSuffix() {
  return `${Date.now()}-${Math.floor(Math.random() * 100000)}`
}

function extractCookieHeader(setCookieHeaders) {
  return setCookieHeaders
    .flatMap((value) => String(value).split(/,(?=\s*[^;]+=)/g))
    .map((cookie) => cookie.split(";")[0])
    .filter(Boolean)
    .join("; ")
}

function getSetCookies(res) {
  return typeof res.headers.getSetCookie === "function"
    ? res.headers.getSetCookie()
    : [res.headers.get("set-cookie")].filter(Boolean)
}

async function loginWithCsrf({ baseUrl, email, password, role }) {
  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": `127.0.0.${Math.floor(Math.random() * 200) + 10}`,
    },
    body: JSON.stringify({ email, password, role }),
  })
  const loginJson = await loginRes.json().catch(() => ({}))
  assert.equal(loginRes.status, 200, `Login failed for ${email}: ${JSON.stringify(loginJson)}`)

  const authCookies = extractCookieHeader(getSetCookies(loginRes))
  assert.ok(authCookies.includes("session="), `Expected session cookie for ${email}`)

  const csrfRes = await fetch(`${baseUrl}/api/csrf`, {
    headers: { Cookie: authCookies },
  })
  const csrfJson = await csrfRes.json().catch(() => ({}))
  assert.equal(csrfRes.status, 200, `CSRF handshake failed for ${email}: ${JSON.stringify(csrfJson)}`)

  const csrfCookies = extractCookieHeader(getSetCookies(csrfRes))
  const csrfToken = csrfJson.csrfToken || csrfJson.token
  assert.ok(csrfToken, `Expected csrf token for ${email}`)

  return {
    cookieHeader: [authCookies, csrfCookies].filter(Boolean).join("; "),
    csrfToken,
  }
}

async function run() {
  const baseUrl = process.env.TEST_BASE_URL || "http://localhost:3000"
  const connectionString = process.env.INTEGRATION_DATABASE_URL
  if (!connectionString) {
    console.log("INTEGRATION_DATABASE_URL not set - skipping clinical persistence/referrals integration test")
    return
  }

  const db = new Client({ connectionString })
  await db.connect()

  const createdUsers = []
  const createdPatients = []
  const createdReferrals = []
  const createdMedicalRecords = []
  const createdProcedures = []

  try {
    const suffix = randomSuffix()
    const clinicianEmail = `clinician.integration.${suffix}@dayspring.local`
    const nurseEmail = `nurse.integration.${suffix}@dayspring.local`
    const password = "Admin2025"
    const passwordHash = await bcrypt.hash(password, 10)

    const clinicianInsert = await db.query(
      `INSERT INTO users (email, password_hash, name, role, department, is_active)
       VALUES ($1, $2, $3, $4, $5, true)
       RETURNING id`,
      [clinicianEmail, passwordHash, `Clinician Integration ${suffix}`, "Clinician", "Clinician"],
    )
    const clinicianId = clinicianInsert.rows[0].id
    createdUsers.push(clinicianId)

    const nurseInsert = await db.query(
      `INSERT INTO users (email, password_hash, name, role, department, is_active)
       VALUES ($1, $2, $3, $4, $5, true)
       RETURNING id`,
      [nurseEmail, passwordHash, `Nurse Integration ${suffix}`, "Nurse", "Nurse"],
    )
    const nurseId = nurseInsert.rows[0].id
    createdUsers.push(nurseId)

    const patientNumber = `PTI${String(Date.now()).slice(-8)}`
    const patientInsert = await db.query(
      `INSERT INTO patients (patient_number, first_name, last_name, gender)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [patientNumber, "Clinical", "Persistence", "Female"],
    )
    const patientId = patientInsert.rows[0].id
    createdPatients.push(patientId)

    const clinicianSession = await loginWithCsrf({
      baseUrl,
      email: clinicianEmail,
      password,
      role: "Clinician",
    })

    // Test 1: Consultation save then reopen persistence
    const consultPayload = {
      patientId,
      chiefComplaint: `Headache ${suffix}`,
      history: `History ${suffix}`,
      impression: `Impression ${suffix}`,
      diagnosis: `Diagnosis ${suffix}`,
      treatmentPlan: `Treatment ${suffix}`,
      notes: `Notes ${suffix}`,
      vitalSigns: {
        bloodPressure: "120/80",
        temperature: "37.2",
        heartRate: "76",
        respiratoryRate: "16",
        oxygenSaturation: "98",
      },
    }

    const saveConsultRes = await fetch(`${baseUrl}/api/medical/records`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-csrf-token": clinicianSession.csrfToken,
        Cookie: clinicianSession.cookieHeader,
      },
      body: JSON.stringify(consultPayload),
    })
    const saveConsultJson = await saveConsultRes.json().catch(() => ({}))
    assert.equal(saveConsultRes.status, 200, `Consultation save failed: ${JSON.stringify(saveConsultJson)}`)
    assert.ok(saveConsultJson.record?.id, "Expected persisted consultation record id")
    createdMedicalRecords.push(saveConsultJson.record.id)

    const reopenRes = await fetch(`${baseUrl}/api/medical/records?patientId=${encodeURIComponent(patientId)}`, {
      headers: { Cookie: clinicianSession.cookieHeader },
    })
    const reopenJson = await reopenRes.json().catch(() => ({}))
    assert.equal(reopenRes.status, 200, `Consultation reopen failed: ${JSON.stringify(reopenJson)}`)
    const reopened = Array.isArray(reopenJson.records)
      ? reopenJson.records.find((r) => r.id === saveConsultJson.record.id)
      : null
    assert.ok(reopened, "Expected saved consultation in reopen response")
    assert.equal(reopened.history, consultPayload.history)
    assert.equal(reopened.impression, consultPayload.impression)
    assert.equal(reopened.diagnosis, consultPayload.diagnosis)
    assert.equal(reopened.treatmentPlan, consultPayload.treatmentPlan)

    const procedureOrderRes = await fetch(`${baseUrl}/api/procedures`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-csrf-token": clinicianSession.csrfToken,
        Cookie: clinicianSession.cookieHeader,
      },
      body: JSON.stringify({
        patientId,
        procedureName: "Other Procedure",
        isOtherProcedure: true,
        otherProcedureName: `Wound irrigation ${suffix}`,
        status: "ordered",
        reasonIndication: `Indication ${suffix}`,
        procedureNotes: `Perform wound irrigation ${suffix}`,
        followUpInstructions: `Review wound ${suffix}`,
      }),
    })
    const procedureOrderJson = await procedureOrderRes.json().catch(() => ({}))
    assert.equal(procedureOrderRes.status, 200, `Procedure order failed: ${JSON.stringify(procedureOrderJson)}`)
    assert.ok(procedureOrderJson.id, "Expected procedure order id")
    createdProcedures.push(procedureOrderJson.id)

    // Test handoff snapshot links to the exact assessment and carries active procedure requests.
    const createReferralDirectRes = await fetch(`${baseUrl}/api/referrals`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-csrf-token": clinicianSession.csrfToken,
        Cookie: clinicianSession.cookieHeader,
      },
      body: JSON.stringify({
        patientId,
        clinicalRecordId: saveConsultJson.record.id,
        type: "internal",
        receivingUserId: nurseId,
        reason: `Direct referral ${suffix}`,
        urgency: "emergency",
        notes: `Direct notes ${suffix}`,
      }),
    })
    const createReferralDirectJson = await createReferralDirectRes.json().catch(() => ({}))
    assert.equal(createReferralDirectRes.status, 200, `Direct referral create failed: ${JSON.stringify(createReferralDirectJson)}`)
    assert.ok(createReferralDirectJson.id, "Expected direct referral id")
    createdReferrals.push(createReferralDirectJson.id)

    const handoffDbCheck = await db.query(
      `SELECT handoff_snapshot FROM referrals WHERE id = $1`,
      [createReferralDirectJson.id],
    )
    const handoffSnapshot = handoffDbCheck.rows[0]?.handoff_snapshot
    assert.equal(handoffSnapshot?.latestClinicalRecord?.id, saveConsultJson.record.id)
    assert.equal(handoffSnapshot?.latestClinicalRecord?.diagnosis, consultPayload.diagnosis)
    assert.ok(
      handoffSnapshot?.requestedProcedures?.some((procedure) => procedure.id === procedureOrderJson.id),
      "Expected active procedure request in handoff snapshot",
    )

    const createReferralDeptRes = await fetch(`${baseUrl}/api/referrals`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-csrf-token": clinicianSession.csrfToken,
        Cookie: clinicianSession.cookieHeader,
      },
      body: JSON.stringify({
        patientId,
        type: "internal",
        receivingDepartment: "Nurse",
        reason: `Department referral ${suffix}`,
        urgency: "routine",
        notes: `Department notes ${suffix}`,
      }),
    })
    const createReferralDeptJson = await createReferralDeptRes.json().catch(() => ({}))
    assert.equal(createReferralDeptRes.status, 200, `Department referral create failed: ${JSON.stringify(createReferralDeptJson)}`)
    assert.ok(createReferralDeptJson.id, "Expected department referral id")
    createdReferrals.push(createReferralDeptJson.id)

    const nurseSession = await loginWithCsrf({
      baseUrl,
      email: nurseEmail,
      password,
      role: "Nurse",
    })

    const completeProcedureRes = await fetch(`${baseUrl}/api/procedures`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-csrf-token": nurseSession.csrfToken,
        Cookie: nurseSession.cookieHeader,
      },
      body: JSON.stringify({
        procedureId: procedureOrderJson.id,
        procedureDate: "2026-10-26",
        procedureTime: "14:30",
        performedBy: `Nurse Integration ${suffix}`,
        findings: `Findings ${suffix}`,
        procedureNotes: `Completed steps ${suffix}`,
        outcome: `Outcome ${suffix}`,
        followUpInstructions: `Follow-up ${suffix}`,
      }),
    })
    const completeProcedureJson = await completeProcedureRes.json().catch(() => ({}))
    assert.equal(completeProcedureRes.status, 200, `Procedure completion failed: ${JSON.stringify(completeProcedureJson)}`)
    const procedureDbCheck = await db.query(
      `SELECT status, performed_at, performed_by_name, findings, procedure_notes, outcome, follow_up_instructions, completed_by
         FROM procedures
        WHERE id = $1`,
      [procedureOrderJson.id],
    )
    assert.equal(procedureDbCheck.rows[0].status, "completed")
    assert.ok(procedureDbCheck.rows[0].performed_at)
    assert.equal(procedureDbCheck.rows[0].performed_by_name, `Nurse Integration ${suffix}`)
    assert.equal(procedureDbCheck.rows[0].findings, `Findings ${suffix}`)
    assert.equal(procedureDbCheck.rows[0].procedure_notes, `Completed steps ${suffix}`)
    assert.equal(procedureDbCheck.rows[0].outcome, `Outcome ${suffix}`)
    assert.equal(procedureDbCheck.rows[0].follow_up_instructions, `Follow-up ${suffix}`)
    assert.equal(procedureDbCheck.rows[0].completed_by, nurseId)

    const incomingAllRes = await fetch(`${baseUrl}/api/referrals/incoming?status=pending&limit=50`, {
      headers: { Cookie: nurseSession.cookieHeader },
    })
    const incomingAllJson = await incomingAllRes.json().catch(() => ({}))
    assert.equal(incomingAllRes.status, 200, `Incoming referrals list failed: ${JSON.stringify(incomingAllJson)}`)
    const incomingAllIds = Array.isArray(incomingAllJson.referrals) ? incomingAllJson.referrals.map((r) => r.id) : []
    assert.ok(incomingAllIds.includes(createReferralDirectJson.id), "Expected direct referral in nurse incoming queue")
    assert.ok(incomingAllIds.includes(createReferralDeptJson.id), "Expected department referral in nurse incoming queue")

    const incomingEmergencyRes = await fetch(`${baseUrl}/api/referrals/incoming?status=pending&urgency=emergency&limit=50`, {
      headers: { Cookie: nurseSession.cookieHeader },
    })
    const incomingEmergencyJson = await incomingEmergencyRes.json().catch(() => ({}))
    assert.equal(incomingEmergencyRes.status, 200, `Incoming emergency filter failed: ${JSON.stringify(incomingEmergencyJson)}`)
    const incomingEmergencyIds = Array.isArray(incomingEmergencyJson.referrals)
      ? incomingEmergencyJson.referrals.map((r) => r.id)
      : []
    assert.ok(incomingEmergencyIds.includes(createReferralDirectJson.id), "Expected emergency direct referral in filtered queue")
    assert.ok(!incomingEmergencyIds.includes(createReferralDeptJson.id), "Expected routine referral excluded from emergency filter")

    const invalidTransitionRes = await fetch(`${baseUrl}/api/referrals/${createReferralDirectJson.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "x-csrf-token": nurseSession.csrfToken,
        Cookie: nurseSession.cookieHeader,
      },
      body: JSON.stringify({ status: "completed" }),
    })
    const invalidTransitionJson = await invalidTransitionRes.json().catch(() => ({}))
    assert.equal(invalidTransitionRes.status, 409, `Expected transition block pending->completed: ${JSON.stringify(invalidTransitionJson)}`)

    const acceptRes = await fetch(`${baseUrl}/api/referrals/${createReferralDirectJson.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "x-csrf-token": nurseSession.csrfToken,
        Cookie: nurseSession.cookieHeader,
      },
      body: JSON.stringify({ status: "accepted" }),
    })
    const acceptJson = await acceptRes.json().catch(() => ({}))
    assert.equal(acceptRes.status, 200, `Expected pending->accepted to succeed: ${JSON.stringify(acceptJson)}`)

    const completeRes = await fetch(`${baseUrl}/api/referrals/${createReferralDirectJson.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "x-csrf-token": nurseSession.csrfToken,
        Cookie: nurseSession.cookieHeader,
      },
      body: JSON.stringify({ status: "completed" }),
    })
    const completeJson = await completeRes.json().catch(() => ({}))
    assert.equal(completeRes.status, 200, `Expected accepted->completed to succeed: ${JSON.stringify(completeJson)}`)

    const completedIncomingRes = await fetch(`${baseUrl}/api/referrals/incoming?status=completed&limit=50`, {
      headers: { Cookie: nurseSession.cookieHeader },
    })
    const completedIncomingJson = await completedIncomingRes.json().catch(() => ({}))
    assert.equal(completedIncomingRes.status, 200, `Completed incoming filter failed: ${JSON.stringify(completedIncomingJson)}`)
    const completedIds = Array.isArray(completedIncomingJson.referrals)
      ? completedIncomingJson.referrals.map((r) => r.id)
      : []
    assert.ok(completedIds.includes(createReferralDirectJson.id), "Expected completed referral in completed queue")

    const referralDbCheck = await db.query(
      `SELECT status, accepted_at, completed_at, status_history
         FROM referrals
        WHERE id = $1`,
      [createReferralDirectJson.id],
    )
    assert.equal(referralDbCheck.rows[0].status, "completed")
    assert.ok(referralDbCheck.rows[0].accepted_at, "Expected accepted_at timestamp")
    assert.ok(referralDbCheck.rows[0].completed_at, "Expected completed_at timestamp")
    assert.ok(Array.isArray(referralDbCheck.rows[0].status_history), "Expected status_history array")

    console.log("OK: clinical persistence + referral workflow integration tests passed")
  } finally {
    try {
      if (createdReferrals.length) {
        await db.query(`DELETE FROM referrals WHERE id = ANY($1::uuid[])`, [createdReferrals])
      }
      if (createdProcedures.length) {
        await db.query(`DELETE FROM procedures WHERE id = ANY($1::uuid[])`, [createdProcedures])
      }
      if (createdMedicalRecords.length) {
        await db.query(`DELETE FROM medical_records WHERE id = ANY($1::uuid[])`, [createdMedicalRecords])
      }
      if (createdPatients.length) {
        await db.query(`DELETE FROM patients WHERE id = ANY($1::uuid[])`, [createdPatients])
      }
      if (createdUsers.length) {
        await db.query(`DELETE FROM users WHERE id = ANY($1::uuid[])`, [createdUsers])
      }
    } catch (cleanupErr) {
      console.error("Cleanup warning:", cleanupErr.message || cleanupErr)
    }
    await db.end()
  }
}

run().catch((err) => {
  console.error("Integration test failed:", err.message || err)
  process.exit(1)
})
