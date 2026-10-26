require("ts-node/register/transpile-only")

const immunizationScheduleTest = require("node:test")
const immunizationScheduleAssert = require("node:assert/strict")

const {
  deriveStatus,
  computeDueDateFromDob,
  computeOverdueDate,
  isImmunizationStatus,
  TIMING_BUCKETS,
} = require("../lib/immunization-schedule.ts")

immunizationScheduleTest("includes all requested childhood immunization stages", () => {
  immunizationScheduleAssert.deepEqual(TIMING_BUCKETS.slice(0, 17), [
    "At Birth",
    "6 Weeks",
    "10 Weeks",
    "14 Weeks",
    "6 Months",
    "7 Months",
    "8 Months",
    "9 Months",
    "1 Year",
    "1½ Years",
    "2 Years",
    "2½ Years",
    "3 Years",
    "3½ Years",
    "4 Years",
    "4½ Years",
    "5 Years",
  ])
})

immunizationScheduleTest("deriveStatus prioritizes explicit valid status", () => {
  immunizationScheduleAssert.equal(deriveStatus("Refused", "2026-09-01", "2026-09-15", "2026-09-20"), "Refused")
})

immunizationScheduleTest("deriveStatus infers Overdue when due date passed and no explicit status", () => {
  immunizationScheduleAssert.equal(deriveStatus(undefined, undefined, "2026-09-10", "2026-09-12"), "Overdue")
})

immunizationScheduleTest("deriveStatus infers Given when date administered exists", () => {
  immunizationScheduleAssert.equal(deriveStatus(undefined, "2026-09-11", "2026-09-20", "2026-09-12"), "Given")
})

immunizationScheduleTest("computeDueDateFromDob returns expected date for schedule bucket", () => {
  immunizationScheduleAssert.equal(computeDueDateFromDob("2026-01-01", "6 Weeks"), "2026-02-12")
})

immunizationScheduleTest("computeDueDateFromDob supports the updated timing labels", () => {
  immunizationScheduleAssert.equal(computeDueDateFromDob("2026-01-01", "1 Year"), "2027-01-01")
  immunizationScheduleAssert.equal(computeDueDateFromDob("2026-01-01", "1½ Years"), "2027-07-03")
  immunizationScheduleAssert.equal(computeDueDateFromDob("2026-01-01", "4½ Years"), "2030-07-02")
})

immunizationScheduleTest("computeDueDateFromDob returns null for unsupported bucket", () => {
  immunizationScheduleAssert.equal(computeDueDateFromDob("2026-01-01", "Unknown"), null)
})

immunizationScheduleTest("computeOverdueDate applies grace days", () => {
  immunizationScheduleAssert.equal(computeOverdueDate("2026-01-10", 7), "2026-01-17")
})

immunizationScheduleTest("isImmunizationStatus validates allowed enum values", () => {
  immunizationScheduleAssert.equal(isImmunizationStatus("Due"), true)
  immunizationScheduleAssert.equal(isImmunizationStatus("Invalid"), false)
})
