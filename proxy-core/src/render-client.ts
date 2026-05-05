export async function fetchRendered(
  url: string,
  renderServiceUrl: string
): Promise<string | null> {
  if (!renderServiceUrl) return null;
  try {
    const endpoint = new URL("/render", renderServiceUrl);
    endpoint.searchParams.set("url", url);
    const response = await fetch(endpoint.toString(), {
      signal: AbortSignal.timeout(5_000),
    });
    if (response.status === 200) return response.text();
    return null;
  } catch {
    return null;
  }
}
