import { AppShell } from "@/components/shell/app-shell"
import { ADMIN_TOKEN_COOKIE } from "@/lib/auth-cookie"
import { isRole, verifyAdminToken } from "@/lib/jwt"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const token = (await cookies()).get(ADMIN_TOKEN_COOKIE)?.value
  if (!token) {
    redirect("/login")
  }
  try {
    const payload = await verifyAdminToken(token)
    if (!isRole(payload.role)) {
      redirect("/login")
    }
  } catch {
    redirect("/login")
  }

  return <AppShell>{children}</AppShell>
}
