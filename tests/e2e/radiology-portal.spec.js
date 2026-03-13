const { test, expect } = require("@playwright/test")

const radiologistEmail = process.env.E2E_RADIOLOGIST_EMAIL
const radiologistPassword = process.env.E2E_RADIOLOGIST_PASSWORD
const uploadPatientQuery = process.env.E2E_RADIOLOGY_UPLOAD_PATIENT_QUERY
const uploadFilePath = process.env.E2E_RADIOLOGY_UPLOAD_FILE

async function loginAsRadiologist(page, baseURL) {
  await page.goto(`${baseURL || ""}/`)
  await page.getByLabel("Email").fill(radiologistEmail)
  await page.getByLabel("Password").fill(radiologistPassword)
  await page.getByLabel("Role").click()
  await page.getByRole("option", { name: "Radiologist" }).click()
  await page.getByRole("button", { name: "Sign In" }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
  await page.goto(`${baseURL || ""}/radiologist`)
  await expect(page).toHaveURL(/\/radiologist$/)
}

test.describe("Radiology portal smoke", () => {
  test.beforeEach(async ({ page, baseURL }) => {
    test.skip(!radiologistEmail || !radiologistPassword, "Set E2E_RADIOLOGIST_EMAIL and E2E_RADIOLOGIST_PASSWORD to run radiology smoke tests.")
    await loginAsRadiologist(page, baseURL)
  })

  test("loads the dashboard, worklist, and export surface", async ({ page }) => {
    await expect(page.getByText("Radiology Command Desk")).toBeVisible()
    await expect(page.getByRole("button", { name: "Create Study" })).toBeVisible()
    await expect(page.getByRole("button", { name: "Upload External Imaging" })).toBeVisible()
    await expect(page.getByText("Radiology Worklist")).toBeVisible()
    await expect(page.getByRole("button", { name: "CSV" })).toBeVisible()
    await expect(page.getByRole("button", { name: "Excel" })).toBeVisible()
    await expect(page.getByRole("button", { name: "PDF" })).toBeVisible()
  })

  test("opens radiologist settings with radiology-specific defaults", async ({ page }) => {
    await page.getByRole("link", { name: "Portal settings" }).click()
    await expect(page).toHaveURL(/\/radiologist\/settings$/)
    await expect(page.getByText("Radiologist Settings")).toBeVisible()
    await expect(page.getByLabel("Portal Home")).toBeVisible()
    await page.getByLabel("Portal Home").click()
    await expect(page.getByRole("option", { name: "Radiology Worklist" })).toBeVisible()
    await expect(page.getByRole("option", { name: "Radiology Analytics" })).toBeVisible()
    await expect(page.getByRole("option", { name: "Radiology Exports" })).toBeVisible()
  })

  test("opens a study from the worklist when data exists", async ({ page }) => {
    const openStudyButtons = page.getByRole("button", { name: /Open Study|View Report/ })
    test.skip((await openStudyButtons.count()) === 0, "No radiology study is available in the current dataset.")
    await openStudyButtons.first().click()
    await expect(page.getByRole("button", { name: "Back to Worklist" })).toBeVisible()
    await expect(page.getByText("Radiologist Findings")).toBeVisible()
  })

  test("uploads an external study attachment when fixture inputs are provided", async ({ page }) => {
    test.skip(!uploadPatientQuery || !uploadFilePath, "Set E2E_RADIOLOGY_UPLOAD_PATIENT_QUERY and E2E_RADIOLOGY_UPLOAD_FILE to run upload smoke coverage.")
    await page.getByRole("button", { name: "Upload External Imaging" }).click()
    await expect(page.getByText("Upload External Imaging")).toBeVisible()
    await page.getByPlaceholder("Search by patient name, P.ID, or phone").last().fill(uploadPatientQuery)
    await page.locator("button").filter({ hasText: uploadPatientQuery }).first().click()
    await page.getByLabel("Attachment File").setInputFiles(uploadFilePath)
    await page.getByRole("button", { name: "Upload Imaging" }).click()
    await expect(page.getByText(/attachment uploaded and linked/i)).toBeVisible()
  })
})
