"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function AuthRedirect() {
  const router = useRouter()
  useEffect(() => {
    if (typeof window === "undefined") return
    if (window.location.pathname !== "/") return
    const hasCookie = /(?:^|;\s*)(session=|session_dev=)/.test(document.cookie || "")
    if (hasCookie) router.replace("/dashboard")
  }, [router])
  return null
}


