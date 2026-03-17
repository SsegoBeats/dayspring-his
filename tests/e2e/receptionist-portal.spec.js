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

async function cleanupInsuranceArtifacts(patientId, runId) {
  await withDb(async (client) => {
    await client.query(
      `
        DELETE FROM documents
        WHERE patient_id = $1
          AND (
            notes = $2
            OR original_name = $3
          )
      `,
      [patientId, `E2E insurance doc ${runId}`, `insurance-card-${runId}.pdf`],
    )

    await client.query(
      `
        DELETE FROM preauthorizations
        WHERE patient_id = $1
          AND (
            request_reference = $2
            OR auth_code = $3
          )
      `,
      [patientId, `REQ-${runId}`, `AUTH-${runId}`],
    )

    await client.query(
      `
        DELETE FROM insurance_policies
        WHERE patient_id = $1
          AND policy_no = $2
      `,
      [patientId, `POL-${runId}`],
    )

    await client.query(
      `
        DELETE FROM insurance_payers
        WHERE name = $1
      `,
      [`E2E Payer ${runId}`],
    )
  })
}

async function cleanupRegisteredPatientByPhone(phone) {
  await withDb(async (client) => {
    const patientRes = await client.query(
      `
        SELECT id
        FROM patients
        WHERE phone = $1
      `,
      [phone],
    )

    for (const row of patientRes.rows) {
      await client.query(
        `
          DELETE FROM queues
          WHERE checkin_id IN (
            SELECT id
            FROM checkins
            WHERE patient_id = $1
          )
        `,
        [row.id],
      )
      await client.query(`DELETE FROM checkins WHERE patient_id = $1`, [row.id])
      await client.query(`DELETE FROM triage_assessments WHERE patient_id = $1`, [row.id])
      await client.query(`DELETE FROM insurance_policies WHERE patient_id = $1`, [row.id])
      await client.query(`DELETE FROM documents WHERE patient_id = $1`, [row.id])
      await client.query(`DELETE FROM patients WHERE id = $1`, [row.id])
    }
  })
}

async function loadPatientSnapshot(patientId) {
  return withDb(async (client) => {
    const result = await client.query(
      `
        SELECT address, triage_category
        FROM patients
        WHERE id = $1
      `,
      [patientId],
    )

    return result.rows[0] || { address: null, triage_category: null }
  })
}

async function restorePatientSnapshot(patientId, snapshot) {
  await withDb(async (client) => {
    await client.query(
      `
        UPDATE patients
        SET address = $2,
            triage_category = $3,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `,
      [patientId, snapshot.address || null, snapshot.triage_category || null],
    )
  })
}

