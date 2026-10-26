require("ts-node/register/transpile-only")

const test = require("node:test")
const assert = require("node:assert/strict")
const { normalizePhoneNumber, isValidPhoneNumber } = require("../lib/phone.ts")

test("empty patient phone is treated as optional", () => {
  assert.equal(normalizePhoneNumber("", "UG"), "")
  assert.equal(normalizePhoneNumber("   ", "UG"), "")
  assert.equal(normalizePhoneNumber(null, "UG"), "")
  assert.equal(isValidPhoneNumber(""), false)
  assert.equal(isValidPhoneNumber("   "), false)
  assert.equal(isValidPhoneNumber(null), false)
  assert.equal(isValidPhoneNumber("+256700123456"), true)
  assert.equal(isValidPhoneNumber("  +256700123456  "), true)
})
