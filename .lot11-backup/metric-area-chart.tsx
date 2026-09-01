"use client"

import { useEffect, useMemo, useState } from "react"
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { Pause, Play } from "lucide-react"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type MetricAreaChartProps = {
  data: number[]
  label: string
  unit?: string
  color: string
  className?: string
}

function formatValue(value: number, unit: string) {
  const formatted = Number.isInteger(value) ? String(value) : value.toFixed(2)
  return unit ? `${formatted} ${unit}` : formatted
}

export function MetricAreaChart({
  data,
  label,
  unit = "",
  color,
  className,
}: MetricAreaChartProps) {
  const [paused, setPaused] = useState(false)
  const [frozen, setFrozen] = useState<number[]>([])
  const [reduceMotion, setReduceMotion] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    const update = () => setReduceMotion(mq.matches)
    update()
    mq.addEventListener("change", update)
    return () => mq.removeEventListener("change", update)
  }, [])

  useEffect(() => {
    if (!paused) {
      setFrozen(data)
    }
  }, [data, paused])

  const displayData = paused ? frozen : data
  const current = displayData.length ? displayData[displayData.length - 1] : 0

  const chartConfig = useMemo(
    () =>
      ({
        value: {
          label,
          color,
        },
      }) satisfies ChartConfig,
    [label, color]
  )

  const chartPoints = useMemo(
    () => displayData.map((value, index) => ({ index, value })),
    [displayData]
  )

  const animate = !paused && !reduceMotion

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="font-mono text-2xl font-semibold tabular-nums text-white" aria-live="polite">
            {formatValue(current, unit)}
          </p>
        </div>
        <Button
          type="button"
          size="icon"
          variant="outline"
          className="h-11 w-11 shrink-0 border-border/80 bg-muted/40 text-foreground/90"
          onClick={() => setPaused((p) => !p)}
          aria-label={paused ? `Reprendre ${label}` : `Mettre en pause ${label}`}
          title={paused ? "Reprendre" : "Pause"}
        >
          {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
        </Button>
      </div>

      <ChartContainer
        config={chartConfig}
        className="aspect-auto h-[100px] w-full"
        initialDimension={{ width: 320, height: 100 }}
      >
        <AreaChart
          data={chartPoints}
          margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
          accessibilityLayer
        >
          <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-slate-700/40" />
          <XAxis dataKey="index" hide tickLine={false} axisLine={false} />
          <YAxis hide domain={["auto", "auto"]} tickLine={false} axisLine={false} />
          <ChartTooltip
            cursor={{ stroke: "var(--border)", strokeWidth: 1 }}
            content={
              <ChartTooltipContent
                labelFormatter={(_, payload) => {
                  const idx = payload?.[0]?.payload?.index
                  return typeof idx === "number" ? `Point ${idx + 1}` : label
                }}
                formatter={(value) => formatValue(Number(value), unit)}
              />
            }
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke="var(--color-value)"
            fill="var(--color-value)"
            fillOpacity={0.18}
            strokeWidth={2}
            isAnimationActive={animate}
            dot={false}
            activeDot={{ r: 3, fill: "var(--color-value)" }}
          />
        </AreaChart>
      </ChartContainer>
    </div>
  )
}
