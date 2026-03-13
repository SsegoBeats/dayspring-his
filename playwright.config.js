const fs = require("fs")
const os = require("os")
const path = require("path")
const dotenv = require("dotenv")
const { defineConfig, devices } = require("@playwright/test")

dotenv.config({ path: path.join(__dirname, ".env") })
dotenv.config({ path: path.join(__dirname, ".env.local"), override: true })

const baseURL = process.env.E2E_BASE_URL || "http://localhost:3000"

function chromiumSearchRoots() {
  if (process.platform === "win32") {
    return [path.join(os.homedir(), "AppData", "Local", "ms-playwright")]
  }
  if (process.platform === "darwin") {
    return [path.join(os.homedir(), "Library", "Caches", "ms-playwright")]
  }
  return [path.join(os.homedir(), ".cache", "ms-playwright")]
}

function chromiumExecutableCandidates(root, dirName) {
  if (process.platform === "win32") {
    return [
      path.join(root, dirName, "chrome-win64", "chrome.exe"),
      path.join(root, dirName, "chrome-win", "chrome.exe"),
    ]
  }
  if (process.platform === "darwin") {
    return [path.join(root, dirName, "chrome-mac", "Chromium.app", "Contents", "MacOS", "Chromium")]
  }
  return [path.join(root, dirName, "chrome-linux", "chrome")]
}

function findChromiumExecutable() {
  if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) {
    return process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
  }

  for (const root of chromiumSearchRoots()) {
    if (!fs.existsSync(root)) continue
    const dirs = fs
      .readdirSync(root, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && entry.name.startsWith("chromium-"))
      .sort((a, b) => b.name.localeCompare(a.name))

    for (const dir of dirs) {
      for (const candidate of chromiumExecutableCandidates(root, dir.name)) {
        if (fs.existsSync(candidate)) return candidate
      }
    }
  }

  return undefined
}

const chromiumExecutablePath = findChromiumExecutable()

module.exports = defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        ...(chromiumExecutablePath
          ? {
              launchOptions: {
                executablePath: chromiumExecutablePath,
              },
            }
          : {}),
      },
    },
  ],
  webServer: process.env.PLAYWRIGHT_SKIP_WEBSERVER
    ? undefined
    : {
        command: "npm run dev",
        url: baseURL,
        reuseExistingServer: true,
        timeout: 120_000,
      },
})
