"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Lock, Eye, EyeOff, CheckCircle } from "lucide-react"
import { toast } from "sonner"

export function PasswordSettings() {
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [saving, setSaving] = useState(false)
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [passwordStrength, setPasswordStrength] = useState(0)
  const [passwordCriteria, setPasswordCriteria] = useState({
    length: false,
    uppercase: false,
    lowercase: false,
    number: false,
    symbol: false
  })

  // Password strength calculation
  useEffect(() => {
    const calculateStrength = (password: string) => {
      const criteria = {
        length: password.length >= 8,
        uppercase: /[A-Z]/.test(password),
        lowercase: /[a-z]/.test(password),
        number: /\d/.test(password),
        symbol: /[!@#$%^&*(),.?":{}|<>]/.test(password)
      }
      
      setPasswordCriteria(criteria)
      
      const score = Object.values(criteria).filter(Boolean).length
      setPasswordStrength((score / 5) * 100)
    }
    
    if (newPassword) {
      calculateStrength(newPassword)
    } else {
      setPasswordStrength(0)
      setPasswordCriteria({
        length: false,
        uppercase: false,
        lowercase: false,
        number: false,
        symbol: false
      })
    }
  }, [newPassword])

  const submitPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const csrf = (document.cookie.split(";").find((c) => c.trim().startsWith("csrfToken=")) || "").split("=")[1] || ""
      const r = await fetch("/api/settings/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrf },
        credentials: "include",
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      if (!r.ok) {
        const d = await r.json().catch(() => ({}))
        toast.error("Failed: " + (d.error || r.statusText))
      } else {
        toast.success("Password updated successfully.")
        setCurrentPassword("")
        setNewPassword("")
        setPasswordStrength(0)
        setPasswordCriteria({
          length: false,
          uppercase: false,
          lowercase: false,
          number: false,
          symbol: false
        })
      }
    } finally {
      setSaving(false)
    }
  }

  const getPasswordStrengthText = (strength: number) => {
    if (strength < 40) return "Weak"
    if (strength < 70) return "Medium"
    return "Strong"
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lock className="h-5 w-5 text-blue-600" />
          Password
        </CardTitle>
        <CardDescription>
          Update your password. Use a strong password with at least 8 characters.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submitPassword} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="currentPassword">Current Password</Label>
            <div className="relative">
              <Input 
                id="currentPassword"
                name="currentPassword"
                type={showCurrentPassword ? "text" : "password"}
                autoComplete="current-password"
                value={currentPassword} 
                onChange={(e) => setCurrentPassword(e.target.value)} 
                required 
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="newPassword">New Password</Label>
            <div className="relative">
              <Input 
                id="newPassword"
                name="newPassword"
                type={showNewPassword ? "text" : "password"}
                autoComplete="new-password"
                value={newPassword} 
                onChange={(e) => setNewPassword(e.target.value)} 
                required 
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            
            {newPassword && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Password strength:</span>
                  <span className={`font-medium ${
                    passwordStrength < 40 ? 'text-red-600' : 
                    passwordStrength < 70 ? 'text-yellow-600' : 'text-green-600'
                  }`}>
                    {getPasswordStrengthText(passwordStrength)}
                  </span>
                </div>
                <Progress 
                  value={passwordStrength} 
                  className="h-2"
                />
                
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className={`flex items-center gap-1 ${passwordCriteria.length ? 'text-green-600' : 'text-gray-400'}`}>
                    <CheckCircle className="h-3 w-3" />
                    8+ characters
                  </div>
                  <div className={`flex items-center gap-1 ${passwordCriteria.uppercase ? 'text-green-600' : 'text-gray-400'}`}>
                    <CheckCircle className="h-3 w-3" />
                    Uppercase letter
                  </div>
                  <div className={`flex items-center gap-1 ${passwordCriteria.lowercase ? 'text-green-600' : 'text-gray-400'}`}>
                    <CheckCircle className="h-3 w-3" />
                    Lowercase letter
                  </div>
                  <div className={`flex items-center gap-1 ${passwordCriteria.number ? 'text-green-600' : 'text-gray-400'}`}>
                    <CheckCircle className="h-3 w-3" />
                    Number
                  </div>
                  <div className={`flex items-center gap-1 ${passwordCriteria.symbol ? 'text-green-600' : 'text-gray-400'}`}>
                    <CheckCircle className="h-3 w-3" />
                    Special character
                  </div>
                </div>
              </div>
            )}
          </div>
          
          <Button 
            type="submit" 
            disabled={saving || !currentPassword || !newPassword || passwordStrength < 40}
            className="w-full"
          >
            {saving ? "Saving..." : "Change Password"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
