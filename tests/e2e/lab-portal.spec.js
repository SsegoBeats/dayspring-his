const { test, expect } = require("@playwright/test")

const labEmail = process.env.E2E_LAB_TECH_EMAIL
const labPassword = process.env.E2E_LAB_TECH_PASSWORD

async function loginAsLabTech(page, baseURL) {
  await page.goto(`${baseURL || ""}/`)
  await page.getByLabel("Email").fill(labEmail)
  await page.getByLabel("Password").fill(labPassword)
  await page.getByLabel("Role").click()
  await page.getByRole("option", { name: "Lab Technician" }).click()
  await page.getByRole("button", { name: "Sign In" }).click()
  await expect(page).toHaveURL(/\/lab-tech$|\/dashboard$/)
  await page.goto(`${baseURL || ""}/lab-tech`)
  await expect(page).toHaveURL(/\/lab-tech$/)
}

test.describe("Lab portal smoke", () => {
  test.beforeEach(async ({ page, baseURL }) => {
    test.skip(!labEmail || !labPassword, "Set E2E_LAB_TECH_EMAIL and E2E_LAB_TECH_PASSWORD to run lab smoke tests.")
    await loginAsLabTech(page, baseURL)
  })

  test("loads the dashboard, queue, analytics, and export surface", async ({ page }) => {
    await expect(page.getByText("Lab Operations Hub")).toBeVisible()
    await expect(page.getByText("Turnaround Analytics")).toBeVisible()
    await expect(page.getByText("Laboratory Queue")).toBeVisible()
    await expect(page.getByRole("button", { name: /Worklist XLSX|Worklist CSV|Worklist PDF/ })).toBeVisible()
    await expect(page.getByRole("button", { name: /Analytes XLSX|Analytes CSV|Analytes PDF/ })).toBeVisible()
    await expect(page.getByRole("button", { name: "Batch Print Results" })).toBeVisible()
  })

  test("opens lab settings with lab-specific portal home options", async ({ page, baseURL }) => {
    await page.goto(`${baseURL || ""}/lab-tech/settings`)
    await expect(page).toHaveURL(/\/lab-tech\/settings$/)
    await expect(page.getByText("Lab Technician Settings")).toBeVisible()
    await page.getByLabel("Portal Home").click()
    await expect(page.getByRole("option", { name: "Pending Queue" })).toBeVisible()
    await expect(page.getByRole("option", { name: "Analytics" })).toBeVisible()
    await expect(page.getByRole("option", { name: "Exports" })).toBeVisible()
  })

  test("opens a lab order from the queue when data exists", async ({ page }) => {
    const processButtons = page.getByRole("button", { name: "Process" })
    test.skip((await processButtons.count()) === 0, "No lab orders are available in the current dataset.")
    await processButtons.first().click()
    await expect(page.getByRole("button", { name: "Back to Queue" })).toBeVisible()
    await expect(page.getByText("Analyzer Attachments")).toBeVisible()
  })
})
