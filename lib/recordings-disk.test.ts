import { describe, expect, it } from "vitest"
import { parseDfDashP } from "@/lib/recordings-disk"

describe("parseDfDashP", () => {
  it("parse une sortie df -P typique", () => {
    const out = `Filesystem     1024-blocks     Used Available Capacity Mounted on
/dev/sda1        202051056 42466728 159567944      22% /`
    const s = parseDfDashP(out)
    expect(s.mount).toBe("/")
    expect(s.usedPercent).toBe(22)
    expect(s.freePercent).toBeGreaterThan(70)
    expect(s.totalGb).toBeGreaterThan(100)
    expect(s.freeGb).toBeGreaterThan(100)
  })

  it("rejette une sortie invalide", () => {
    expect(() => parseDfDashP("Filesystem\n")).toThrow(/df parse/)
  })
})
