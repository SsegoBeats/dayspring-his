"use client"

import { useState, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"

// Country codes and phone formats for East Africa and common countries
export const COUNTRY_PHONE_FORMATS: Record<string, { code: string; format: string; example: string; pattern: RegExp }> = {
  "UG": { code: "+256", format: "+256 xxx xxx xxx", example: "+256 700 123 456", pattern: /^\+256\d{9}$/ },
  "KE": { code: "+254", format: "+254 xxx xxx xxx", example: "+254 712 123 456", pattern: /^\+254\d{9}$/ },
  "TZ": { code: "+255", format: "+255 xxx xxx xxx", example: "+255 712 123 456", pattern: /^\+255\d{9}$/ },
  "RW": { code: "+250", format: "+250 xxx xxx xxx", example: "+250 788 123 456", pattern: /^\+250\d{9}$/ },
  "SS": { code: "+211", format: "+211 xxx xxx xxx", example: "+211 977 123 456", pattern: /^\+211\d{9}$/ },
  "ET": { code: "+251", format: "+251 xxx xxx xxx", example: "+251 911 123 456", pattern: /^\+251\d{9}$/ },
  "US": { code: "+1", format: "+1 (xxx) xxx-xxxx", example: "+1 (202) 555-1234", pattern: /^\+1\d{10}$/ },
  "GB": { code: "+44", format: "+44 xxxx xxxxxx", example: "+44 20 7123 4567", pattern: /^\+44\d{10,11}$/ },
}

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

  // Initialize country from value if provided
  useEffect(() => {
    if (value) {
      const detectedCountry = getCountryFromPhone(value)
      setCountry(detectedCountry)
      setDisplayValue(value)
    } else {
      setDisplayValue("")
    }
  }, [value])

  const handleCountryChange = (newCountry: string) => {
    setCountry(newCountry)
    const countryData = COUNTRY_PHONE_FORMATS[newCountry]
    if (countryData && displayValue) {
      // Remove old country code and add new one
      const digits = displayValue.replace(/[^\d]/g, "")
      const currentCode = COUNTRY_PHONE_FORMATS[country].code.replace("+", "")
      if (digits.startsWith(currentCode)) {
        const numberWithoutCode = digits.substring(currentCode.length)
        const formatted = formatPhoneNumber(numberWithoutCode, newCountry)
        setDisplayValue(formatted)
        onChange(formatted.replace(/\s/g, ""))
      } else {
        const formatted = formatPhoneNumber(digits, newCountry)
        setDisplayValue(formatted)
        onChange(formatted.replace(/\s/g, ""))
      }
    } else {
      // Clear and show placeholder
      setDisplayValue("")
      onChange("")
    }
  }

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value
    const formatted = formatPhoneNumber(input, country)
    setDisplayValue(formatted)
    
    // Send formatted value without spaces for storage
    const cleaned = formatted.replace(/\s/g, "")
    onChange(cleaned)
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
