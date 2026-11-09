import { createHash } from "node:crypto";

/**
 * Stable action fingerprint for server-side proposal persistence.
 * Only accept JSON-compatible payloads. Do not include secrets or PII in logs.
 * The digest binds the exact action, owner and normalized payload to approval.
 */
type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
function normalize(value: JsonValue): JsonValue {
  if (Array.isArray(value)) return value.map(normalize);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, normalize(value[key])]));
  }
  if (typeof value === "number" && !Number.isFinite(value)) throw new Error("Invalid JSON number");
  return value;
}
export function mikaActionDigest(input: { userId: string; actionId: string; kind: string; payload: JsonValue }): string {
  if (!input.userId || !input.actionId || !input.kind) throw new Error("Missing action identity");
  const serialized = JSON.stringify(normalize({
    version: 1, userId: input.userId, actionId: input.actionId, kind: input.kind, payload: input.payload
  }));
  return createHash("sha256").update(serialized).digest("hex");
}
