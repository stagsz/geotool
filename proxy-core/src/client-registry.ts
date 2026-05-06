import { KvStore } from "./bot-detection/ip-updater";

export interface ClientConfig {
  upstreamUrl: string;
  renderServiceUrl?: string;
}

export async function getClientConfig(
  hostname: string,
  kv: KvStore
): Promise<ClientConfig | null> {
  return kv.get(`client-config:${hostname}`, "json") as Promise<ClientConfig | null>;
}
