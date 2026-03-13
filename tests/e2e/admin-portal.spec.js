const { test, expect } = require("@playwright/test")

const adminEmail = process.env.E2E_ADMIN_EMAIL
const adminPassword = process.env.E2E_ADMIN_PASSWORD

async function loginAsAdmin(page, baseURL) {
  await page.goto(`${baseURL || ""}/`)
  await page.getByLabel("Email").fill(adminEmail)
  await page.getByLabel("Password").fill(adminPassword)
  await page.getByLabel("Role").click()
  await page.getByRole("option", { name: "Hospital Admin" }).click()
  await page.getByRole("button", { name: "Sign In" }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
  await page.goto(`${baseURL || ""}/admin`)
  await expect(page).toHaveURL(/\/admin(?:\?.*)?$/)
}

test.describe("Admin portal smoke", () => {
  test.beforeEach(async ({ page, baseURL }) => {
    test.skip(!adminEmail || !adminPassword, "Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD to run admin smoke tests.")
    await loginAsAdmin(page, baseURL)
  })

  test("loads the dashboard and drills from overview into patient management", async ({ page }) => {
    await expect(page.getByText("Hospital Command Center")).toBeVisible()
    await expect(page.getByText("Export Studio")).toBeVisible()
    await page.getByRole("button", { name: /Total Patients/i }).click()
    await expect(page).toHaveURL(/\/admin\?section=patients/)
    await expect(page.getByText("Patient Management")).toBeVisible()
  })

  test("respects finance deep links for period and tab routing", async ({ page, baseURL }) => {
    await page.goto(`${baseURL || ""}/admin?section=financial&financialPeriod=90days&financialTab=departments`)
    await expect(page).toHaveURL(/\/admin\?section=financial&financialPeriod=90days&financialTab=departments/)
    await expect(page.getByText("Financial Reports")).toBeVisible()
    await expect(page.getByRole("button", { name: "90 Days" })).toBeVisible()
    await expect(page.getByText("Revenue by Department")).toBeVisible()
  })

  test("opens admin settings with admin-specific portal home options", async ({ page, baseURL }) => {
    await page.goto(`${baseURL || ""}/admin/settings`)
    await expect(page).toHaveURL(/\/admin\/settings$/)
    await expect(page.getByText("Admin Settings")).toBeVisible()
    await page.getByLabel("Portal Home").click()
    await expect(page.getByRole("option", { name: "User Management" })).toBeVisible()
    await expect(page.getByRole("option", { name: "Bed Management" })).toBeVisible()
    await expect(page.getByRole("option", { name: "Patient Management" })).toBeVisible()
    await expect(page.getByRole("option", { name: "Financial Reports" })).toBeVisible()
    await expect(page.getByRole("option", { name: "Audit Trail" })).toBeVisible()
    await expect(page.getByRole("option", { name: "Non-Medication Inventory" })).toBeVisible()
  })

  test("keeps user-directory filters synced to the URL", async ({ page, baseURL }) => {
    await page.goto(`${baseURL || ""}/admin?section=users&userStatus=inactive`)
    await expect(page.getByText("Search & Filter Users")).toBeVisible()
    await expect(page.getByRole("button", { name: /Status.*inactive/i })).toBeVisible()
    await page.getByRole("button", { name: "Clear All" }).click()
    await expect(page).toHaveURL(/\/admin\?section=users$/)
  })
})
