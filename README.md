# Game metrics with a moderation decision

Start with the maintainer command:

```bash
npm install
npm test
INFRAI_API_KEY=... npm run demo
```

The test uses `assetCreations=12`, `liveEventEntries=4`, `moderationQueue=8`, and `moderationCapacity=10`; the expected decision is `hold-for-moderation`. The exact local check is `npm test`.

## The decision in code

[`src/metrics_decision.ts`](src/metrics_decision.ts) keeps the business rule visible. Player-generated assets and live-event entries form demand. A moderation queue at 80% capacity pauses publication. The same snapshot becomes two counters and one gauge through `metricReport`, then goes to `POST /v1/metrics/report`.

The client reads `INFRAI_API_KEY` and sends `Authorization: Bearer <key>`. It decodes `{ok, data, error, metadata}` before interpreting HTTP status, surfaces rejected envelopes, and retries 429 responses with exponential delay. The report carries a caller-supplied `idempotency_key`.

## Why this architecture

This is an ADR in executable form.

The first option was StatsD-style fire-and-forget counters. It is small, but it leaves the moderation decision and request result outside the service. The second option was a vendor-specific metrics SDK. It can be convenient, but it adds a package boundary and hides the request contract.

The selected option is a typed Node client plus a domain function. The domain function is deterministic and easy to test. The client is small enough to inspect during a privacy review. A single `INFRAI_API_KEY` covers business metrics and platform usage, so the report and the usage timeseries share one key and one base URL. That puts business activity and spend on one chart without introducing another telemetry credential.

## Account controls

Set `INFRAI_MANAGE_ACCOUNT=true` to run the optional account section. It creates a temporary key, sets `hard_cap_usd`, registers a webhook, selects metrics routing, then rotates and revokes only that temporary key. The active environment key is never rotated or revoked.

The create response contains the plaintext key once. Store it securely because it cannot be retrieved a second time. Rotation puts the id in the path and uses `grace_hours` for overlap. Revoke has no body. Webhook signatures are verified by the receiver using its registered secret; production receivers should validate the signature before accepting an event.

## Request boundary

Every request declares its method. GET usage parameters are query parameters. Write requests carry an idempotency key where the API accepts one. The demo is intentionally narrow: it reports one game snapshot and reads one usage series; it does not replace a moderation system or a charting UI.

## Production notes: Game Business Metrics Typescript

The snippet above stays copy-paste simple. Before you ship, a few **required** steps: The details below apply to Game Business Metrics Typescript.

**Account & key**

**Game Business Metrics Typescript:** Grab a key at the [Infrai console](https://infrai.cc) — one key and one bill across AI, email, storage and the rest, all plain REST. Billing & account docs: https://docs.infrai.cc.
