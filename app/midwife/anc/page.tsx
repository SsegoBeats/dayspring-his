"use client"
import { useEffect } from "react"
import { useRouter } from "next/navigation"

/**
 * Legacy ANC page — the full ANC workflow now lives inside the Midwife portal
 * shell at /midwife (ANC Visits tab). Redirect there permanently.
 */
export default function MidwifeAncRedirect() {
  const router = useRouter()
  useEffect(() => {
    router.replace("/midwife")
  }, [router])
  return null
}
