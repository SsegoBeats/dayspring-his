const { test, expect } = require("@playwright/test")

const adminEmail = process.env.E2E_ADMIN_EMAIL
const adminPassword = process.env.E2E_ADMIN_PASSWORD

async function loginAsAdmin(page, baseURL) {
  await page.goto(`${baseURL || ""}/`)
  await page.getByLabel("Email").fill(adminEmail)
  await page.getByLabel("Password").fill(adminPassword)
  await page.getByLabel("Role").click()
  await page.getByRole("option", { name: "Hospital Admin" }).click()
  const loginResponsePromise = page.waitForResponse((response) => {
    return response.url().includes("/api/auth/login") && response.request().method() === "POST"
  })
  await page.getByRole("button", { name: "Sign In" }).click()
  const loginResponse = await loginResponsePromise
  expect(loginResponse.ok()).toBeTruthy()
  await page.waitForURL(/\/dashboard$|\/admin(?:\?.*)?$/, { timeout: 30000 })
  if (!/\/admin(?:\?.*)?$/.test(page.url())) {
    await page.goto(`${baseURL || ""}/admin`)
  }
  await expect(page).toHaveURL(/\/admin(?:\?.*)?$/)
}

test.describe("Admin portal smoke", () => {
  test.describe.configure({ timeout: 180000 })

  test.beforeEach(async ({ page, baseURL }) => {
    test.skip(!adminEmail || !adminPassword, "Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD to run admin smoke tests.")
    await loginAsAdmin(page, baseURL)
  })

  test("loads the dashboard and drills from overview into patient management", async ({ page }) => {
    await expect(page.getByText("Hospital Command Center")).toBeVisible()
    await expect(page.getByText("Export Studio")).toBeVisible()
    await expect(page.getByText("Department Status")).toBeVisible()
    await expect(page.getByText("Staff Active (24h)")).toBeVisible()
    await page.getByRole("button", { name: /Total Patients/i }).click()
    await expect(page).toHaveURL(/\/admin\?section=patients/)
    await expect(page.getByText("Patient Management")).toBeVisible()
  })

  test("quick actions scroll the selected workspace into view", async ({ page }) => {
    await page.getByRole("button", { name: /Open user directory/i }).click()
    await expect(page).toHaveURL(/\/admin\?section=users/)

    const heading = page.getByRole("heading", { name: "User Management", exact: true })
    await expect(heading).toBeVisible()
    await expect
      .poll(async () => {
        const box = await heading.boundingBox()
        return box ? box.y : null
      })
      .toBeLessThan(220)

    await page.goBack()
    await expect(page).toHaveURL(/\/admin(?:\?.*)?$/)
    await expect(page).not.toHaveURL(/section=users/)
    await expect(page.getByText("Hospital Command Center")).toBeVisible()
  })

  test("audit quick action opens audit trail without tripping the dashboard error boundary", async ({ page }) => {
    await page.getByRole("button", { name: /Check audit trail/i }).click()
    await expect(page).toHaveURL(/\/admin\?section=audit/)
    await expect(page.getByRole("heading", { name: "Audit Trail", exact: true })).toBeVisible()
    await expect(page.getByText("Loading audit logs...")).not.toBeVisible({ timeout: 30000 })
    await expect(page.getByText("Dashboard error")).not.toBeVisible()
  })

  test("respects finance deep links for period and tab routing", async ({ page, baseURL }) => {
    await page.goto(`${baseURL || ""}/admin?section=financial&financialPeriod=90days&financialTab=departments`)
    await expect(page).toHaveURL(/\/admin\?section=financial&financialPeriod=90days&financialTab=departments/)
    await expect(page.getByRole("heading", { name: "Financial Reports", exact: true })).toBeVisible()
    await expect(page.getByText("Loading financial data...")).not.toBeVisible({ timeout: 30000 })
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
