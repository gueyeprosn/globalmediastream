"use client"

import { Copy } from "lucide-react"
import { toast } from "sonner"

type EndpointRowProps = {
  label: string
  value: string
  live?: boolean
}

export function EndpointRow({ label, value, live }: EndpointRowProps) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      toast.success("Copié dans le presse-papiers")
    } catch {
      toast.error("Copie impossible")
    }
  }

  return (
    <div className="flex items-center gap-2 rounded-lg border border-border/80 bg-muted/30 p-2">
      <span className={`h-2 w-2 rounded-full ${live ? "bg-emerald-400 animate-pulse" : "bg-slate-500"}`} />
      <div className="min-w-0 flex-1">
        <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
        <code className="block truncate font-mono text-xs text-foreground">{value}</code>
      </div>
      <button className="rounded border border-border/80 p-1.5 hover:bg-slate-800/80" onClick={copy}>
        <Copy className="h-3.5 w-3.5 text-foreground/90" />
      </button>
    </div>
  )
}

