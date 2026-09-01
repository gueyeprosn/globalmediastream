"use client"

import { useRouter } from "next/navigation"
import { useEffect } from "react"

export default function AdminPage() {
  const router = useRouter()

  useEffect(() => {
    // Redirection client fiable vers l'interface principale.
    router.replace("/")
  }, [router])

  return null
}
