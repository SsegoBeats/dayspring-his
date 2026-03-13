const { test, expect } = require("@playwright/test")

const receptionistEmail = process.env.E2E_RECEPTIONIST_EMAIL
const receptionistPassword = process.env.E2E_RECEPTIONIST_PASSWORD

async function loginAsReceptionist(page, baseURL) {
  await page.goto(`${baseURL || ""}/`)
  await page.getByLabel("Email").fill(receptionistEmail)
  await page.getByLabel("Password").fill(receptionistPassword)
  await page.getByLabel("Role").click()
  await page.getByRole("option", { name: "Receptionist" }).click()
  await page.getByRole("button", { name: "Sign In" }).click()
  await expect(page).toHaveURL(/\/dashboard$|\/receptionist(?:\?.*)?$/)
  await page.goto(`${baseURL || ""}/receptionist`)
  await expect(page).toHaveURL(/\/receptionist(?:\?.*)?$/)
}

test.describe("Reception portal smoke", () => {
  test.beforeEach(async ({ page, baseURL }) => {
    test.skip(!receptionistEmail || !receptionistPassword, "Set E2E_RECEPTIONIST_EMAIL and E2E_RECEPTIONIST_PASSWORD to run reception smoke tests.")
    await loginAsReceptionist(page, baseURL)
  })

  test("loads the dashboard hero and routes into the queue board", async ({ page }) => {
    await expect(page.getByText("Reception Command Desk")).toBeVisible()
    await page.getByRole("tab", { name: "Queue" }).click()
    await expect(page).toHaveURL(/\/receptionist\?section=queue/)
    await expect(page.getByText("Department Queue")).toBeVisible()
  })

  test("opens receptionist settings with portal-home options for reception workflows", async ({ page, baseURL }) => {
    await page.goto(`${baseURL || ""}/receptionist/settings`)
    await expect(page).toHaveURL(/\/receptionist\/settings$/)
    await expect(page.getByText("Receptionist Settings")).toBeVisible()
    await page.getByLabel("Portal Home").click()
    await expect(page.getByRole("option", { name: "Patient Register" })).toBeVisible()
    await expect(page.getByRole("option", { name: "Check-In Desk" })).toBeVisible()
    await expect(page.getByRole("option", { name: "Queue Board" })).toBeVisible()
    await expect(page.getByRole("option", { name: "Payments" })).toBeVisible()
    await expect(page.getByRole("option", { name: "Reports" })).toBeVisible()
  })

  test("loads the payments tab and receptionist reports surface", async ({ page, baseURL }) => {
    await page.goto(`${baseURL || ""}/receptionist?section=payments`)
    await expect(page.getByText("Payments")).toBeVisible()
    await expect(page.getByRole("button", { name: "CSV" })).toBeVisible()
    await expect(page.getByRole("button", { name: "XLSX" })).toBeVisible()
    await expect(page.getByRole("button", { name: "PDF" })).toBeVisible()

    await page.goto(`${baseURL || ""}/receptionist?section=reports`)
    await expect(page.getByText("Reception Register")).toBeVisible()
    await expect(page.getByRole("button", { name: "Export All PDFs" })).toBeVisible()
  })

  test("opens the patient register from the overview quick action", async ({ page }) => {
    await page.getByRole("button", { name: /Open patient register/i }).click()
    await expect(page).toHaveURL(/\/receptionist\?section=patients/)
    await expect(page.getByText("Patient List")).toBeVisible()
  })
})
