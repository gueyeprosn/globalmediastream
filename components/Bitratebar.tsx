"use client"

type BitratebarProps = {
  value: number
  maxBitrate: number
}

export function Bitratebar({ value, maxBitrate }: BitratebarProps) {
  const ratio = maxBitrate > 0 ? Math.min(1, value / maxBitrate) : 0
  const percent = Math.round(ratio * 100)
  const color = percent < 70 ? "var(--brand-green)" : percent < 90 ? "var(--brand-gold)" : "var(--destructive)"

  return (
    <div className="flex items-center gap-2">
      <span className="font-mono text-xs text-foreground/90">{(value / 1000).toFixed(1)} Mbps</span>
      <div className="h-[3px] w-20 rounded-full bg-slate-700/70">
        <div className="h-[3px] rounded-full transition-all" style={{ width: `${percent}%`, backgroundColor: color }} />
      </div>
    </div>
  )
}

