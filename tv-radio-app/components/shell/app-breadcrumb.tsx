"use client"

import React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { PAGE_TITLES } from "@/components/shell/nav-config"

const PATH_LABELS: Record<string, string> = {
  ...PAGE_TITLES,
  "/mgmt": "Console Oryx SRS",
  "/login": "Connexion",
  "/watch": "Points de diffusion",
}

export function AppBreadcrumb() {
  const pathname = usePathname()
  if (pathname === "/login" || pathname === "/watch") return null

  const segments = pathname.split("/").filter(Boolean)
  const items = [{ path: "/", label: PATH_LABELS["/"] || "Dashboard" }]
  let acc = ""
  for (const seg of segments) {
    acc += `/${seg}`
    items.push({ path: acc, label: PATH_LABELS[acc] || seg })
  }

  return (
    <Breadcrumb className="mb-5">
      <BreadcrumbList>
        {items.map((item, i) => (
          <React.Fragment key={item.path}>
            {i > 0 && <BreadcrumbSeparator />}
            <BreadcrumbItem>
              {i === items.length - 1 ? (
                <BreadcrumbPage className="text-foreground/90">{item.label}</BreadcrumbPage>
              ) : (
                <BreadcrumbLink asChild>
                  <Link href={item.path}>{item.label}</Link>
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>
          </React.Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  )
}
