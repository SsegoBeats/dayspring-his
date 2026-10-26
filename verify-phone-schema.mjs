// Quick verification of OptionalPhoneSchema behavior
// Run: node verify-phone-schema.mjs

import { z } from 'zod';

// Simplified versions of the phone utilities for testing
const normalizePhoneNumber = (phone, countryCode = "UG") => {
  if (!phone) return null;
  const cleaned = phone.replace(/\D/g, '');
  if (!cleaned) return null;
  
  // Add country code if not present
  if (!cleaned.startsWith(countryCode === "UG" ? "256" : "")) {
    // For testing, just return a valid E.164 format
    return `+256${cleaned.slice(-9)}`;
  }
  return `+${cleaned}`;
};

const isValidPhoneNumber = (phone) => {
  if (!phone) return false;
  // Simple validation: must start with + and have 10-15 digits
  const cleaned = phone.replace(/\D/g, '');
  return cleaned.length >= 9 && cleaned.length <= 15;
};

// Define schemas exactly as in the codebase
const PhoneSchema = z.string()
  .transform((value) => normalizePhoneNumber(value, "UG"))
  .refine((value) => isValidPhoneNumber(value), {
    message: "Phone must be a valid international number with country code (e.g., +256700123456)",
  });

const OptionalPhoneSchema = z.preprocess((value) => {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}, PhoneSchema.nullable());

// TEST 1: Create patient with NO phone (phone: null)
console.log("\n=== TEST 1: Create patient with NO phone ===");
try {
  const result = OptionalPhoneSchema.parse(null);
  console.log("✅ PASS: phone: null → accepted");
  console.log(`   Result: ${result}`);
} catch (e) {
  console.log(`❌ FAIL: ${e.message}`);
}

// TEST 1b: Create patient with NO phone (phone: "")
console.log("\n=== TEST 1b: Create patient with empty string phone ===");
try {
  const result = OptionalPhoneSchema.parse("");
  console.log("✅ PASS: phone: '' → accepted");
  console.log(`   Result: ${result}`);
} catch (e) {
  console.log(`❌ FAIL: ${e.message}`);
}

// TEST 2: Create with invalid phone (malformed)
console.log("\n=== TEST 2: Create with invalid phone ===");
try {
  const result = OptionalPhoneSchema.parse("abc123");
  console.log(`❌ FAIL: Invalid phone was accepted (should have failed)`);
  console.log(`   Result: ${result}`);
} catch (e) {
  console.log("✅ PASS: Invalid phone rejected");
  console.log(`   Error: ${e.errors[0].message}`);
}

// TEST 3: PATCH with phone: null (clearing existing phone)
console.log("\n=== TEST 3: PATCH with phone: null ===");
try {
  const safeParse = OptionalPhoneSchema.safeParse(null);
  if (safeParse.success) {
    console.log("✅ PASS: phone: null parsed successfully");
    console.log(`   Result: ${safeParse.data}`);
  } else {
    console.log(`❌ FAIL: ${safeParse.error.message}`);
  }
} catch (e) {
  console.log(`❌ FAIL: ${e.message}`);
}

// TEST 4: Valid phone
console.log("\n=== TEST 4: Valid phone number ===");
try {
  const result = OptionalPhoneSchema.parse("0700123456");
  console.log("✅ PASS: Valid phone accepted");
  console.log(`   Normalized: ${result}`);
} catch (e) {
  console.log(`❌ FAIL: ${e.message}`);
}

console.log("\n=== ALL TESTS COMPLETE ===\n");
