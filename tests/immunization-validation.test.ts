require("ts-node/register/transpile-only")

const immunizationValidationTest = require("node:test")
const immunizationValidationAssert = require("node:assert/strict")
const {
  alignStatusWithDueDate,
  validateStatusRules,
  validateOtherVaccineReason,
} = require("../lib/immunization-validation.ts")

immunizationValidationTest("requires reason for Refused", () => {
  const err = validateStatusRules("Refused", { dateAdministered: "2026-09-10" }, null)
  immunizationValidationAssert.equal(err, "A reason is required when status is Refused")
})

immunizationValidationTest("requires reason for Contraindicated", () => {
  const err = validateStatusRules("Contraindicated", { dateAdministered: "2026-09-10" }, "")
  immunizationValidationAssert.equal(err, "A reason is required when status is Contraindicated")
})

immunizationValidationTest("requires reason for Not Given", () => {
  const err = validateStatusRules("Not Given", { dateAdministered: "2026-09-10" }, undefined)
  immunizationValidationAssert.equal(err, "A reason is required when status is Not Given")
})

immunizationValidationTest("rejects overdue date before due date", () => {
  const err = validateStatusRules("Due", { dateAdministered: "2026-09-10", nextDueDate: "2026-09-20", overdueDate: "2026-09-19" }, null)
  immunizationValidationAssert.equal(err, "Due status cannot have a nextDueDate earlier than today")
})

immunizationValidationTest("rejects next due date before administered date", () => {
  const err = validateStatusRules("Given", { dateAdministered: "2026-09-20", nextDueDate: "2026-09-19" }, null)
  immunizationValidationAssert.equal(err, "nextDueDate cannot be earlier than dateAdministered")
})

immunizationValidationTest("accepts valid Given record", () => {
  const err = validateStatusRules("Given", { dateAdministered: "2026-09-20", nextDueDate: "2026-10-20", overdueDate: "2026-10-20" }, null)
  immunizationValidationAssert.equal(err, null)
})

immunizationValidationTest("accepts Due record without administration date", () => {
  const err = validateStatusRules("Due", { nextDueDate: "2026-10-20" }, null, "2026-10-02")
  immunizationValidationAssert.equal(err, null)
})

immunizationValidationTest("rejects future administration date for Given", () => {
  const err = validateStatusRules("Given", { dateAdministered: "2026-10-03" }, null, "2026-10-02")
  immunizationValidationAssert.equal(err, "dateAdministered cannot be in the future")
})

immunizationValidationTest("rejects overdue status when next due date is not in the past", () => {
  const err = validateStatusRules("Overdue", { nextDueDate: "2026-10-02" }, null, "2026-10-02")
  immunizationValidationAssert.equal(err, "Overdue status requires a nextDueDate earlier than today")
})

immunizationValidationTest("rejects due status when next due date is already past", () => {
  const err = validateStatusRules("Due", { nextDueDate: "2026-10-01" }, null, "2026-10-02")
  immunizationValidationAssert.equal(err, "Due status cannot have a nextDueDate earlier than today")
})

immunizationValidationTest("aligns Due/Overdue status based on due date", () => {
  immunizationValidationAssert.equal(alignStatusWithDueDate("Overdue", "2026-10-10", "2026-10-02"), "Due")
  immunizationValidationAssert.equal(alignStatusWithDueDate("Due", "2026-09-30", "2026-10-02"), "Overdue")
  immunizationValidationAssert.equal(alignStatusWithDueDate("Given", "2026-09-30", "2026-10-02"), "Given")
})

immunizationValidationTest("requires reason for other vaccine entries", () => {
  const err = validateOtherVaccineReason(true, "")
  immunizationValidationAssert.equal(err, "otherVaccineReason is required when isOtherVaccine is true")
  immunizationValidationAssert.equal(validateOtherVaccineReason(true, "Outbreak response"), null)
  immunizationValidationAssert.equal(validateOtherVaccineReason(false, ""), null)
})
