import { describe, expect, it } from "vitest";
import { isPublicAddress } from "../../src/utils/ip-guard.js";

describe("isPublicAddress", () => {
  it("blocks private, loopback, link-local, CGNAT and special-use IPv4", () => {
    const blocked = [
      "0.0.0.0",
      "0.1.2.3",
      "10.0.0.1",
      "100.64.0.1",
      "127.0.0.1",
      "169.254.169.254",
      "172.16.0.1",
      "172.31.255.255",
      "192.0.0.1",
      "192.0.2.1",
      "192.168.1.1",
      "198.18.0.1",
      "198.51.100.1",
      "203.0.113.1",
      "224.0.0.1",
      "239.255.255.255",
      "240.0.0.1",
      "255.255.255.255",
    ];
    for (const ip of blocked) {
      expect(isPublicAddress(ip), ip).toBe(false);
    }
  });

  it("allows globally routable IPv4", () => {
    const publicIps = ["1.1.1.1", "8.8.8.8", "93.184.216.34", "172.32.0.1", "192.0.3.1"];
    for (const ip of publicIps) {
      expect(isPublicAddress(ip), ip).toBe(true);
    }
  });

  it("blocks IPv6 unspecified, loopback, ULA, link-local, multicast and documentation", () => {
    const blocked = ["::", "::1", "fd00::1", "fde4:8dba:82e1::1", "fe80::1", "ff02::1", "2001:db8::1"];
    for (const ip of blocked) {
      expect(isPublicAddress(ip), ip).toBe(false);
    }
  });

  it("reduces IPv4-mapped IPv6 to the embedded IPv4", () => {
    expect(isPublicAddress("::ffff:127.0.0.1")).toBe(false);
    expect(isPublicAddress("::ffff:7f00:1")).toBe(false);
    expect(isPublicAddress("::ffff:8.8.8.8")).toBe(true);
  });

  it("reduces NAT64 addresses to the embedded IPv4", () => {
    expect(isPublicAddress("64:ff9b::7f00:1")).toBe(false);
    expect(isPublicAddress("64:ff9b::127.0.0.1")).toBe(false);
    expect(isPublicAddress("64:ff9b::808:808")).toBe(true);
  });

  it("reduces IPv4-compatible addresses to the embedded IPv4", () => {
    expect(isPublicAddress("::7f00:1")).toBe(false);
    expect(isPublicAddress("::127.0.0.1")).toBe(false);
  });

  it("allows globally routable IPv6", () => {
    expect(isPublicAddress("2606:4700:4700::1111")).toBe(true);
    expect(isPublicAddress("2001:4860:4860::8888")).toBe(true);
  });

  it("treats anything that is not a valid IP as non-public", () => {
    expect(isPublicAddress("example.com")).toBe(false);
    expect(isPublicAddress("not-an-ip")).toBe(false);
    expect(isPublicAddress("")).toBe(false);
  });
});
