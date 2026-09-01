import type React from "react"
import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { Providers } from "@/lib/providers"
import { AuthGuard } from "@/components/auth/auth-guard"
import { SwMigration } from "@/components/system/sw-migration"

const geist = Geist({ 
  subsets: ["latin"],
  variable: "--font-geist-sans",
  display: "swap",
})
const geistMono = Geist_Mono({ 
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
})

/** HTML dynamique géré par AuthGuard client ; éviter force-dynamic global (ralentit chaque requête). */
export const dynamic = "auto"

export const metadata: Metadata = {
  title: "Stream Control Center",
  description: "Interface de contrôle et monitoring des streams SRT, RTMP et Icecast",
  generator: "Next.js",
  icons: {
    icon: [
      { url: "/logo-broadcast-sn.png", type: "image/png" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    shortcut: ["/logo-broadcast-sn.png"],
    apple: "/logo-broadcast-sn.png",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        <meta name="theme-color" content="#09090b" media="(prefers-color-scheme: dark)" />
        <meta name="theme-color" content="#fafafa" media="(prefers-color-scheme: light)" />
      </head>
      <body className={`${geist.variable} ${geistMono.variable} font-sans antialiased`}>
        <Providers>
          <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
            <SwMigration />
            <AuthGuard>
              {children}
            </AuthGuard>
          </ThemeProvider>
        </Providers>
      </body>
    </html>
  )
}