async function cleanupTriageArtifact(patientId, chiefComplaint) {
  await withDb(async (client) => {
    await client.query(
      `
        DELETE FROM triage_assessments
        WHERE patient_id = $1
          AND chief_complaint = $2
      `,
      [patientId, chiefComplaint],
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

function queuePanel(page) {
  return page.getByRole("tabpanel", { name: "Queue" })
}

function patientQueueCards(page) {
  return queuePanel(page)
    .locator("div")
    .filter({ hasText: new RegExp(`${patientFixture.patient_number}\\s*-`, "i") })
}

function patientQueueCardWithAction(page, actionName) {
  return queuePanel(page)
    .locator("div")
    .filter({
      hasText: new RegExp(`${patientFixture.patient_number}\\s*-`, "i"),
      has: queuePanel(page).getByRole("button", { name: actionName }),
    })
    .first()
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
    await expect(page.getByText("Patient List")).toBeInViewport()

    await page.getByRole("button", { name: /Launch check-in desk/i }).click()
    await expect(page.getByText("Quick Check-In")).toBeVisible({ timeout: 60000 })
    await expect(page.getByText("Quick Check-In")).toBeInViewport()

    await page.getByRole("button", { name: /Review queue flow/i }).click()
    await expect(page.getByText("Department Queue")).toBeVisible({ timeout: 60000 })
    await expect(page.getByText("Department Queue")).toBeInViewport()

    await page.getByRole("button", { name: /Open reports/i }).click()
    await expect(page.getByRole("button", { name: "Reception Register", exact: true })).toBeVisible({ timeout: 60000 })
    await expect(page.getByRole("button", { name: "Reception Register", exact: true })).toBeInViewport()

    await page.getByRole("tab", { name: "Overview" }).click()
    await expect(page.getByText("Reception Operations Overview")).toBeVisible({ timeout: 60000 })
    await page.getByRole("button", { name: /Registered Patients/i }).click()
    await expect(page.getByText("Patient List")).toBeVisible({ timeout: 60000 })
    await expect(page.getByText("Patient List")).toBeInViewport()
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
    await expect(page.getByText("Patient List")).toBeInViewport()

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

  test("opens patient detail edit and triage workflows in larger dialogs", async ({ page, baseURL }) => {
    const patientSnapshot = await loadPatientSnapshot(patientFixture.id)
    const updatedAddress = `Reception desk verification ${Date.now()}`
    const triageChiefComplaint = `Reception triage smoke ${Date.now()}`

    try {
      await authenticateReceptionist(page, baseURL)

      await page.goto("/receptionist?section=patients")
      await expect(page.getByText("Patient List")).toBeVisible()
      await page.locator("#patient-list-search").fill(patientFixture.patient_number)
      await expect(page.getByText("Showing 1-1 of 1 patients")).toBeVisible({ timeout: 30000 })
      await page.getByRole("button", { name: /^View$/ }).click()

      await expect(page.getByRole("button", { name: "Edit Patient" })).toBeVisible({ timeout: 60000 })
      await page.getByRole("button", { name: "Edit Patient" }).click()
      const editDialog = page.locator('[data-slot="dialog-content"]').filter({ hasText: "Edit Patient" })
      await expect(editDialog).toBeVisible()
      const editDialogBox = await editDialog.boundingBox()
      expect(editDialogBox && editDialogBox.width).toBeGreaterThan(820)

      await page.locator("#edit-patient-address").fill(updatedAddress)
      const patientSavePromise = page.waitForResponse(
        (response) => response.url().includes("/api/patients") && response.request().method() === "PATCH",
      )
      await editDialog.getByRole("button", { name: "Save Changes" }).click()
      expect((await patientSavePromise).ok()).toBeTruthy()
      await expect(editDialog).toHaveCount(0, { timeout: 30000 })
      await expect(page.getByText(updatedAddress)).toBeVisible({ timeout: 30000 })

      await page.getByRole("button", { name: "Record Triage" }).click()
      const triageDialog = page.locator('[data-slot="dialog-content"]').filter({ hasText: "Triage Assessment" })
      await expect(triageDialog).toBeVisible()
      const triageDialogBox = await triageDialog.boundingBox()
      expect(triageDialogBox && triageDialogBox.width).toBeGreaterThan(820)

      await page.locator("#triage-systolic").fill("118")
      await page.locator("#triage-diastolic").fill("76")
      await page.locator("#triage-heartRate").fill("78")
      await page.locator("#triage-respiratoryRate").fill("16")
      await page.locator("#triage-temperature").fill("36.8")
      await page.locator("#triage-spo2").fill("98")
      await page.locator("#triage-chiefComplaint").fill(triageChiefComplaint)

      const triageSavePromise = page.waitForResponse(
        (response) => response.url().includes("/api/triage") && response.request().method() === "POST",
      )
      await triageDialog.getByRole("button", { name: "Save Triage Assessment" }).click()
      expect((await triageSavePromise).ok()).toBeTruthy()
      await expect(triageDialog).toHaveCount(0, { timeout: 30000 })
      await expect(page.getByText("Triage:")).toBeVisible({ timeout: 30000 })
    } finally {
      await cleanupTriageArtifact(patientFixture.id, triageChiefComplaint)
      await restorePatientSnapshot(patientFixture.id, patientSnapshot)
    }
  })

  test("registers a patient and opens a receipt-sized queue token for printing", async ({ page, baseURL }) => {
    const localSuffix = String(Date.now()).slice(-8)
    const patientPhone = `+2567${localSuffix}`
    const emergencyPhone = `+25675${String(Date.now() + 11111).slice(-7)}`

    await cleanupRegisteredPatientByPhone(patientPhone)

    try {
      await authenticateReceptionist(page, baseURL)

      await page.goto("/receptionist?section=patients")
      await expect(page.getByText("Patient List")).toBeVisible()
      await page.getByRole("button", { name: "Register Patient" }).click()

      const registrationDialog = page.locator('[data-slot="dialog-content"]').filter({ hasText: "Register New Patient" })
      await expect(registrationDialog).toBeVisible({ timeout: 60000 })

      await page.locator("#firstName").fill("Thermal")
      await page.locator("#lastName").fill("Token")
      await page.locator("#ageYears").fill("29")

      await page.getByRole("button", { name: /Identification & Address/i }).click()
      await page.locator("#address").fill("Wanyange reception desk")

      await page.getByRole("button", { name: /Contact Information/i }).click()
      await page.locator("#phone").fill(patientPhone)

      await page.getByRole("button", { name: /Clinical & Department/i }).click()
      await page.locator("#department").click()
      await page.getByRole("option", { name: queueTestDepartment, exact: true }).click()

      await page.getByRole("button", { name: /Emergency Contact/i }).click()
      await page.locator("#emergencyContact").fill("Desk Contact")
      await page.locator("#emergencyPhone").fill(emergencyPhone)

      const popupPromise = page.waitForEvent("popup")
      const createPatientPromise = page.waitForResponse(
        (response) => response.url().includes("/api/patients") && response.request().method() === "POST",
      )
      await registrationDialog.getByRole("button", { name: "Register Patient" }).click()
      expect((await createPatientPromise).ok()).toBeTruthy()

      const popup = await popupPromise
      await popup.waitForLoadState("domcontentloaded")
      await expect(popup).toHaveURL(/\/api\/queue\/token\//)
      await expect(popup.getByText("Queue Token")).toBeVisible({ timeout: 60000 })
      await expect(popup.getByText("Queue Position")).toBeVisible()
      await expect(popup.getByText(queueTestDepartment)).toBeVisible()
      await expect(popup.getByText("Thermal Token")).toBeVisible()

      const popupHtml = await popup.content()
      expect(popupHtml).toContain("size: 80mm auto")
      expect(popupHtml).toContain("Print Token")

      const qzTokenHtml = await page.evaluate(async (popupUrl) => {
        const qzUrl = new URL(popupUrl)
        qzUrl.searchParams.set("render", "qz")
        const response = await fetch(qzUrl.toString(), { credentials: "include" })
        return response.text()
      }, popup.url())
      expect(qzTokenHtml).toContain("Queue Position")
      expect(qzTokenHtml).not.toContain("Print Token")
      expect(qzTokenHtml).not.toContain("window.print()")

      await popup.close()
    } finally {
      await cleanupRegisteredPatientByPhone(patientPhone)
    }
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
    await expect(page.getByRole("button", { name: "Refresh queue" })).toBeEnabled({ timeout: 30000 })

    const waitingRow = patientQueueCardWithAction(page, "Start")
    await expect(waitingRow).toBeVisible({ timeout: 30000 })
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

  test("manages patient insurance coverage and supporting documents", async ({ page, baseURL }) => {
    const runId = Date.now()
    const payerName = `E2E Payer ${runId}`
    const payerCode = `PAYER-${runId}`
    const policyNo = `POL-${runId}`
    const memberId = `MEM-${runId}`
    const groupNo = `GRP-${runId}`
    const planName = "Executive Inpatient"
    const verificationReference = `VR-${runId}`
    const requestReference = `REQ-${runId}`
    const authorizationReference = `AUTH-${runId}`
    const documentNotes = `E2E insurance doc ${runId}`
    const fileName = `insurance-card-${runId}.pdf`

    await cleanupInsuranceArtifacts(patientFixture.id, runId)

    try {
      await authenticateReceptionist(page, baseURL)

      await page.goto("/receptionist?section=patients")
      await expect(page.getByText("Patient List")).toBeVisible()
      await page.locator("#patient-list-search").fill(patientFixture.patient_number)
      await expect(page.getByText("Showing 1-1 of 1 patients")).toBeVisible({ timeout: 30000 })
      await page.getByRole("button", { name: /^View$/ }).click()

      const insuranceHeading = page.getByText("Insurance", { exact: true }).first()
      await expect(insuranceHeading).toBeVisible({ timeout: 60000 })
      await insuranceHeading.scrollIntoViewIfNeeded()

      await page.locator('label[for="insurance-payer-name"]').hover()
      await expect(page.getByText("Official payer, HMO, employer, or sponsor name as it appears on the card or letter.")).toBeVisible()

      await page.locator("#insurance-payer-name").fill(payerName)
      await page.locator("#insurance-payer-code").fill(payerCode)
      await page.locator("#insurance-payer-type").click()
      await page.getByRole("option", { name: "HMO", exact: true }).click()
      await page
        .locator("div")
        .filter({ hasText: /^Panel-driven coverUse this for HMOs and managed-care payers where facility network status matters\.$/ })
        .getByRole("switch")
        .click()
      await page.getByRole("button", { name: "Add Payer" }).click()

      await page.locator("#insurance-create-payer").click()
      await page.getByRole("option", { name: payerName }).click()
      await page.locator("#insurance-create-plan-name").fill(planName)
      await page.locator("#insurance-create-scheme-name").fill("Dayspring staff scheme")
      await page.locator("#insurance-create-policy-number").fill(policyNo)
      await page.locator("#insurance-create-member-id").fill(memberId)
      await page.locator("#insurance-create-group-number").fill(groupNo)
      await page.locator("#insurance-create-subscriber-name").fill(`${patientFixture.first_name} ${patientFixture.last_name}`)
      await page.locator("#insurance-create-relationship").click()
      await page.getByRole("option", { name: "Self", exact: true }).click()
      await page.locator("#insurance-create-effective-date").fill("2026-01-01")
      await page.locator("#insurance-create-expiry-date").fill("2026-12-31")
      await page.locator("#insurance-create-verification-status").click()
      await page.getByRole("option", { name: "Verified", exact: true }).click()
      await page.locator("#insurance-create-verification-reference").fill(verificationReference)
      await page.locator("#insurance-create-verification-notes").fill("Eligibility checked against payer portal.")
      await page.getByRole("switch", { name: "Authorization required" }).first().click()
      await page.locator("#insurance-create-authorization-reference").fill(authorizationReference)
      await page.locator("#insurance-create-coverage-notes").fill("Cover confirmed for consultation and basic diagnostics.")
      await page.getByRole("button", { name: "Add Policy" }).click()

      const policyCard = page.locator(`[data-policy-number="${policyNo}"]`)
      const policyTrigger = page.getByRole("button", { name: new RegExp(payerName) })
      await expect(policyTrigger).toBeVisible({ timeout: 60000 })
      await expect(page.getByText(policyNo)).toBeVisible()
      await policyTrigger.click()

      const policyVerificationTrigger = page.locator('[id^="insurance-policy-"][id$="-verification-status"]').first()
      await policyVerificationTrigger.click()
      await page.getByRole("option", { name: "Pending", exact: true }).click()
      await page.locator(`textarea[id^="insurance-policy-"][id$="-verification-notes"]`).first().fill("Awaiting payer callback for bed-cap approval.")
      await page.getByRole("button", { name: "Save changes" }).click()
      await expect(page.getByText("Pending")).toBeVisible()

      // New guided CTA should jump the user straight to the documents checklist area.
      await page.getByRole("button", { name: "Open documents checklist" }).click()
      const checklist = page.locator(`#patient-documents-checklist-${patientFixture.id}`)
      await expect(checklist).toBeVisible({ timeout: 60000 })
      await expect(checklist).toBeInViewport()

      await page.locator("#insurance-preauth-create-payer").click()
      await page.getByRole("option", { name: payerName }).click()
      await page.locator("#insurance-preauth-create-policy").click()
      await page.getByRole("option", { name: new RegExp(policyNo) }).click()
      await page.locator("#insurance-preauth-create-service-category").click()
      await page.getByRole("option", { name: "Imaging", exact: true }).click()
      await page.locator("#insurance-preauth-create-requested-service").fill("CT abdomen with contrast")
      await page.locator("#insurance-preauth-create-request-reference").fill(requestReference)
      await page.locator("#insurance-preauth-create-status").click()
      await page.getByRole("option", { name: "Approved", exact: true }).click()
      await page.locator("#insurance-preauth-create-auth-code").fill(authorizationReference)
      await page.locator("#insurance-preauth-create-valid-until").fill("2026-12-31")
      await page.locator("#insurance-preauth-create-notes").fill("Approved by payer desk for imaging package.")
      await page.getByRole("button", { name: "Add Authorization" }).click()

      const preauthRecord = page.locator('[data-preauth-id]').first()
      await expect(preauthRecord).toContainText("Approved", { timeout: 60000 })
      await expect(page.getByText("Authorization trail")).toBeVisible()

      // Use the checklist shortcut to pre-select the correct type.
      await page
        .locator("div")
        .filter({ hasText: /^Pre-authorization approval/ })
        .getByRole("button", { name: "Upload", exact: true })
        .click()
      await page.locator("#patient-document-file").setInputFiles({
        name: fileName,
        mimeType: "application/pdf",
        buffer: Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF"),
      })
      await page.locator("#patient-document-notes").fill(documentNotes)
      await page.getByRole("button", { name: "Add Document" }).click()
      const documentRow = page.locator(`[data-document-name="${fileName}"]`)
      await expect(documentRow).toBeVisible({ timeout: 60000 })
      await expect(page.getByText("On file")).toBeVisible()

      page.once("dialog", (dialog) => dialog.accept())
      await documentRow.getByRole("button", { name: "Remove" }).click()
      await expect(page.getByText(fileName)).toHaveCount(0, { timeout: 30000 })

      page.once("dialog", (dialog) => dialog.accept())
      await policyCard.getByRole("button", { name: "Remove" }).click()
      await expect(policyTrigger).toHaveCount(0)
    } finally {
      await cleanupInsuranceArtifacts(patientFixture.id, runId)
    }
  })
})
