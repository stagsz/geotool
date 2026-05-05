import { BOT_PROFILES } from "./registry";

export interface KvStore {
  get(key: string, type: "json"): Promise<unknown>;
  put(
    key: string,
    value: string,
    options?: { expirationTtl?: number }
  ): Promise<void>;
}

export async function fetchIpRangesForBot(
  botId: string,
  registryUrl: string
): Promise<string[]> {
  try {
    const response = await fetch(registryUrl, {
      headers: { "User-Agent": "LLMProxy-IPUpdater/1.0" },
    });
    if (!response.ok) {
      throw new Error(`Registry fetch failed: ${response.status}`);
    }
    const text = await response.text();
    const trimmed = text.trim();
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      return extractCidrsFromJson(JSON.parse(trimmed));
    }
    return trimmed
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith("#"));
  } catch (err) {
    console.error(`Failed to fetch IP ranges for ${botId}:`, err);
    return [];
  }
}

function extractCidrsFromJson(data: unknown): string[] {
  if (Array.isArray(data)) {
    return data.filter((s): s is string => typeof s === "string");
  }
  if (data !== null && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    for (const key of ["prefixes", "ipRanges", "ranges", "cidrs", "ips"]) {
      if (Array.isArray(obj[key])) {
        return (obj[key] as unknown[]).flatMap((item) => {
          if (typeof item === "string") return [item];
          if (item !== null && typeof item === "object") {
            const r = item as Record<string, string>;
            const cidr =
              r["ipv4Prefix"] || r["ipv6Prefix"] || r["prefix"] || "";
            return cidr ? [cidr] : [];
          }
          return [];
        });
      }
    }
  }
  return [];
}

export function isIpInCidr(ip: string, cidr: string): boolean {
  const slashIdx = cidr.indexOf("/");
  if (slashIdx === -1) return ip === cidr;

  const network = cidr.slice(0, slashIdx);
  const bits = parseInt(cidr.slice(slashIdx + 1), 10);

  const ipNum = ipToUint32(ip);
  const networkNum = ipToUint32(network);
  const maskNum = bits === 0 ? 0 : ((~0 << (32 - bits)) >>> 0);

  return ((ipNum & maskNum) >>> 0) === ((networkNum & maskNum) >>> 0);
}

function ipToUint32(ip: string): number {
  return (
    ip
      .split(".")
      .reduce((acc, octet) => acc * 256 + parseInt(octet, 10), 0) >>> 0
  );
}

export async function updateIpRegistries(kv: KvStore): Promise<void> {
  for (const profile of BOT_PROFILES) {
    const ranges = await fetchIpRangesForBot(profile.id, profile.ipRegistryUrl);
    if (ranges.length === 0) continue;

    const existing = (await kv.get(
      `ip-ranges:${profile.id}`,
      "json"
    )) as string[] | null;

    if (existing && existing.length > 0) {
      const changeRatio =
        Math.abs(ranges.length - existing.length) / existing.length;
      if (changeRatio > 0.1) {
        console.warn(
          `[IP_REGISTRY] Large change detected for ${profile.id}: ${(changeRatio * 100).toFixed(1)}%`
        );
      }
    }

    await kv.put(`ip-ranges:${profile.id}`, JSON.stringify(ranges), {
      expirationTtl: 6 * 60 * 60,
    });
  }
}
