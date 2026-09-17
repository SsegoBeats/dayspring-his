export const COUNTRY_PHONE_FORMATS: Record<string, { code: string; format: string; example: string; pattern: RegExp; nationalLength: number }> = {
  UG: { code: "+256", format: "+256 xxx xxx xxx", example: "+256 700 123 456", pattern: /^\+256\d{9}$/, nationalLength: 9 },
  KE: { code: "+254", format: "+254 xxx xxx xxx", example: "+254 712 123 456", pattern: /^\+254\d{9}$/, nationalLength: 9 },
  TZ: { code: "+255", format: "+255 xxx xxx xxx", example: "+255 712 123 456", pattern: /^\+255\d{9}$/, nationalLength: 9 },
  RW: { code: "+250", format: "+250 xxx xxx xxx", example: "+250 788 123 456", pattern: /^\+250\d{9}$/, nationalLength: 9 },
  SS: { code: "+211", format: "+211 xxx xxx xxx", example: "+211 977 123 456", pattern: /^\+211\d{9}$/, nationalLength: 9 },
  ET: { code: "+251", format: "+251 xxx xxx xxx", example: "+251 911 123 456", pattern: /^\+251\d{9}$/, nationalLength: 9 },
  US: { code: "+1", format: "+1 (xxx) xxx-xxxx", example: "+1 (202) 555-1234", pattern: /^\+1\d{10}$/, nationalLength: 10 },
  GB: { code: "+44", format: "+44 xxxx xxxxxx", example: "+44 20 7123 4567", pattern: /^\+44\d{10,11}$/, nationalLength: 10 },
}

export function isValidPhoneNumber(input?: string | null): boolean {
  if (!input) return false
  const normalized = normalizePhoneNumber(input)
  if (!normalized) return false
  return Object.values(COUNTRY_PHONE_FORMATS).some((info) => info.pattern.test(normalized))
}

export function normalizePhoneNumber(input?: string | null, defaultCountry = "UG"): string {
  if (!input) return ""

  const raw = String(input).trim()
  if (!raw) return ""

  const digitsOnly = raw.replace(/\D/g, "")
  if (!digitsOnly) return ""

  const defaultInfo = COUNTRY_PHONE_FORMATS[defaultCountry] ?? COUNTRY_PHONE_FORMATS.UG
  const countryCodeMap = Object.entries(COUNTRY_PHONE_FORMATS)
  const detectedCountry = countryCodeMap.find(([, info]) => raw.startsWith(info.code))
  const countryCode = detectedCountry?.[1]?.code ?? defaultInfo.code
  const countryDigits = countryCode.replace("+", "")

  let national = digitsOnly

  if (digitsOnly.startsWith(countryDigits)) {
    national = digitsOnly.slice(countryDigits.length)
  } else if (digitsOnly.startsWith("0") && countryCode !== "+1") {
    national = digitsOnly.replace(/^0+/, "")
  }

  if (countryCode === "+1") {
    if (digitsOnly.length === 10) return `${countryCode}${digitsOnly}`
    if (digitsOnly.length > 10) return `${countryCode}${digitsOnly.slice(-10)}`
  }

  if (countryCode !== "+1") {
    const digits = national.replace(/^0+/, "")
    if (digits.length === 0) return countryCode
    return `${countryCode}${digits}`
  }

  return `${countryCode}${national}`
}

export function formatPhoneForDisplay(input?: string | null, defaultCountry = "UG"): string {
  const normalized = normalizePhoneNumber(input, defaultCountry)
  if (!normalized) return "-"

  const match = Object.entries(COUNTRY_PHONE_FORMATS).find(([, info]) => normalized.startsWith(info.code))
  if (!match) return normalized

  const [, info] = match
  const digits = normalized.replace(/\D/g, "")
  const national = digits.slice(info.code.replace("+", "").length).replace(/^0+/, "")

  if (info.code === "+1") {
    if (national.length === 10) {
      return `${info.code} (${national.slice(0, 3)}) ${national.slice(3, 6)}-${national.slice(6)}`
    }
    return `${info.code} ${national}`
  }

  if (national.length <= 3) return `${info.code} ${national}`
  const groups = national.match(/.{1,3}/g) ?? [national]
  return `${info.code} ${groups.join(" ")}`
}
