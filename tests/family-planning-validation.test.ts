require("ts-node/register/transpile-only")

const familyPlanningTest = require("node:test")
const familyPlanningAssert = require("node:assert/strict")

const {
  isMethodRequired,
  isRemovalEvent,
  validateRemovalPayload,
  resolveEventStatus,
} = require("../lib/family-planning-validation.ts")

familyPlanningTest("requires method for method_removal", () => {
  familyPlanningAssert.equal(isMethodRequired("method_removal"), true)
  familyPlanningAssert.equal(isMethodRequired("follow_up"), false)
})

familyPlanningTest("detects method removal events", () => {
  familyPlanningAssert.equal(isRemovalEvent("method_removal"), true)
  familyPlanningAssert.equal(isRemovalEvent("discontinuation"), false)
})

familyPlanningTest("requires removal reason for method removal", () => {
  familyPlanningAssert.equal(validateRemovalPayload("method_removal", ""), "removalReason is required for method removal")
  familyPlanningAssert.equal(validateRemovalPayload("method_removal", "Client choice"), null)
  familyPlanningAssert.equal(validateRemovalPayload("follow_up", ""), null)
})

familyPlanningTest("forces discontinued status for method removal", () => {
  familyPlanningAssert.equal(resolveEventStatus("method_removal", "active"), "discontinued")
  familyPlanningAssert.equal(resolveEventStatus("continuation", "active"), "active")
  familyPlanningAssert.equal(resolveEventStatus("follow_up", null), null)
})
