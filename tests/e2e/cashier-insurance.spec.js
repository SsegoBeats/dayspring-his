const { test, expect } = require("@playwright/test")
const jwt = require("jsonwebtoken")
const { Client } = require("pg")

const databaseUrl = process.env.DATABASE_URL
const jwtSecret = process.env.JWT_SECRET

let cashierUser
let patientFixture

async function withDb(fn) {
  const client = new Client({ connectionString: databaseUrl })
  await client.connect()
  try {
    return await fn(client)
  } finally {
    await client.end()
  }
}

async function loadCashierFixtures() {
  return withDb(async (client) => {
    const cashierRes = await client.query(`
      SELECT id, email, role, name
      FROM users
      WHERE role = 'Cashier' AND is_active = true
      ORDER BY name
      LIMIT 1
    `)
    const patientRes = await client.query(`
      SELECT id, patient_number, trim(first_name) AS first_name, trim(last_name) AS last_name
      FROM patients
      ORDER BY patient_number ASC
      LIMIT 1
    `)
    return {
      cashierUser: cashierRes.rows[0],
      patientFixture: patientRes.rows[0],
    }
  })
}

function buildCashierToken() {
  return jwt.sign(
    {
      sub: cashierUser.id,
      email: cashierUser.email,
      role: cashierUser.role,
      iss: "dayspring-his",
      aud: "dayspring-his",
    },
    jwtSecret,
    {
      algorithm: "HS256",
      expiresIn: "8h",
    },
  )
}

async function authenticateCashier(page, baseURL) {
  const appUrl = baseURL || "http://localhost:3000"
  const token = buildCashierToken()
  await page.addInitScript((sessionToken) => {
    window.localStorage.setItem("session_dev_bearer", sessionToken)
  }, token)
  await page.context().addCookies([
    { name: "session", value: token, url: appUrl, sameSite: "Lax" },
    { name: "session_dev", value: token, url: appUrl, sameSite: "Lax" },
  ])
  await page.goto("/cashier")
  await expect(page).toHaveURL(/\/cashier(?:\?.*)?$/)
  await expect(page.getByText("Cashier Operations")).toBeVisible({ timeout: 60000 })
}

async function cleanupCoverageArtifacts(patientId, runId) {
  await withDb(async (client) => {
    await client.query(`DELETE FROM insurance_policies WHERE patient_id = $1 AND policy_no = $2`, [patientId, `E2E-POL-${runId}`])
    await client.query(`DELETE FROM insurance_payers WHERE name = $1`, [`E2E Cashier Payer ${runId}`])
  })
}

async function seedUnreadyCoverage(patientId, runId) {
  await withDb(async (client) => {
    const payer = await client.query(
      `
        INSERT INTO insurance_payers (name, payer_code, payer_type, requires_preauth_default, scheme_stamp_required, panel_driven, panel_required, active)
        VALUES ($1,$2,'HMO',true,true,true,true,true)
        RETURNING id
      `,
      [`E2E Cashier Payer ${runId}`, `E2E-CASH-${runId}`],
    )
    const payerId = payer.rows[0].id
    await client.query(
      `
        INSERT INTO insurance_policies (
          patient_id, payer_id, policy_no, member_id, group_no, plan_name,
          coordination_order, panel_status, effective_date, expiry_date,
          verification_status, verification_reference, authorization_required, active
        ) VALUES (
          $1,$2,$3,$4,$5,$6,
          1,'Unknown',$7,$8,
          'Pending',NULL,true,true
        )
      `,
      [
        patientId,
        payerId,
        `E2E-POL-${runId}`,
        `E2E-MEM-${runId}`,
        `E2E-GRP-${runId}`,
        "Restricted services plan",
        "2026-01-01",
        "2026-12-31",
      ],
    )
  })
}

test.describe("Cashier insurance readiness", () => {
  test.describe.configure({ mode: "serial" })
  test.setTimeout(240000)
  test.skip(!databaseUrl || !jwtSecret, "Set DATABASE_URL and JWT_SECRET to run cashier insurance tests.")

  test.beforeAll(async () => {
    const fixtures = await loadCashierFixtures()
    cashierUser = fixtures.cashierUser
    patientFixture = fixtures.patientFixture
    if (!cashierUser) throw new Error("No active cashier user exists in the current dataset.")
    if (!patientFixture) throw new Error("No patient exists in the current dataset.")
  })

  test("blocks restricted-service bill creation when insurance readiness is incomplete", async ({ page, baseURL }) => {
    const runId = Date.now()
    await cleanupCoverageArtifacts(patientFixture.id, runId)
    await seedUnreadyCoverage(patientFixture.id, runId)

    try {
      await authenticateCashier(page, baseURL)

      await page.getByRole("tab", { name: /Create Bill/i }).click()
      await expect(page.getByText("Create New Bill")).toBeVisible({ timeout: 60000 })

      // Select the fixture patient
      await page.getByLabel("Find Patient").fill(patientFixture.patient_number)
      await page.getByLabel(/Select Patient/i).click()
      await page.getByRole("option", { name: new RegExp(patientFixture.patient_number, "i") }).click()

      // Coverage panel should load and show missing readiness
      await expect(page.getByText("Insurance readiness")).toBeVisible()
      await expect(page.getByText("Verification")).toBeVisible()
      await expect(page.getByText("Missing")).toBeVisible()

      // Add a restricted service (Imaging)
      await page.getByText("Item type").first().click()
      await page.getByRole("option", { name: "Service", exact: true }).click()
      await page.getByText("Service").first().click()
      await page.getByRole("option", { name: "Imaging", exact: true }).click()
      await page.getByLabel("Quantity").first().fill("1")
      await page.getByLabel("Total").first().fill("100000")

      await page.getByRole("button", { name: "Create Bill" }).click()
      await expect(page.getByText(/not ready for restricted services/i)).toBeVisible({ timeout: 30000 })
    } finally {
      await cleanupCoverageArtifacts(patientFixture.id, runId)
    }
  })
})

