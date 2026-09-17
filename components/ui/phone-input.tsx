"use client"

import { useState, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { COUNTRY_PHONE_FORMATS, normalizePhoneNumber, formatPhoneForDisplay } from "@/lib/phone"

export interface PhoneInputProps {
  value: string
  onChange: (value: string) => void
  label?: string
  required?: boolean
  id?: string
  className?: string
  placeholder?: string
  error?: string
  defaultCountry?: string
}

/**
 * Formats a phone number based on country code
 * Removes all non-digit characters except +
 */
function formatPhoneNumber(phone: string, countryCode: string): string {
  // Remove all non-digit characters except +
  let cleaned = phone.replace(/[^\d+]/g, "")
  
  // Remove leading + if present
  if (cleaned.startsWith("+")) {
    cleaned = cleaned.substring(1)
  }
  
  const country = COUNTRY_PHONE_FORMATS[countryCode]
  if (!country) return phone
  
  // Remove country code if it's already there
  if (cleaned.startsWith(country.code.substring(1))) {
    cleaned = cleaned.substring(country.code.length - 1)
  }
  
  // Add country code
  const formatted = country.code + cleaned
  
  // Format based on country
  if (countryCode === "UG") {
    // Format: +256 xxx xxx xxx
    if (cleaned.length > 0) {
      const digits = cleaned.match(/\d/g)?.join("") || ""
      if (digits.length <= 9) {
        return country.code + " " + digits.match(/.{1,3}/g)?.join(" ") || digits
      }
    }
  } else if (countryCode === "KE") {
    // Format: +254 xxx xxx xxx
    const digits = cleaned.match(/\d/g)?.join("") || ""
    if (digits.length <= 9) {
      return country.code + " " + digits.match(/.{1,3}/g)?.join(" ") || digits
    }
  } else if (countryCode === "US") {
    // Format: +1 (xxx) xxx-xxxx
    const digits = cleaned.match(/\d/g)?.join("") || ""
    if (digits.length === 10) {
      return `+1 (${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
    } else if (digits.length <= 10) {
      return country.code + " " + digits
    }
  }
  
  return country.code + cleaned
}

/**
 * Extracts country code from phone number
 */
function getCountryFromPhone(phone: string): string {
  for (const [country, data] of Object.entries(COUNTRY_PHONE_FORMATS)) {
    if (phone.startsWith(data.code)) {
      return country
    }
  }
  return "UG" // Default to Uganda
}

export function PhoneInput({
  value,
  onChange,
  label,
  required = false,
  id,
  className,
  placeholder,
  error,
  defaultCountry = "UG",
}: PhoneInputProps) {
  const [country, setCountry] = useState<string>(defaultCountry)
  const [displayValue, setDisplayValue] = useState<string>(value)

  useEffect(() => {
    if (value) {
      const detectedCountry = getCountryFromPhone(value)
      setCountry(detectedCountry)
      setDisplayValue(formatPhoneForDisplay(value, detectedCountry))
    } else {
      setDisplayValue("")
    }
  }, [value])

  const handleCountryChange = (newCountry: string) => {
    setCountry(newCountry)
    const countryData = COUNTRY_PHONE_FORMATS[newCountry]
    if (!countryData) {
      setDisplayValue("")
      onChange("")
      return
    }

    const digits = displayValue.replace(/\D/g, "") || value.replace(/\D/g, "") || ""
    const normalized = normalizePhoneNumber(digits, newCountry)
    const formatted = formatPhoneForDisplay(normalized, newCountry)
    setDisplayValue(formatted)
    onChange(normalizePhoneNumber(normalized, newCountry))
  }

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value
    const normalized = normalizePhoneNumber(input, country)
    const formatted = formatPhoneForDisplay(normalized, country)
    setDisplayValue(formatted)
    onChange(normalized)
  }

  const countryData = COUNTRY_PHONE_FORMATS[country]

  return (
    <div className={className}>
      {label && (
        <Label htmlFor={id} className="mb-2 block">
          {label} {required && <span className="text-destructive">*</span>}
        </Label>
      )}
      <div className="flex gap-2">
        <Select value={country} onValueChange={handleCountryChange}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(COUNTRY_PHONE_FORMATS).map(([code, data]) => (
              <SelectItem key={code} value={code}>
                {code} {data.code}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex-1">
          <Input
            id={id}
            type="tel"
            value={displayValue}
            onChange={handlePhoneChange}
            placeholder={placeholder || countryData?.example || "+256 xxx xxx xxx"}
            required={required}
            className={error ? "border-destructive" : ""}
          />
          {countryData && (
            <p className="text-xs text-muted-foreground mt-1">
              Format: {countryData.format}
            </p>
          )}
          {error && (
            <p className="text-xs text-destructive mt-1">{error}</p>
          )}
        </div>
      </div>
    </div>
  )
}
