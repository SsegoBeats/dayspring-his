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

async function run() {
  const baseUrl = process.env.TEST_BASE_URL || "http://localhost:3000"
  const connectionString = process.env.INTEGRATION_DATABASE_URL
  if (!connectionString) {
    console.log("INTEGRATION_DATABASE_URL not set - skipping family-planning removal integration test")
    return
  }

  const db = new Client({ connectionString })
  await db.connect()

  let userId = null
  let patientId = null
  let eventId = null

  try {
    const suffix = randomSuffix()
    const email = `midwife.integration.${suffix}@dayspring.local`
    const password = "Admin2025"
    const passwordHash = await bcrypt.hash(password, 10)

    const userInsert = await db.query(
      `INSERT INTO users (email, password_hash, name, role, is_active)
       VALUES ($1, $2, $3, $4, true)
       RETURNING id`,
      [email, passwordHash, `Midwife Integration ${suffix}`, "Midwife"],
    )
    userId = userInsert.rows[0].id

    const patientNumber = `PTI${String(Date.now()).slice(-8)}`
    const patientInsert = await db.query(
      `INSERT INTO patients (patient_number, first_name, last_name, gender)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [patientNumber, "Integration", "Patient", "Female"],
    )
    patientId = patientInsert.rows[0].id

    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-forwarded-for": `127.0.0.${Math.floor(Math.random() * 200) + 10}`,
      },
      body: JSON.stringify({ email, password, role: "Midwife" }),
    })
    const loginJson = await loginRes.json().catch(() => ({}))
    assert.equal(loginRes.status, 200, `Login failed: ${JSON.stringify(loginJson)}`)

    const loginSetCookies = typeof loginRes.headers.getSetCookie === "function"
      ? loginRes.headers.getSetCookie()
      : [loginRes.headers.get("set-cookie")].filter(Boolean)
    const authCookies = extractCookieHeader(loginSetCookies)
    assert.ok(authCookies.includes("session="), "Expected session cookie from login")

    const csrfRes = await fetch(`${baseUrl}/api/csrf`, {
      headers: { Cookie: authCookies },
    })
    const csrfJson = await csrfRes.json().catch(() => ({}))
    assert.equal(csrfRes.status, 200, `CSRF handshake failed: ${JSON.stringify(csrfJson)}`)

    const csrfSetCookies = typeof csrfRes.headers.getSetCookie === "function"
      ? csrfRes.headers.getSetCookie()
      : [csrfRes.headers.get("set-cookie")].filter(Boolean)
    const csrfCookies = extractCookieHeader(csrfSetCookies)
    const csrfToken = csrfJson.csrfToken || csrfJson.token
    assert.ok(csrfToken, "Expected csrf token from /api/csrf")

    const cookieHeader = [authCookies, csrfCookies].filter(Boolean).join("; ")
    const marker = `integration-smoke-${suffix}`

    const createRes = await fetch(`${baseUrl}/api/family-planning`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-csrf-token": csrfToken,
        Cookie: cookieHeader,
      },
      body: JSON.stringify({
        patientId,
        encounterDate: new Date().toISOString(),
        eventType: "method_removal",
        method: "Implant",
        status: "active",
        reason: "Routine replacement",
        removalReason: `expired ${marker}`,
        replacementMethod: "DMPA",
        nextReviewDate: null,
        isPostpartum: false,
        postpartumWeeks: null,
        notes: `integration ${marker}`,
      }),
    })
    const createJson = await createRes.json().catch(() => ({}))
    assert.equal(createRes.status, 201, `Create event failed: ${JSON.stringify(createJson)}`)
    assert.ok(createJson.id, "Expected created event id")
    eventId = createJson.id

    const listRes = await fetch(`${baseUrl}/api/family-planning?patientId=${patientId}`, {
      headers: { Cookie: cookieHeader },
    })
    const listJson = await listRes.json().catch(() => ({}))
    assert.equal(listRes.status, 200, `List endpoint failed: ${JSON.stringify(listJson)}`)

    const created = Array.isArray(listJson.events) ? listJson.events.find((e) => e.id === eventId) : null
    assert.ok(created, "Expected created event in GET response")
    assert.equal(created.status, "discontinued", "method_removal should resolve status to discontinued")
    assert.equal(created.event_type, "method_removal")
    assert.ok(created.removal_reason && created.removal_reason.includes(marker), "Expected removal_reason to persist")
    assert.equal(created.replacement_method, "DMPA")

    const exportRes = await fetch(`${baseUrl}/api/exports/direct`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-csrf-token": csrfToken,
        Cookie: cookieHeader,
      },
      body: JSON.stringify({
        dataset: "family_planning",
        format: "csv",
        filters: {
          from: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
          to: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        },
        redaction_profile: "clinical",
      }),
    })
    const exportCsv = await exportRes.text()
    assert.equal(exportRes.status, 200, `Export failed: ${exportCsv}`)

    const header = exportCsv.split(/\r?\n/)[0] || ""
    assert.ok(header.includes("Removal Reason"), "Expected Removal Reason column in export header")
    assert.ok(header.includes("Replacement Method"), "Expected Replacement Method column in export header")
    assert.ok(exportCsv.includes(marker), "Expected export row for created event")

    console.log("OK: family planning method_removal integration test passed")
  } finally {
    try {
      if (eventId) {
        await db.query("DELETE FROM family_planning_events WHERE id = $1", [eventId])
      }
      if (patientId) {
        await db.query("DELETE FROM patients WHERE id = $1", [patientId])
      }
      if (userId) {
        await db.query("DELETE FROM users WHERE id = $1", [userId])
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
