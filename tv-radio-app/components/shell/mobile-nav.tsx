"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { NAV_ITEMS } from "@/components/shell/nav-config"
import { useAppStore } from "@/stores/useAppStore"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

/** Mobile navigation sheet — driven by `sidebarOpen` from the app store. */
export function MobileNav() {
  const pathname = usePathname()
  const { sidebarOpen, setSidebarOpen } = useAppStore()

  return (
    <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
      <SheetContent side="left" className="w-[18rem] border-sidebar-border bg-sidebar p-0 lg:hidden">
        <SheetHeader className="border-b border-sidebar-border px-4 py-3 text-left">
          <SheetTitle className="text-sm font-semibold tracking-tight">Navigation</SheetTitle>
        </SheetHeader>
        <nav className="flex flex-col gap-0.5 p-3">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon
            const isActive =
              item.path === "/" ? pathname === "/" : pathname.startsWith(item.path)
            return (
              <Link
                key={item.path}
                href={item.path}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
                )}
              >
                <Icon className="h-[18px] w-[18px] shrink-0" />
                {item.label}
              </Link>
            )
          })}
        </nav>
      </SheetContent>
    </Sheet>
  )
}
