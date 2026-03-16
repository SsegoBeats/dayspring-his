const { test, expect } = require("@playwright/test")
const jwt = require("jsonwebtoken")
const { Client } = require("pg")

const databaseUrl = process.env.DATABASE_URL
const jwtSecret = process.env.JWT_SECRET
const queueTestDepartment = "Surgery"

let receptionistUser
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

async function loadReceptionFixtures() {
  return withDb(async (client) => {
    const receptionistRes = await client.query(`
      SELECT id, email, role, name
      FROM users
      WHERE role = 'Receptionist' AND is_active = true
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
      receptionistUser: receptionistRes.rows[0],
      patientFixture: patientRes.rows[0],
    }
  })
}

async function cleanupQueueLane(patientId) {
  await withDb(async (client) => {
    await client.query(
      `
        DELETE FROM queues q
        USING checkins c
        WHERE q.checkin_id = c.id
          AND c.patient_id = $1
          AND q.department = $2
      `,
      [patientId, queueTestDepartment],
    )
  })
}

function buildReceptionToken() {
  return jwt.sign(
    {
      sub: receptionistUser.id,
      email: receptionistUser.email,
      role: receptionistUser.role,
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

async function authenticateReceptionist(page, baseURL) {
  const appUrl = baseURL || "http://localhost:3000"
  const token = buildReceptionToken()

  await page.addInitScript((sessionToken) => {
    window.localStorage.setItem("session_dev_bearer", sessionToken)
  }, token)

  await page.context().addCookies([
    {
      name: "session",
      value: token,
      url: appUrl,
      sameSite: "Lax",
    },
    {
      name: "session_dev",
      value: token,
      url: appUrl,
      sameSite: "Lax",
    },
  ])

  await page.goto("/receptionist")
  await expect(page).toHaveURL(/\/receptionist(?:\?.*)?$/)
  await expect(page.getByText("Reception Command Desk")).toBeVisible({ timeout: 60000 })
}

function waitForExport(page, dataset, format) {
  return page.waitForResponse((response) => {
    if (!response.url().includes("/api/exports/direct")) return false
    if (response.request().method() !== "POST") return false
    const body = response.request().postData() || ""
    return body.includes(`"dataset":"${dataset}"`) && body.includes(`"format":"${format}"`)
  })
}

function patientQueueCards(page) {
  return page
    .locator("div.p-3.flex.items-center.justify-between.border-t")
    .filter({ hasText: new RegExp(`${patientFixture.patient_number}\\s*-`, "i") })
}

function patientQueueCardWithAction(page, actionName) {
  return patientQueueCards(page).filter({ has: page.getByRole("button", { name: actionName }) }).first()
}

test.describe("Receptionist portal smoke", () => {
  test.describe.configure({ mode: "serial" })
  test.setTimeout(300000)
  test.skip(!databaseUrl || !jwtSecret, "Set DATABASE_URL and JWT_SECRET to run receptionist smoke tests.")

  test.beforeAll(async () => {
    const fixtures = await loadReceptionFixtures()
    receptionistUser = fixtures.receptionistUser
    patientFixture = fixtures.patientFixture

    if (!receptionistUser) {
      throw new Error("No active receptionist user exists in the current dataset.")
    }

    if (!patientFixture) {
      throw new Error("No patient exists in the current dataset.")
    }
  })

  test("loads the receptionist command desk and routes the main quick actions", async ({ page, baseURL }) => {
    await authenticateReceptionist(page, baseURL)

    await expect(page.getByText("Portal settings")).toHaveCount(0)
    await expect(page.getByRole("link", { name: "Settings" })).toBeVisible()

    await page.getByRole("button", { name: /Open patient register/i }).click()
    await expect(page.getByText("Patient List")).toBeVisible({ timeout: 60000 })

    await page.getByRole("button", { name: /Launch check-in desk/i }).click()
    await expect(page.getByText("Quick Check-In")).toBeVisible({ timeout: 60000 })

    await page.getByRole("button", { name: /Review queue flow/i }).click()
    await expect(page.getByText("Department Queue")).toBeVisible({ timeout: 60000 })

    await page.getByRole("button", { name: /Open reports/i }).click()
    await expect(page.getByRole("button", { name: "Reception Register", exact: true })).toBeVisible({ timeout: 60000 })

    await page.getByRole("tab", { name: "Overview" }).click()
    await expect(page.getByText("Reception Workflow Coverage")).toBeVisible({ timeout: 60000 })
    await page.getByRole("button", { name: /Registered Patients/i }).click()
    await expect(page.getByText("Patient List")).toBeVisible({ timeout: 60000 })
  })

  test("opens receptionist settings and the patient register actions", async ({ page, baseURL }) => {
    await authenticateReceptionist(page, baseURL)

    await page.getByRole("link", { name: "Settings" }).click()
    await expect(page).toHaveURL(/\/receptionist\/settings$/, { timeout: 60000 })
    await expect(page.getByText("Receptionist Settings")).toBeVisible()
    await expect(page.getByLabel("Portal Home")).toBeVisible()
    await page.getByLabel("Portal Home").click()
    await expect(page.getByRole("option", { name: "Patient Register" })).toBeVisible()
    await expect(page.getByRole("option", { name: "Check-In Desk" })).toBeVisible()
    await expect(page.getByRole("option", { name: "Queue Board" })).toBeVisible()

    await page.goto("/receptionist?section=patients")
    await expect(page.getByText("Patient List")).toBeVisible()

    await page.getByRole("button", { name: "Register Patient" }).click()
    await expect(page.getByText("Enter patient demographics and contact information to register a new patient.")).toBeVisible()
    await page.keyboard.press("Escape")
    await expect(page.getByText("Enter patient demographics and contact information to register a new patient.")).toHaveCount(0)

    const firstPatientRow = page.locator("tbody tr").first()
    await firstPatientRow.getByRole("button", { name: /^View$/ }).click()
    await expect(page.getByRole("button", { name: "Back to patient list" })).toBeVisible({ timeout: 60000 })
    await page.getByRole("button", { name: "Back to patient list" }).click()
    await expect(page.getByText("Patient List")).toBeVisible()

    await firstPatientRow.getByRole("button", { name: /^Delete$/ }).click()
    await expect(page.getByText("Request Patient Deletion")).toBeVisible()
    await page.getByRole("button", { name: "Cancel" }).click()
    await expect(page.getByText("Request Patient Deletion")).toHaveCount(0)
  })

  test("checks in a patient, works the queue lane, and verifies payments and report exports", async ({ page, baseURL }) => {
    await cleanupQueueLane(patientFixture.id)
    await authenticateReceptionist(page, baseURL)

    await page.goto("/receptionist?section=checkin")
    await expect(page.getByText("Quick Check-In")).toBeVisible()

    await page.getByLabel("Search patients by name, number, or phone").fill(patientFixture.patient_number)
    await page.getByRole("option", { name: new RegExp(patientFixture.patient_number, "i") }).click()
    await page.getByRole("button", { name: "Appointments", exact: true }).click()
    await expect(page.getByRole("button", { name: "Schedule Appointment", exact: true })).toBeVisible()
    await page.keyboard.press("Escape")

    await page.getByLabel("Department for queue").click()
    await page.getByRole("option", { name: queueTestDepartment }).click()

    const checkinResponsePromise = page.waitForResponse(
      (response) => response.url().includes("/api/checkins") && response.request().method() === "POST",
    )
    await page.getByRole("button", { name: "Check In" }).click()
    const checkinResponse = await checkinResponsePromise
    expect(checkinResponse.ok()).toBeTruthy()
    await expect(page.getByText("Token ready to print")).toBeVisible()

    await page.goto("/receptionist?section=queue")
    await expect(page.getByText("Department Queue")).toBeVisible({ timeout: 60000 })
    await page.getByRole("combobox", { name: "Filter by department" }).click()
    await page.getByRole("option", { name: queueTestDepartment }).click()

    const waitingRow = patientQueueCardWithAction(page, "Start")
    await expect(waitingRow).toBeVisible()
    await waitingRow.getByRole("button", { name: "Start" }).click()

    const inServiceRow = patientQueueCardWithAction(page, "Mark Done")
    await expect(inServiceRow).toBeVisible()
    await inServiceRow.getByRole("button", { name: "Mark Done" }).click()

    page.once("dialog", (dialog) => dialog.accept())
    const doneRow = patientQueueCardWithAction(page, "Remove")
    await expect(doneRow).toBeVisible()
    await doneRow.getByRole("button", { name: "Remove" }).click()
    await expect(patientQueueCards(page)).toHaveCount(0)

    const queueExportPromise = waitForExport(page, "queue_events", "csv")
    await page.getByRole("button", { name: "Export CSV" }).click()
    expect((await queueExportPromise).ok()).toBeTruthy()

    await page.goto("/receptionist?section=payments")
    await expect(page.getByText("Cashier handoff")).toBeVisible()
    const paymentsExportPromise = waitForExport(page, "payments", "csv")
    await page.getByRole("button", { name: "CSV" }).click()
    expect((await paymentsExportPromise).ok()).toBeTruthy()

    await page.goto("/receptionist?section=reports")
    await expect(page.getByRole("button", { name: "Reception Register", exact: true })).toBeVisible()
    const reportsExportPromise = waitForExport(page, "reception_register", "csv")
    await page.getByRole("button", { name: "Reception Register", exact: true }).click()
    await page.getByRole("menuitem", { name: "CSV" }).click()
    expect((await reportsExportPromise).ok()).toBeTruthy()
  })
})
