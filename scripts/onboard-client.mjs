#!/usr/bin/env node
import { parseArgs } from "node:util";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const { values } = parseArgs({
  options: {
    hostname: { type: "string" },
    "upstream-url": { type: "string" },
    "render-service-url": { type: "string" },
    "events-api-key": { type: "string" },
  },
});

const hostname = values["hostname"];
const upstreamUrl = values["upstream-url"];

if (!hostname || !upstreamUrl) {
  console.error(
    `Usage: node scripts/onboard-client.mjs
  --hostname <domain>
  --upstream-url <url>
  [--render-service-url <url>]
  [--events-api-key <key>]`
  );
  process.exit(1);
}

let namespaceId;
try {
  const wrangler = readFileSync("proxy-core/wrangler.toml", "utf8");
  const match = wrangler.match(/binding\s*=\s*"CLIENT_REGISTRY"[\s\S]*?id\s*=\s*"([^"]+)"/);
  if (match) namespaceId = match[1];
} catch {
  // fall through to --binding flag
}

const config = {
  upstreamUrl,
  ...(values["render-service-url"] && { renderServiceUrl: values["render-service-url"] }),
  ...(values["events-api-key"] && { eventsApiKey: values["events-api-key"] }),
};

const key = `client-config:${hostname}`;
const value = JSON.stringify(config);
const nsArgs = namespaceId ? ["--namespace-id", namespaceId] : ["--binding", "CLIENT_REGISTRY"];
const args = ["wrangler", "kv", "key", "put", "--remote", ...nsArgs, key, value];

console.log(`\nOnboarding: ${hostname}`);
console.log(`Config:     ${value}`);
console.log(`\nRunning: npx ${args.join(" ")}\n`);

const result = spawnSync("npx", args, { stdio: "inherit", shell: true });
if (result.status !== 0) {
  console.error("\nFailed to write KV entry.");
  process.exit(result.status ?? 1);
}

console.log(`\nClient ${hostname} onboarded successfully.`);
console.log(`\nNext steps:`);
console.log(`  1. Add worker route in Cloudflare: ${hostname}/* -> llm-proxy-core`);
console.log(`  2. Point ${hostname} DNS to the Cloudflare Worker (or use Cloudflare for SaaS)`);
console.log(`  3. Test with a spoofed GPTBot request:`);
console.log(`     curl -s https://${hostname}/ \\`);
console.log(`       -H "User-Agent: Mozilla/5.0 (compatible; GPTBot/1.1; +https://openai.com/gptbot)" \\`);
console.log(`       -H "x-forwarded-for: 74.7.175.130" -I`);
