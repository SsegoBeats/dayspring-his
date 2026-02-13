"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { useSettings } from "@/lib/settings-context"
import { ORG_NAME, ORG_EMAIL, ORG_PHONE, ORG_ADDRESS } from "@/lib/org-constants"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Info } from "lucide-react"

export function OrgSettings() {
  const { refreshSettings } = useSettings()
  const [currency, setCurrency] = useState("UGX")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/settings/org', { credentials: 'include' })
        if (!res.ok) throw new Error('Failed to load org settings')
        const data = await res.json()
        const s = data.settings || {}
        setCurrency(s.currency || 'UGX')
      } catch (e:any) {
        toast.error('Failed to load organization settings', { description: e?.message || 'Error' })
      } finally { setLoading(false) }
    })()
  }, [])

  const save = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/settings/org', { 
        method: 'POST', 
        credentials: 'include', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ currency }) 
      })
      if (!res.ok) throw new Error((await res.json().catch(()=>({} as any)))?.error || 'Failed')
      toast.success('Currency setting saved')
      await refreshSettings()
    } catch (e:any) {
      toast.error('Failed to save currency setting', { description: e?.message || 'Error' })
    } finally { setSaving(false) }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Organization Settings</CardTitle>
        <CardDescription>Manage system-wide organization settings</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            Organization details (name, logo, email, phone, address) are system-managed and cannot be changed through this interface. 
            Only the system currency can be modified.
          </AlertDescription>
        </Alert>

        <div className="space-y-4 border-t pt-4">
          <div className="space-y-2">
            <div>
              <Label className="text-sm font-medium">Organization Name</Label>
              <p className="text-sm text-muted-foreground mt-1">{ORG_NAME}</p>
            </div>
            <div>
              <Label className="text-sm font-medium">Email</Label>
              <p className="text-sm text-muted-foreground mt-1">{ORG_EMAIL}</p>
            </div>
            <div>
              <Label className="text-sm font-medium">Phone</Label>
              <p className="text-sm text-muted-foreground mt-1">{ORG_PHONE}</p>
            </div>
            <div>
              <Label className="text-sm font-medium">Address</Label>
              <p className="text-sm text-muted-foreground mt-1">{ORG_ADDRESS}</p>
            </div>
          </div>

          <div className="space-y-1 border-t pt-4">
            <Label>System Currency</Label>
            <p className="text-xs text-muted-foreground mb-1">Admin-only. Affects receipts, exports, billing, and the entire system.</p>
            {loading ? (
              <div className="text-sm text-muted-foreground">Loading…</div>
            ) : (
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="UGX">UGX (Ugandan Shilling)</SelectItem>
                  <SelectItem value="USD">USD (US Dollar)</SelectItem>
                  <SelectItem value="KES">KES (Kenyan Shilling)</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="flex justify-end">
            <Button onClick={save} disabled={saving || loading}>{saving? 'Saving…' : 'Save Changes'}</Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

