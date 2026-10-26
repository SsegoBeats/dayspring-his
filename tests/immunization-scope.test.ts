require("ts-node/register/transpile-only")

const immunizationScopeTest = require("node:test")
const immunizationScopeAssert = require("node:assert/strict")

const { matchesFacilityScope, canUpdateImmunizationRecord } = require("../lib/immunization-access")

immunizationScopeTest("rejects cross-facility access for non-admin users", () => {
  immunizationScopeAssert.equal(matchesFacilityScope("FAC-1", "FAC-2"), false)
  immunizationScopeAssert.equal(matchesFacilityScope("FAC-1", "FAC-1"), true)
  immunizationScopeAssert.equal(matchesFacilityScope(null, "FAC-2"), true)
})

immunizationScopeTest("rejects ownership mismatch on record updates", () => {
  immunizationScopeAssert.equal(canUpdateImmunizationRecord({ id: "u-1", role: "Midwife" }, "u-2", "FAC-1", "FAC-1"), false)
  immunizationScopeAssert.equal(canUpdateImmunizationRecord({ id: "u-1", role: "Midwife" }, "u-1", "FAC-1", "FAC-1"), true)
  immunizationScopeAssert.equal(canUpdateImmunizationRecord({ id: "u-1", role: "Hospital Admin" }, "u-2", "FAC-1", "FAC-2"), true)
})
