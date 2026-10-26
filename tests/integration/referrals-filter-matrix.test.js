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

async function fetchFiltered({ baseUrl, cookieHeader, patientId, status, urgency }) {
  const qs = new URLSearchParams()
  qs.set("patientId", patientId)
  if (status) qs.set("status", status)
  if (urgency) qs.set("urgency", urgency)

  const res = await fetch(`${baseUrl}/api/referrals?${qs.toString()}`, {
    headers: { Cookie: cookieHeader },
  })
  const json = await res.json().catch(() => ({}))
  assert.equal(res.status, 200, `Filtered referral fetch failed: ${JSON.stringify(json)}`)

  return Array.isArray(json.referrals) ? json.referrals : []
}

async function run() {
  const baseUrl = process.env.TEST_BASE_URL || "http://localhost:3000"
  const connectionString = process.env.INTEGRATION_DATABASE_URL
  if (!connectionString) {
    console.log("INTEGRATION_DATABASE_URL not set - skipping referral filter matrix integration test")
    return
  }

  const db = new Client({ connectionString })
  await db.connect()

  const createdUsers = []
  const createdPatients = []
  const createdReferrals = []

  try {
    const suffix = randomSuffix()
    const clinicianEmail = `clinician.filters.${suffix}@dayspring.local`
    const password = "Admin2025"
    const passwordHash = await bcrypt.hash(password, 10)

    const clinicianInsert = await db.query(
      `INSERT INTO users (email, password_hash, name, role, department, is_active)
       VALUES ($1, $2, $3, $4, $5, true)
       RETURNING id`,
      [clinicianEmail, passwordHash, `Clinician Filter Matrix ${suffix}`, "Clinician", "Clinician"],
    )
    const clinicianId = clinicianInsert.rows[0].id
    createdUsers.push(clinicianId)

    const patientNumber = `PTM${String(Date.now()).slice(-8)}`
    const patientInsert = await db.query(
      `INSERT INTO patients (patient_number, first_name, last_name, gender)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [patientNumber, "Referral", "Matrix", "Female"],
    )
    const patientId = patientInsert.rows[0].id
    createdPatients.push(patientId)

    const clinicianSession = await loginWithCsrf({
      baseUrl,
      email: clinicianEmail,
      password,
      role: "Clinician",
    })

    const matrixRows = [
      { status: "pending", urgency: "emergency" },
      { status: "pending", urgency: "routine" },
      { status: "pending", urgency: "low" },
      { status: "accepted", urgency: "emergency" },
      { status: "accepted", urgency: "urgent" },
      { status: "completed", urgency: "routine" },
      { status: "cancelled", urgency: "Very Urgent" },
      { status: "cancelled", urgency: "low" },
    ]

    for (const row of matrixRows) {
      const insert = await db.query(
        `INSERT INTO referrals (
          patient_id, type, referring_user_id, referring_role,
          reason, urgency, status, notes, status_history
        ) VALUES ($1, 'internal', $2, 'Clinician', $3, $4, $5, $6, $7::jsonb)
        RETURNING id`,
        [
          patientId,
          clinicianId,
          `Matrix ${row.status}/${row.urgency} ${suffix}`,
          row.urgency,
          row.status,
          `Notes ${suffix}`,
          JSON.stringify([{ status: row.status, changedAt: new Date().toISOString(), changedBy: clinicianId }]),
        ],
      )
      createdReferrals.push(insert.rows[0].id)
    }

    const allRows = await fetchFiltered({
      baseUrl,
      cookieHeader: clinicianSession.cookieHeader,
      patientId,
    })
    const allIds = new Set(allRows.map((row) => row.id))
    for (const id of createdReferrals) {
      assert.ok(allIds.has(id), `Expected referral ${id} in patient referral list`)
    }

    const statuses = ["pending", "accepted", "completed", "cancelled"]
    const urgencies = ["emergency", "Very Urgent", "urgent", "routine", "low"]

    for (const status of statuses) {
      const rows = await fetchFiltered({
        baseUrl,
        cookieHeader: clinicianSession.cookieHeader,
        patientId,
        status,
      })
      assert.ok(rows.every((row) => row.status === status), `Status-only filter leaked rows for status=${status}`)
      const expectedCount = matrixRows.filter((row) => row.status === status).length
      assert.equal(rows.length, expectedCount, `Unexpected count for status=${status}`)
    }

    for (const urgency of urgencies) {
      const rows = await fetchFiltered({
        baseUrl,
        cookieHeader: clinicianSession.cookieHeader,
        patientId,
        urgency,
      })
      assert.ok(rows.every((row) => row.urgency === urgency), `Urgency-only filter leaked rows for urgency=${urgency}`)
      const expectedCount = matrixRows.filter((row) => row.urgency === urgency).length
      assert.equal(rows.length, expectedCount, `Unexpected count for urgency=${urgency}`)
    }

    for (const status of statuses) {
      for (const urgency of urgencies) {
        const rows = await fetchFiltered({
          baseUrl,
          cookieHeader: clinicianSession.cookieHeader,
          patientId,
          status,
          urgency,
        })
        const expectedCount = matrixRows.filter((row) => row.status === status && row.urgency === urgency).length
        assert.equal(rows.length, expectedCount, `Unexpected count for status=${status} urgency=${urgency}`)
        assert.ok(
          rows.every((row) => row.status === status && row.urgency === urgency),
          `Combined filter leaked rows for status=${status} urgency=${urgency}`,
        )
      }
    }

    console.log("OK: referral filter matrix integration test passed")
  } finally {
    try {
      if (createdReferrals.length) {
        await db.query(`DELETE FROM referrals WHERE id = ANY($1::uuid[])`, [createdReferrals])
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
