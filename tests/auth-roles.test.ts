const test = require("node:test")
const assert = require("node:assert/strict")
const { isSupportedRole, normalizeRole, VALID_ROLE_VALUES } = require("../lib/auth-roles")

test("accepts known roles and rejects unknown ones", () => {
  assert.equal(isSupportedRole("Receptionist"), true)
  assert.equal(isSupportedRole("Nurse"), true)
  assert.equal(isSupportedRole("Super Admin"), false)
  assert.equal(normalizeRole("Hospital Admin"), "Hospital Admin")
  assert.equal(normalizeRole("Unknown Role"), null)
  assert.ok(VALID_ROLE_VALUES.includes("Clinician"))
})
