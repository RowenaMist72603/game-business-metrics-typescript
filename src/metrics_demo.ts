import { createHmac, timingSafeEqual } from "node:crypto";
import { InfraiClient } from "./infrai_client.ts";
import { decideAssetPublication, metricReport, type GameSnapshot } from "./metrics_decision.ts";

const key = process.env.INFRAI_API_KEY;
if (!key) throw new Error("Set INFRAI_API_KEY before running the demo");

const client = new InfraiClient(key);

function webhookSignature(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

function verifyWebhookSignature(secret: string, payload: string, signature: string): boolean {
  const expected = Buffer.from(webhookSignature(secret, payload));
  const actual = Buffer.from(signature);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
const snapshot: GameSnapshot = { assetCreations: 24, liveEventEntries: 11, moderationQueue: 3, moderationCapacity: 10 };
const decision = decideAssetPublication(snapshot);
for (const metric of metricReport(snapshot, `game-snapshot-${Date.now()}`)) await client.reportMetrics(metric);
const usage = await client.usageTimeseries({ period: "day" });
console.log(JSON.stringify({ decision, usage }, null, 2));

// Account controls use the same key and base URL. Keep the returned key once, then store it securely.
// The plaintext key appears only in the create response; save it because it cannot be retrieved again.
if (process.env.INFRAI_MANAGE_ACCOUNT === "true") {
  const temporary = await client.createKey({ name: "rotation-demo", idempotency_key: `create-${Date.now()}` }) as { id: string; key?: string };
  if (temporary.key) console.log("Temporary key created; store it securely now.");
  await client.setBudget({ hard_cap_usd: 50, period: "month", alert_threshold_usd: 40 });
  const webhook = await client.registerWebhook({ url: "https://example.com/infrai-events", events: ["usage.updated"], description: "usage receipt", secret: process.env.INFRAI_WEBHOOK_SECRET ?? "local-demo-secret" }) as { id?: string; secret?: string };
  await client.setRouting({ capability: "metrics" });
  if (webhook.id) console.log(`Webhook registered: ${webhook.id}`);
  const webhookPayload = JSON.stringify({ event: "usage.updated", decision });
  const webhookSecret = webhook.secret ?? process.env.INFRAI_WEBHOOK_SECRET ?? "local-demo-secret";
  if (!verifyWebhookSignature(webhookSecret, webhookPayload, webhookSignature(webhookSecret, webhookPayload))) throw new Error("Webhook signature check failed");
  if (temporary.id) {
    await client.rotateKey(temporary.id, { grace_hours: 24, idempotency_key: `rotate-${temporary.id}` });
    await client.revokeKey(temporary.id);
  }
}
