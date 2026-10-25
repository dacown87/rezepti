import { BlockList, isIP } from "node:net";

// Non-public IPv4 ranges (RFC 6890 + special-use). Everything listed here is
// either loopback, private, link-local, CGNAT, benchmark, documentation,
// multicast or reserved — none may be reached by a user-influenced fetch.
const ipv4Blocked = new BlockList();
for (const [network, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const) {
  ipv4Blocked.addSubnet(network, prefix, "ipv4");
}

// Non-public IPv6 ranges: unspecified, loopback, ULA, link-local, multicast,
// documentation.
const ipv6Blocked = new BlockList();
for (const [network, prefix] of [
  ["::", 128],
  ["::1", 128],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
  ["2001:db8::", 32],
] as const) {
  ipv6Blocked.addSubnet(network, prefix, "ipv6");
}

/**
 * Expands an IPv6 address (as accepted by `net.isIP`) into its eight 16-bit
 * groups. Returns `null` for anything that is not a valid IPv6 address.
 */
function ipv6ToGroups(ip: string): number[] | null {
  if (isIP(ip) !== 6) return null;

  // Convert a trailing embedded IPv4 (dotted-quad, e.g. `::ffff:127.0.0.1`) into
  // its two hex groups first, so the `::` expansion below stays uniform.
  let str = ip;
  const lastColon = str.lastIndexOf(":");
  const tail = str.slice(lastColon + 1);
  if (tail.includes(".")) {
    if (isIP(tail) !== 4) return null;
    const octets = tail.split(".").map((part) => Number(part));
    if (octets.length !== 4 || octets.some((o) => !Number.isInteger(o) || o < 0 || o > 255)) {
      return null;
    }
    const high = (octets[0] << 8) | octets[1];
    const low = (octets[2] << 8) | octets[3];
    str = `${str.slice(0, lastColon + 1)}${high.toString(16)}:${low.toString(16)}`;
  }

  const doubleColon = str.indexOf("::");
  const head = doubleColon === -1 ? str : str.slice(0, doubleColon);
  const tailStr = doubleColon === -1 ? "" : str.slice(doubleColon + 2);

  const headGroups = head.length > 0 ? head.split(":") : [];
  const tailGroups = tailStr.length > 0 ? tailStr.split(":") : [];

  const middleCount = 8 - headGroups.length - tailGroups.length;

  const parseGroup = (group: string): number | null => {
    if (group.length === 0 || group.length > 4 || !/^[0-9a-f]+$/i.test(group)) return null;
    return parseInt(group, 16);
  };

  const groups: number[] = [];
  for (const group of headGroups) {
    const value = parseGroup(group);
    if (value === null) return null;
    groups.push(value);
  }
  if (middleCount < 0) return null;
  for (let i = 0; i < middleCount; i++) groups.push(0);
  for (const group of tailGroups) {
    const value = parseGroup(group);
    if (value === null) return null;
    groups.push(value);
  }

  if (groups.length !== 8) return null;
  return groups;
}

/**
 * Returns the dotted-quad IPv4 embedded in an IPv4-mapped (`::ffff:0:0/96`),
 * NAT64 (`64:ff9b::/96`) or IPv4-compatible (`::/96`) IPv6 address, or `null`
 * when the address is none of those forms. The embedded IPv4 is then checked
 * against the IPv4 block list, so `::ffff:127.0.0.1` is blocked while
 * `::ffff:8.8.8.8` stays public.
 */
function embeddedIpv4(ip: string): string | null {
  const groups = ipv6ToGroups(ip);
  if (!groups) return null;

  const isMapped =
    groups[0] === 0 && groups[1] === 0 && groups[2] === 0 &&
    groups[3] === 0 && groups[4] === 0 && groups[5] === 0xffff;
  const isNat64 =
    groups[0] === 0x0064 && groups[1] === 0xff9b &&
    groups[2] === 0 && groups[3] === 0 && groups[4] === 0 && groups[5] === 0;
  const isCompatible =
    groups[0] === 0 && groups[1] === 0 && groups[2] === 0 &&
    groups[3] === 0 && groups[4] === 0 && groups[5] === 0;

  if (!isMapped && !isNat64 && !isCompatible) return null;

  const high = groups[6];
  const low = groups[7];
  return `${high >> 8}.${high & 0xff}.${low >> 8}.${low & 0xff}`;
}

/**
 * True only for a globally routable unicast address. Anything `net.isIP` does
 * not recognise as an IP is not public. IPv4-mapped/NAT64/IPv4-compatible IPv6
 * addresses are reduced to their embedded IPv4 and checked there.
 */
export function isPublicAddress(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) {
    return !ipv4Blocked.check(ip, "ipv4");
  }
  if (version === 6) {
    const embedded = embeddedIpv4(ip);
    if (embedded !== null) {
      return !ipv4Blocked.check(embedded, "ipv4");
    }
    return !ipv6Blocked.check(ip, "ipv6");
  }
  return false;
}
