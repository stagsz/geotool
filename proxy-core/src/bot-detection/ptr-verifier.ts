export async function verifyPtr(
  ip: string,
  expectedDomain: string,
  fetcher: typeof fetch = fetch
): Promise<boolean> {
  if (!ip) return false;
  const parts = ip.split(".");
  if (parts.length !== 4) return false;

  const reversed = parts.reverse().join(".") + ".in-addr.arpa";
  try {
    const res = await fetcher(
      `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(reversed)}&type=PTR`,
      {
        headers: { accept: "application/dns-json" },
        signal: AbortSignal.timeout(2000),
      }
    );
    if (!res.ok) return false;
    const data = (await res.json()) as {
      Answer?: Array<{ type: number; data: string }>;
    };
    const ptrs = (data.Answer ?? [])
      .filter((r) => r.type === 12)
      .map((r) => r.data.replace(/\.$/, ""));
    return ptrs.some(
      (ptr) => ptr === expectedDomain || ptr.endsWith("." + expectedDomain)
    );
  } catch {
    return false;
  }
}
