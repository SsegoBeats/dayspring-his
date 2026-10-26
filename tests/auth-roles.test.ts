const authRoleTest = require("node:test")
const authRoleAssert = require("node:assert/strict")
const { isSupportedRole, normalizeRole, VALID_ROLE_VALUES } = require("../lib/auth-roles")

authRoleTest("accepts known roles and rejects unknown ones", () => {
  authRoleAssert.equal(isSupportedRole("Receptionist"), true)
  authRoleAssert.equal(isSupportedRole("Nurse"), true)
  authRoleAssert.equal(isSupportedRole("Super Admin"), false)
  authRoleAssert.equal(normalizeRole("Hospital Admin"), "Hospital Admin")
  authRoleAssert.equal(normalizeRole("Unknown Role"), null)
  authRoleAssert.ok(VALID_ROLE_VALUES.includes("Clinician"))
})
