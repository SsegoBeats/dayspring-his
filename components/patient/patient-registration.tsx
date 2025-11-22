"use client"

import type React from "react"
import { useState } from "react"
import { usePatients } from "@/lib/patient-context"
import { z } from "zod"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { toast } from "sonner"
import { PhoneInput } from "@/components/ui/phone-input"
import { Printer, X } from "lucide-react"

interface PatientRegistrationProps {
  onSuccess?: (patientId?: string) => void
}

export function PatientRegistration({ onSuccess }: PatientRegistrationProps) {
  const { refreshPatients } = usePatients()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errors, setErrors] = useState<{ [k: string]: string }>({})
  const [formError, setFormError] = useState<string>("")
  const [tokenId, setTokenId] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    
    ageYears: "",
    department: "",
    sendToDepartment: true,
    gender: "male" as "male" | "female" | "other",
    phone: "",
    address: "",
    bloodGroup: "",
    allergies: "",
    emergencyContact: "",
    emergencyPhone: "",
    nin: "",
    district: "",
    subcounty: "",
    parish: "",
    village: "",
    occupation: "",
    nextOfKinFirstName: "",
    nextOfKinLastName: "",
    nextOfKinCountry: "UG",
    nextOfKinPhone: "",
    nextOfKinRelation: "",
    nextOfKinResidence: "",
    insuranceProvider: "",
    insuranceMemberNo: "",
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setErrors({})
    setFormError("")

    try {
      // Client-side validation for professional inline feedback
      const nextErrors: { [k: string]: string } = {}
      if (!formData.firstName.trim()) nextErrors.firstName = "First name is required"
      if (!formData.lastName.trim()) nextErrors.lastName = "Last name is required"
      if (!formData.ageYears) { nextErrors.ageYears = "Age is required" }
      if (formData.ageYears) {
        const n = Number(formData.ageYears)
        if (isNaN(n) || n < 0 || n > 130) nextErrors.ageYears = "Age must be 0-130"
      }
      const e164 = /^\+\d{10,15}$/
      if (!e164.test(formData.phone || "")) nextErrors.phone = "Phone must be in +countrycode format"
      if (formData.emergencyPhone && !e164.test(formData.emergencyPhone)) nextErrors.emergencyPhone = "Invalid emergency phone format"
      if (formData.nin && !/^[A-Z0-9]{14}$/i.test(formData.nin)) nextErrors.nin = "NIN must be 14 letters/digits"
      if (Object.keys(nextErrors).length) {
        setErrors(nextErrors)
        // Smooth scroll to the first invalid field
        try {
          const firstKey = Object.keys(nextErrors)[0]
          const idMap: Record<string,string> = {
            firstName: 'firstName',
            lastName: 'lastName',
            ageYears: 'ageYears',
            phone: 'phone',
            emergencyPhone: 'emergencyPhone',
            nin: 'nin',
          }
          const targetId = idMap[firstKey] || firstKey
          const el = document.getElementById(targetId)
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' })
            ;(el as any).focus?.()
          }
        } catch {}
        setIsSubmitting(false)
        return
      }
      // Call server API to persist with UG validation
      const createRes = await fetch("/api/patients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: formData.firstName,
          lastName: formData.lastName,
          dateOfBirth: null,
          ageYears: formData.ageYears ? Number(formData.ageYears) : null,
          gender: formData.gender === "male" ? "Male" : formData.gender === "female" ? "Female" : "Other",
          phone: formData.phone,
          address: formData.address || null,
          nin: formData.nin || null,
          district: formData.district || null,
          subcounty: formData.subcounty || null,
          parish: formData.parish || null,
          village: formData.village || null,
          occupation: formData.occupation || null,
          bloodGroup: formData.bloodGroup || null,
          allergies: formData.allergies || null,
          emergencyContactName: formData.emergencyContact || null,
          emergencyContactPhone: formData.emergencyPhone || null,
          nextOfKinFirstName: formData.nextOfKinFirstName || null,
          nextOfKinLastName: formData.nextOfKinLastName || null,
          nextOfKinCountry: formData.nextOfKinCountry || null,
          nextOfKinPhone: formData.nextOfKinPhone || null,
          nextOfKinRelation: formData.nextOfKinRelation || null,
          nextOfKinResidence: formData.nextOfKinResidence || null,
          insuranceProvider: formData.insuranceProvider || null,
          insuranceMemberNo: formData.insuranceMemberNo || null,
        }),
        credentials: "include",
      })

      if (createRes.ok) {
        const created = await createRes.json()
        const patientId = created.id
        try { await refreshPatients() } catch {}
        // Offer a quick View Patient action via toast
        try {
          toast.success('Patient registered', {
            action: {
              label: 'View patient',
              onClick: () => {
                try { onSuccess?.(patientId) } catch {}
              },
            },
          })
          // Offer immediate print option for P.ID receipt
          toast.success('Print patient receipt?', {
            action: {
              label: 'Print P.ID',
              onClick: () => {
                try { window.open(`/patient-receipt/${patientId}?auto=1`, '_blank') } catch {}
              },
            },
          })
        } catch {}
        if (formData.sendToDepartment && formData.department) {
          try {
            const ck = await fetch('/api/checkins', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ patientId, department: formData.department }) })
            if (ck.ok) {
              const c = await ck.json()
              // Persist a print banner instead of auto-redirecting
              if (c?.id) setTokenId(c.id)
              // Notify department panel
              try {
                await fetch('/api/notify/department', {
                  method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ department: formData.department, title: 'New Patient Check-In', message: `${formData.firstName} ${formData.lastName} has been checked-in. Token: ${c.id}`, payload: { patientId, checkinId: c.id } })
                })
              } catch {}
              toast.success('Patient registered and checked in')
            } else {
              toast.success('Patient registered')
            }
          } catch {}
        } else {
          toast.success('Patient registered')
        }

        // Notify caller so dialogs can close and navigate to the new patient
        try { onSuccess?.(patientId) } catch {}
      } else {
        let msg = "Failed to register patient"
        try { const j = await createRes.json(); if (j?.error) msg = String(j.error) } catch {}
        setFormError(msg)
      }

      // Refresh patient lists via context fetch paths
      // Reset form
      setFormData({
        firstName: "",
        lastName: "",
        
        ageYears: "",
        department: "",
        sendToDepartment: true,
        gender: "male",
        phone: "",
        address: "",
        bloodGroup: "",
        allergies: "",
        emergencyContact: "",
        emergencyPhone: "",
        nin: "",
        district: "",
        subcounty: "",
        parish: "",
        village: "",
        occupation: "",
        nextOfKinFirstName: "",
        nextOfKinLastName: "",
        nextOfKinCountry: "UG",
        nextOfKinPhone: "",
        nextOfKinRelation: "",
        nextOfKinResidence: "",
        insuranceProvider: "",
        insuranceMemberNo: "",
      })
      setErrors({})
    } catch (error) {
      console.error("Error registering patient:", error)
      if (!formError) setFormError("Something went wrong while saving")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Register New Patient</CardTitle>
        <CardDescription>Enter patient information to create a new registration</CardDescription>
      </CardHeader>
      <CardContent>
        {tokenId && (
          <Alert className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <AlertTitle>Queue token ready</AlertTitle>
              <AlertDescription>Token {tokenId}. Click print to open/print the token. This will stay until you close it.</AlertDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => { try { window.open(`/api/queue/token/${tokenId}`, '_blank') } catch {} }}
              >
                <Printer className="mr-2 h-4 w-4" /> Print token
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setTokenId(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </Alert>
        )}
        {formError && (
          <div className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</div>
        )}
        <form onSubmit={handleSubmit} className="space-y-6">
          <h3 className="text-base font-semibold text-foreground">Personal Details</h3>
          <div className="grid gap-4 md:grid-cols-2 rounded-md border p-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name *</Label>
              <Input
                id="firstName"
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                required
              />
              {errors.firstName && <div className="text-xs text-red-600">{errors.firstName}</div>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name *</Label>
              <Input
                id="lastName"
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                required
              />
              {errors.lastName && <div className="text-xs text-red-600">{errors.lastName}</div>}
            </div>
          </div>

          <Separator className="my-2" />
          <h3 className="text-base font-semibold text-foreground">Demographics</h3>
          <div className="grid gap-4 md:grid-cols-2 rounded-md border p-4">
            <div className="space-y-2">
              <Label htmlFor="ageYears">Age (years)</Label>
              <Input
                id="ageYears"
                type="number"
                min={0}
                max={130}
                value={formData.ageYears}
                onChange={(e) => setFormData({ ...formData, ageYears: e.target.value.replace(/[^0-9]/g,'') })}
                placeholder="e.g., 35"
              />
              {errors.ageYears && <div className="text-xs text-red-600">{errors.ageYears}</div>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="gender">Gender *</Label>
              <Select
                value={formData.gender}
                onValueChange={(value: any) => setFormData({ ...formData, gender: value })}
              >
                <SelectTrigger id="gender">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator className="my-2" />
          <h3 className="text-base font-semibold text-foreground">Identification & Address</h3>
          <div className="grid gap-4 md:grid-cols-2 rounded-md border p-4">
            <div className="space-y-2">
              <Label htmlFor="nin">National ID (NIN)</Label>
              <Input id="nin" value={formData.nin} onChange={(e) => setFormData({ ...formData, nin: e.target.value })} />
              {errors.nin && <div className="text-xs text-red-600">{errors.nin}</div>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="district">District</Label>
              <Input id="district" value={formData.district} onChange={(e) => setFormData({ ...formData, district: e.target.value })} />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3 rounded-md border p-4">
            <div className="space-y-2">
              <Label htmlFor="subcounty">Sub-county</Label>
              <Input id="subcounty" value={formData.subcounty} onChange={(e) => setFormData({ ...formData, subcounty: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="parish">Parish</Label>
              <Input id="parish" value={formData.parish} onChange={(e) => setFormData({ ...formData, parish: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="village">Village</Label>
              <Input id="village" value={formData.village} onChange={(e) => setFormData({ ...formData, village: e.target.value })} />
            </div>
          </div>

          <Separator className="my-2" />
          <h3 className="text-base font-semibold text-foreground">Employment & Insurance</h3>
          <div className="grid gap-4 md:grid-cols-2 rounded-md border p-4">
            <div className="space-y-2">
              <Label htmlFor="occupation">Occupation</Label>
              <Input id="occupation" value={formData.occupation} onChange={(e) => setFormData({ ...formData, occupation: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="insuranceProvider">Insurance Provider</Label>
              <Input id="insuranceProvider" value={formData.insuranceProvider} onChange={(e) => setFormData({ ...formData, insuranceProvider: e.target.value })} />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="insuranceMemberNo">Insurance Member No.</Label>
              <Input id="insuranceMemberNo" value={formData.insuranceMemberNo} onChange={(e) => setFormData({ ...formData, insuranceMemberNo: e.target.value })} />
            </div>
          </div>

          <Separator className="my-2" />
          <div className="space-y-3 rounded-md border p-4">
            <h3 className="font-semibold text-foreground">Next of Kin Information</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="nextOfKinFirstName">First Name</Label>
                <Input id="nextOfKinFirstName" value={formData.nextOfKinFirstName} onChange={(e) => setFormData({ ...formData, nextOfKinFirstName: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nextOfKinLastName">Last Name</Label>
                <Input id="nextOfKinLastName" value={formData.nextOfKinLastName} onChange={(e) => setFormData({ ...formData, nextOfKinLastName: e.target.value })} />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="nextOfKinCountry">Country</Label>
                <Select
                  value={formData.nextOfKinCountry}
                  onValueChange={(value) => setFormData({ ...formData, nextOfKinCountry: value })}
                >
                  <SelectTrigger id="nextOfKinCountry">
                    <SelectValue placeholder="Select country" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UG">Uganda (UG) +256</SelectItem>
                    <SelectItem value="KE">Kenya (KE) +254</SelectItem>
                    <SelectItem value="TZ">Tanzania (TZ) +255</SelectItem>
                    <SelectItem value="RW">Rwanda (RW) +250</SelectItem>
                    <SelectItem value="SS">South Sudan (SS) +211</SelectItem>
                    <SelectItem value="ET">Ethiopia (ET) +251</SelectItem>
                    <SelectItem value="US">United States (US) +1</SelectItem>
                    <SelectItem value="GB">United Kingdom (GB) +44</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <PhoneInput
                id="nextOfKinPhone"
                label="Phone"
                value={formData.nextOfKinPhone}
                onChange={(value) => setFormData({ ...formData, nextOfKinPhone: value })}
                defaultCountry={formData.nextOfKinCountry}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="nextOfKinResidence">Residence</Label>
                <Input
                  id="nextOfKinResidence"
                  value={formData.nextOfKinResidence}
                  onChange={(e) => setFormData({ ...formData, nextOfKinResidence: e.target.value })}
                  placeholder="Address of next of kin"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nextOfKinRelation">Relationship</Label>
                <Select
                  value={formData.nextOfKinRelation}
                  onValueChange={(value) => setFormData({ ...formData, nextOfKinRelation: value })}
                >
                  <SelectTrigger id="nextOfKinRelation">
                    <SelectValue placeholder="Select relationship" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Spouse">Spouse</SelectItem>
                    <SelectItem value="Parent">Parent</SelectItem>
                    <SelectItem value="Child">Child</SelectItem>
                    <SelectItem value="Sibling">Sibling</SelectItem>
                    <SelectItem value="Guardian">Guardian</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <Separator className="my-2" />
          <h3 className="text-base font-semibold text-foreground">Contact Information</h3>
          <div className="grid gap-4 md:grid-cols-2 rounded-md border p-4">
            <div>
              <PhoneInput
                id="phone"
                label="Phone Number"
                value={formData.phone}
                onChange={(value) => setFormData({ ...formData, phone: value })}
                required
                defaultCountry="UG"
              />
              {errors.phone && <div className="mt-1 text-xs text-red-600">{errors.phone}</div>}
            </div>
          </div>

          <Separator className="my-2" />
          <h3 className="text-base font-semibold text-foreground">Clinical Information</h3>
          <div className="grid gap-4 md:grid-cols-2 rounded-md border p-4">
            <div className="space-y-2">
              <Label htmlFor="department">Send To Department</Label>
              <Select
                value={formData.department}
                onValueChange={(value:any) => setFormData({ ...formData, department: value })}
              >
                <SelectTrigger id="department">
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="General">General</SelectItem>
                  <SelectItem value="Emergency">Emergency</SelectItem>
                  <SelectItem value="Pediatrics">Pediatrics</SelectItem>
                  <SelectItem value="Surgery">Surgery</SelectItem>
                  <SelectItem value="Radiology">Radiology</SelectItem>
                  <SelectItem value="Laboratory">Laboratory</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <input id="sendToDept" type="checkbox" checked={formData.sendToDepartment} onChange={(e) => setFormData({ ...formData, sendToDepartment: e.target.checked })} />
                <label htmlFor="sendToDept">Create check-in & queue, then print token</label>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Address *</Label>
            <Textarea
              id="address"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              required
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="bloodGroup">Blood Group</Label>
              <Select
                value={formData.bloodGroup}
                onValueChange={(value) => setFormData({ ...formData, bloodGroup: value })}
              >
                <SelectTrigger id="bloodGroup">
                  <SelectValue placeholder="Select blood group" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="A+">A+</SelectItem>
                  <SelectItem value="A-">A-</SelectItem>
                  <SelectItem value="B+">B+</SelectItem>
                  <SelectItem value="B-">B-</SelectItem>
                  <SelectItem value="AB+">AB+</SelectItem>
                  <SelectItem value="AB-">AB-</SelectItem>
                  <SelectItem value="O+">O+</SelectItem>
                  <SelectItem value="O-">O-</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="allergies">Allergies</Label>
              <Input
                id="allergies"
                value={formData.allergies}
                onChange={(e) => setFormData({ ...formData, allergies: e.target.value })}
                placeholder="e.g., Penicillin, Peanuts"
              />
            </div>
          </div>

          <Separator className="my-2" />
          <div className="space-y-3 rounded-md border p-4">
            <h3 className="font-semibold text-foreground">Emergency Contact</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="emergencyContact">Contact Name *</Label>
                <Input
                  id="emergencyContact"
                  value={formData.emergencyContact}
                  onChange={(e) => setFormData({ ...formData, emergencyContact: e.target.value })}
                  required
                />
              </div>
              <PhoneInput
                id="emergencyPhone"
                label="Contact Phone"
                value={formData.emergencyPhone}
                onChange={(value) => setFormData({ ...formData, emergencyPhone: value })}
                required
                defaultCountry="UG"
              />
              {errors.emergencyPhone && <div className="text-xs text-red-600">{errors.emergencyPhone}</div>}
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Registering..." : "Register Patient"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}



