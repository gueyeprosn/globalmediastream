import { describe, expect, it } from "vitest"
import { parseSrtRelayLogTail } from "@/lib/traffic/srt-relay"

describe("parseSrtRelayLogTail", () => {
  it("extrait débit, RTT, bytes et IPs publisher", () => {
    const sample = `
16:39:41.601615/SRT:RcvQ:w2.N:SRT.cn: PASSING request from: 41.214.13.184:54693 to agent:708987092
11:05:07.992793/SRT:RcvQ:w1.N:SRT.cn: PASSING request from: 154.124.106.65:51770 to agent:973192780
Accepted SRT target connection
SRT target disconnected
RATE     SENDING:           0  RECEIVING:      2.79454
LINK         RTT:    74.39ms  BANDWIDTH:  1791.67Mb/s 
257444944 bytes lost, 0 bytes sent, 3598575116 bytes received
======= SRT STATS: sid=973192778
RATE     SENDING:           0.12  RECEIVING:      2.27532
`
    const p = parseSrtRelayLogTail(sample)
    expect(p.recvMbps).toBeCloseTo(2.27532, 4)
    expect(p.sendMbps).toBeCloseTo(0.12, 4)
    expect(p.rttMs).toBeCloseTo(74.39, 2)
    expect(p.bytesLost).toBe(257444944)
    expect(p.bytesSent).toBe(0)
    expect(p.bytesReceived).toBe(3598575116)
    expect(p.peers.get("41.214.13.184")?.port).toBe(54693)
    expect(p.peers.get("154.124.106.65")?.hits).toBe(1)
    expect(p.targetAccepted).toBe(1)
    expect(p.targetDisconnected).toBe(1)
  })

  it("gère un log vide", () => {
    const p = parseSrtRelayLogTail("")
    expect(p.recvMbps).toBe(0)
    expect(p.peers.size).toBe(0)
  })
})
