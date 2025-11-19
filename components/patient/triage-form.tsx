"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle, Activity, Heart, Thermometer, Wind, Droplets } from "lucide-react"

export function TriageForm({ patientId, onSaved }: { patientId: string; onSaved?: (c: string) => void }) {
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    mode: "Adult",
    systolic: "",
    diastolic: "",
    heartRate: "",
    respiratoryRate: "",
    temperature: "",
    spo2: "",
    avpu: "A",
    mobility: "ambulatory",
    painLevel: 0,
    chiefComplaint: "",
    // New fields for Ugandan standards
    isPregnant: false,
    pregnancyWeeks: "",
    isPostpartum: false,
    postpartumDays: "",
    hasTrauma: false,
    traumaType: "",
    traumaMechanism: "",
    burnsPercentage: "",
    weight: "", // For pediatric dosing calculations
    heightCm: "",
    bloodGlucose: "",
    capillaryRefill: "",
    muacCm: "",
    notes: "",
    hasRespiratoryDistress: false,
    hasChestPain: false,
    hasSevereBleeding: false,
    discriminators: [] as string[],
  })

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch("/api/triage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          patientId,
          mode: form.mode,
          systolic: form.systolic ? Number(form.systolic) : undefined,
          diastolic: form.diastolic ? Number(form.diastolic) : undefined,
          heartRate: form.heartRate ? Number(form.heartRate) : undefined,
          respiratoryRate: form.respiratoryRate ? Number(form.respiratoryRate) : undefined,
          temperature: form.temperature ? Number(form.temperature) : undefined,
          spo2: form.spo2 ? Number(form.spo2) : undefined,
          avpu: form.avpu,
          mobility: form.mobility || undefined,
          chiefComplaint: form.chiefComplaint,
          painLevel: form.painLevel,
          isPregnant: form.isPregnant,
          pregnancyWeeks: form.pregnancyWeeks ? Number(form.pregnancyWeeks) : undefined,
          isPostpartum: form.isPostpartum,
          postpartumDays: form.postpartumDays ? Number(form.postpartumDays) : undefined,
          hasTrauma: form.hasTrauma,
          traumaType: form.traumaType,
          traumaMechanism: form.traumaMechanism,
          burnsPercentage: form.burnsPercentage ? Number(form.burnsPercentage) : undefined,
          weight: form.weight ? Number(form.weight) : undefined,
          hasRespiratoryDistress: form.hasRespiratoryDistress,
          hasChestPain: form.hasChestPain,
          hasSevereBleeding: form.hasSevereBleeding,
          discriminators: form.discriminators,
          heightCm: form.heightCm ? Number(form.heightCm) : undefined,
          bloodGlucose: form.bloodGlucose ? Number(form.bloodGlucose) : undefined,
          capillaryRefill: form.capillaryRefill ? Number(form.capillaryRefill) : undefined,
          muacCm: form.muacCm ? Number(form.muacCm) : undefined,
          notes: form.notes || undefined,
        }),
      })
      const data = await res.json()
      onSaved?.(data.category)
    } catch (error) {
      console.error("Error saving triage:", error)
    } finally {
      setSaving(false)
    }
  }

  // Calculate triage category based on inputs (for display)
  const getSuggestedCategory = () => {
    if (form.avpu === "U") return "Emergency"
    if (form.spo2 && Number(form.spo2) < 90) return "Emergency"
    if (form.hasSevereBleeding) return "Emergency"
    if (form.burnsPercentage && Number(form.burnsPercentage) > 20) return "Emergency"
    if (form.temperature && Number(form.temperature) >= 40) return "Very Urgent"
    if (form.heartRate && (Number(form.heartRate) > 130 || Number(form.heartRate) < 40)) return "Very Urgent"
    if (form.systolic && Number(form.systolic) < 90) return "Very Urgent"
    if (form.hasRespiratoryDistress) return "Very Urgent"
    if (form.hasChestPain) return "Very Urgent"
    if (form.painLevel >= 7) return "Urgent"
    if (form.isPregnant && form.hasChestPain) return "Very Urgent"
    return "Routine"
  }

  const suggestedCategory = getSuggestedCategory()
  const categoryColors = {
    Emergency: "destructive",
    "Very Urgent": "destructive",
    Urgent: "default",
    Routine: "secondary",
  } as const

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
        <CardTitle>Triage Assessment</CardTitle>
            <CardDescription>Standard triage with vital signs and clinical indicators</CardDescription>
          </div>
          {suggestedCategory && (
            <Badge variant={categoryColors[suggestedCategory] || "secondary"}>
              {suggestedCategory}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-6">
          {/* Mode Selection */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Patient Mode *</Label>
              <Select value={form.mode} onValueChange={(v) => setForm({ ...form, mode: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Adult">Adult</SelectItem>
                  <SelectItem value="Child">Child (&lt;12 years)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.mode === "Child" && (
              <div className="space-y-2">
                <Label>Weight (kg)</Label>
                <Input 
                  type="number" 
                  inputMode="numeric" value={form.weight} 
                  onChange={(e) => setForm({ ...form, weight: e.target.value })} 
                  placeholder="For dosing calculations"
                />
              </div>
            )}
          </div>

          {/* AVPU and Mobility */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Consciousness Level (AVPU) *</Label>
              <Select value={form.avpu} onValueChange={(v) => setForm({ ...form, avpu: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="A">A - Alert</SelectItem>
                  <SelectItem value="V">V - Voice responsive</SelectItem>
                  <SelectItem value="P">P - Pain responsive</SelectItem>
                  <SelectItem value="U">U - Unresponsive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Mobility *</Label>
              <Select value={form.mobility} onValueChange={(v) => setForm({ ...form, mobility: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ambulatory">Ambulatory (walking)</SelectItem>
                  <SelectItem value="wheelchair">Wheelchair</SelectItem>
                  <SelectItem value="stretcher">Stretcher</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Vital Signs */}
          <div className="space-y-4">
            <h3 className="font-semibold flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Vital Signs
            </h3>
          <div className="grid gap-4 md:grid-cols-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <Heart className="h-3 w-3" />
                  Systolic BP (mmHg)
                </Label>
                <Input 
                  type="number" 
                  inputMode="numeric" min={50} max={260} step={1} value={form.systolic} 
                  onChange={(e) => setForm({ ...form, systolic: e.target.value })} 
                  placeholder="120"
                />
              </div>
              <div className="space-y-2">
                <Label>Diastolic BP (mmHg)</Label>
                <Input 
                  type="number" 
                  inputMode="numeric" min={30} max={160} step={1} value={form.diastolic} 
                  onChange={(e) => setForm({ ...form, diastolic: e.target.value })} 
                  placeholder="80"
                />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <Heart className="h-3 w-3" />
                  Heart Rate (bpm)
                </Label>
                <Input 
                  type="number" 
                  inputMode="numeric" min={20} max={220} step={1} value={form.heartRate} 
                  onChange={(e) => setForm({ ...form, heartRate: e.target.value })} 
                  placeholder={form.mode === "Child" ? "90" : "75"}
                />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <Wind className="h-3 w-3" />
                  Respiratory Rate (bpm)
                </Label>
                <Input 
                  type="number" 
                  inputMode="numeric" min={5} max={60} step={1} value={form.respiratoryRate} 
                  onChange={(e) => setForm({ ...form, respiratoryRate: e.target.value })} 
                  placeholder={form.mode === "Child" ? "24" : "16"}
                />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <Thermometer className="h-3 w-3" />
                  Temperature (°C)
                </Label>
                <Input 
                  type="number" inputMode="decimal" step="0.1" min={30} max={43}
                  value={form.temperature} 
                  onChange={(e) => setForm({ ...form, temperature: e.target.value })} 
                  placeholder="36.5-37.5"
                />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <Droplets className="h-3 w-3" />
                  SpO2 (%)
                </Label>
                <Input 
                  type="number" inputMode="numeric" min={50} max={100} step={1} value={form.spo2} 
                  onChange={(e) => setForm({ ...form, spo2: e.target.value })} 
                  placeholder="98"
                />
              </div>
            </div>
          </div>

          {/* Additional Measurements */}
          <div className="space-y-4 border-t pt-4">
            <h3 className="font-semibold">Additional Measurements</h3>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="space-y-2">
                <Label>Height (cm)</Label>
                <Input type="number" inputMode="numeric" min={30} max={230} step={1} value={form.heightCm} onChange={(e)=>setForm({ ...form, heightCm: e.target.value })} placeholder="170" />
              </div>
              <div className="space-y-2">
                <Label>Random Blood Glucose (mmol/L)</Label>
                <Input type="number" inputMode="decimal" min={1} max={40} step={0.1} value={form.bloodGlucose} onChange={(e)=>setForm({ ...form, bloodGlucose: e.target.value })} placeholder="5.6" />
              </div>
              <div className="space-y-2">
                <Label>Capillary Refill (sec)</Label>
                <Input type="number" inputMode="numeric" min={0} max={10} step={0.5} value={form.capillaryRefill} onChange={(e)=>setForm({ ...form, capillaryRefill: e.target.value })} placeholder="2" />
              </div>
              {form.mode === 'Child' && (
                <div className="space-y-2">
                  <Label>MUAC (cm)</Label>
                  <Input type="number" inputMode="numeric" min={5} max={30} step={0.1} value={form.muacCm} onChange={(e)=>setForm({ ...form, muacCm: e.target.value })} placeholder="13.5" />
                </div>
              )}
            </div>
          </div>

          {/* Pain Scale */}
          <div className="space-y-2">
            <Label>Pain Level: {form.painLevel}/10</Label>
            <Slider
              value={[form.painLevel]}
              onValueChange={(value) => setForm({ ...form, painLevel: value[0] })}
              max={10}
              step={1}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>0 - No pain</span>
              <span>5 - Moderate</span>
              <span>10 - Severe</span>
            </div>
          </div>

          {/* Obstetric Indicators */}
          {form.mode === "Adult" && (
            <div className="space-y-4 border-t pt-4">
              <h3 className="font-semibold">Obstetric Indicators</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="isPregnant"
                      checked={form.isPregnant}
                      onChange={(e) => setForm({ ...form, isPregnant: e.target.checked })}
                      className="rounded"
                    />
                    <Label htmlFor="isPregnant">Pregnant</Label>
                  </div>
                  {form.isPregnant && (
                    <Input
                      type="number"
                      inputMode="numeric" value={form.pregnancyWeeks}
                      onChange={(e) => setForm({ ...form, pregnancyWeeks: e.target.value })}
                      placeholder="Weeks of gestation"
                    />
                  )}
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="isPostpartum"
                      checked={form.isPostpartum}
                      onChange={(e) => setForm({ ...form, isPostpartum: e.target.checked })}
                      className="rounded"
                    />
                    <Label htmlFor="isPostpartum">Postpartum</Label>
                  </div>
                  {form.isPostpartum && (
                    <Input
                      type="number"
                      inputMode="numeric" value={form.postpartumDays}
                      onChange={(e) => setForm({ ...form, postpartumDays: e.target.value })}
                      placeholder="Days postpartum"
                    />
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Trauma Indicators */}
          <div className="space-y-4 border-t pt-4">
            <h3 className="font-semibold">Trauma Indicators</h3>
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="hasTrauma"
                  checked={form.hasTrauma}
                  onChange={(e) => setForm({ ...form, hasTrauma: e.target.checked })}
                  className="rounded"
                />
                <Label htmlFor="hasTrauma">Trauma present</Label>
              </div>
              {form.hasTrauma && (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Trauma Type</Label>
                    <Select value={form.traumaType} onValueChange={(v) => setForm({ ...form, traumaType: v })}>
                      <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="blunt">Blunt trauma</SelectItem>
                        <SelectItem value="penetrating">Penetrating trauma</SelectItem>
                        <SelectItem value="burns">Burns</SelectItem>
                        <SelectItem value="fall">Fall from height</SelectItem>
                        <SelectItem value="rta">Road traffic accident</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {form.traumaType === "burns" && (
                    <div className="space-y-2">
                      <Label>Burn Surface Area (%)</Label>
                      <Input
                        type="number"
                        inputMode="numeric" value={form.burnsPercentage}
                        onChange={(e) => setForm({ ...form, burnsPercentage: e.target.value })}
                        placeholder="%"
                      />
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label>Mechanism</Label>
                    <Input
                      value={form.traumaMechanism}
                      onChange={(e) => setForm({ ...form, traumaMechanism: e.target.value })}
                      placeholder="Describe mechanism"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Clinical Discriminators */}
          <div className="space-y-4 border-t pt-4">
            <h3 className="font-semibold">Clinical Discriminators</h3>
          <div className="grid gap-4 md:grid-cols-3">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="hasRespiratoryDistress"
                  checked={form.hasRespiratoryDistress}
                  onChange={(e) => setForm({ ...form, hasRespiratoryDistress: e.target.checked })}
                  className="rounded"
                />
                <Label htmlFor="hasRespiratoryDistress">Respiratory distress</Label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="hasChestPain"
                  checked={form.hasChestPain}
                  onChange={(e) => setForm({ ...form, hasChestPain: e.target.checked })}
                  className="rounded"
                />
                <Label htmlFor="hasChestPain">Chest pain</Label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.hasSevereBleeding}
                  id="hasSevereBleeding"
                  onChange={(e) => setForm({ ...form, hasSevereBleeding: e.target.checked })}
                  className="rounded"
                />
                <Label htmlFor="hasSevereBleeding">Severe bleeding</Label>
              </div>
            </div>
          </div>

          {/* Chief Complaint */}
          <div className="space-y-2">
            <Label>Chief Complaint *</Label>
            <Input 
              value={form.chiefComplaint} 
              onChange={(e) => setForm({ ...form, chiefComplaint: e.target.value })} 
              placeholder="Primary reason for visit..."
              required
            />
          </div>

          {/* Warning for Emergency cases */}
          {suggestedCategory === "Emergency" && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                This patient requires immediate emergency care. Expedite to emergency department.
              </AlertDescription>
            </Alert>
          )}

          <Button type="submit" className="w-full" disabled={saving}>
            {saving ? "Saving Triage..." : "Save Triage Assessment"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}





