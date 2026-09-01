"use client"

import { useEffect } from "react"

export function SwMigration() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return

    const migrate = async () => {
      try {
        const registrations = await navigator.serviceWorker.getRegistrations()

        await Promise.all(
          registrations.map(async (registration) => {
            const scriptUrl =
              registration.active?.scriptURL ||
              registration.waiting?.scriptURL ||
              registration.installing?.scriptURL ||
              ""

            // Legacy global SW (scope "/") pouvant casser les chunks Next.
            if (scriptUrl.includes("/sw.js")) {
              await registration.unregister()
            }
          })
        )

        if ("caches" in window) {
          const keys = await caches.keys()
          await Promise.all(
            keys
              .filter((k) => k.includes("global-media") || k.includes("toubatv"))
              .map((k) => caches.delete(k))
          )
        }
      } catch {
        // Migration best-effort: ne jamais bloquer l'UI.
      }
    }

    migrate()
  }, [])

  return null
}

