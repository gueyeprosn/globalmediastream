import { describe, expect, it } from "vitest"
import {
  assertSafeNginxAccessLog,
  parseDfDashPLine,
  parseSsEstablishedRemoteIps,
} from "@/lib/host-metrics"

describe("parseDfDashPLine", () => {
  it("parse df -P", () => {
    const out = `Filesystem     1024-blocks     Used Available Capacity Mounted on
/dev/sda1        202051056 42466728 159567944      22% /`
    const d = parseDfDashPLine(out)
    expect(d.percentage).toBe(22)
    expect(d.mountPoint).toBe("/")
    expect(d.total).toBeGreaterThan(100)
  })
})

describe("parseSsEstablishedRemoteIps", () => {
  it("extrait IPs non-localhost sur un port", () => {
    const sample = `ESTAB 0 0 10.0.0.5:54321 203.0.113.10:1935 users:(("ffmpeg",pid=1,fd=3))
ESTAB 0 0 127.0.0.1:1234 127.0.0.1:1935 users:(("x",pid=2,fd=3))`
    const ips = parseSsEstablishedRemoteIps(sample, 1935)
    expect(ips).toContain("203.0.113.10")
    expect(ips).toContain("10.0.0.5")
    expect(ips).not.toContain("127.0.0.1")
  })
})

describe("assertSafeNginxAccessLog", () => {
  it("autorise /var/log/nginx/*", () => {
    expect(assertSafeNginxAccessLog("/var/log/nginx/access.log")).toBe(
      "/var/log/nginx/access.log"
    )
  })
  it("rejette chemins dangereux", () => {
    expect(() => assertSafeNginxAccessLog("/etc/passwd")).toThrow()
    expect(() => assertSafeNginxAccessLog('/var/log/nginx/access.log";id')).toThrow()
  })
})
