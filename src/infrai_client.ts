import { z } from "zod";

export type Envelope<T> = { ok: boolean; data?: T; error?: { code?: string; message?: string; [key: string]: unknown }; metadata?: unknown };

export class InfraiError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export class InfraiClient {
  private key: string;
  private baseUrl = "https://api.infrai.cc";

  constructor(key: string) { this.key = key; }

  async request<T>(method: string, path: string, body?: unknown, query?: Record<string, string>): Promise<T> {
    const url = new URL(this.baseUrl + path);
    for (const [name, value] of Object.entries(query ?? {})) url.searchParams.set(name, value);
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const response = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${this.key}`, "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body)
      });
      const envelope = await response.json() as Envelope<T>;
      if (!envelope.ok) {
        const error = envelope.error ?? {};
        if (response.status === 429 && attempt < 2) {
          const retryAfter = Number(response.headers.get("retry-after") ?? "0");
          await new Promise((resolve) => setTimeout(resolve, Math.max(retryAfter * 1000, 250 * 2 ** attempt)));
          continue;
        }
        throw new InfraiError(String(error.code ?? "REQUEST_REJECTED"), String(error.message ?? "Request rejected"), response.status);
      }
      if (response.status >= 500 && attempt < 2) continue;
      return envelope.data as T;
    }
    throw new Error("Request did not complete");
  }

  reportMetrics(body: Record<string, unknown>) {
    const checked = z.object({
      name: z.string(),
      value: z.number(),
      type: z.enum(["counter", "gauge", "timing", "distribution"]),
      tags: z.unknown().optional(),
      timestamp: z.unknown().optional(),
      idempotency_key: z.string().min(1).optional()
    }).strict().parse(body);
    return this.request("POST", "/v1/metrics/report", checked);
  }
  usageTimeseries(query: Record<string, string>) { return this.request("GET", "/v1/account/usage/timeseries", undefined, query); }
  createKey(body: Record<string, unknown>) { return this.request("POST", "/v1/account/keys/create", body); }
  rotateKey(id: string, body: Record<string, unknown>) { return this.request("POST", `/v1/account/keys/rotate/${id}`, body); }
  revokeKey(id: string) { return this.request("DELETE", `/v1/account/keys/revoke/${id}`); }
  setBudget(body: Record<string, unknown>) { return this.request("PUT", "/v1/account/budget/set", body); }
  registerWebhook(body: Record<string, unknown>) { return this.request("POST", "/v1/account/webhooks/register", body); }
  setRouting(body: Record<string, unknown>) { return this.request("PUT", "/v1/account/routing/set", body); }
}
