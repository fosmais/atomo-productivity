import { createHash } from "node:crypto";

/**
 * Stable action fingerprint for server-side proposal persistence.
 * Only accept JSON-compatible payloads. Do not include secrets or PII in logs.
 * The digest binds the exact action, owner and normalized payload to approval.
 */
type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
function normalize(value: JsonValue, ancestors = new Set<object>()): JsonValue {
  if (value === undefined || typeof value === "function" || typeof value === "symbol" || typeof value === "bigint") {
    throw new Error("Unsupported JSON payload value");
  }
  if (Array.isArray(value)) {
    if (ancestors.has(value)) throw new Error("Circular JSON payload");
    ancestors.add(value);
    try {
      if (Array.from({ length: value.length }, (_, i) => i).some(i => !(i in value))) throw new Error("Sparse JSON array");
      return value.map(item => normalize(item, ancestors));
    } finally { ancestors.delete(value); }
  }
  if (value !== null && typeof value === "object") {
    if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) {
      throw new Error("Non-plain JSON object");
    }
    if (ancestors.has(value)) throw new Error("Circular JSON payload");
    ancestors.add(value);
    try { return Object.fromEntries(Object.keys(value).sort().map(key => [key, normalize(value[key], ancestors)])); }
    finally { ancestors.delete(value); }
  }
  if (typeof value === "number" && !Number.isFinite(value)) throw new Error("Invalid JSON number");
  return value;
}
export function mikaActionDigest(input: { userId: string; actionId: string; kind: string; payload: JsonValue }): string {
  if (!input.userId || !input.actionId || !input.kind) throw new Error("Missing action identity");
  if (input.payload === undefined) throw new Error("Missing action payload");
  const serialized = JSON.stringify(normalize({
    version: 1, userId: input.userId, actionId: input.actionId, kind: input.kind, payload: input.payload
  }));
  return createHash("sha256").update(serialized).digest("hex");
}
