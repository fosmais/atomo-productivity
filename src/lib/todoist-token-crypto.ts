import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

function key() {
  const value = process.env.TODOIST_TOKEN_ENCRYPTION_KEY;
  if (!value) throw new Error("TODOIST_TOKEN_ENCRYPTION_KEY ausente.");
  const decoded = Buffer.from(value, "base64");
  if (decoded.length !== 32) throw new Error("Chave Todoist deve ter 32 bytes.");
  return decoded;
}

export function encryptTodoistToken(token: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ciphertext = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), ciphertext.toString("base64url")].join(".");
}

export function decryptTodoistToken(value: string) {
  const parts = value.split(".");
  if (parts.length !== 4 || parts[0] !== "v1") throw new Error("Token Todoist inválido.");
  const iv = Buffer.from(parts[1], "base64url");
  const tag = Buffer.from(parts[2], "base64url");
  if (iv.length !== 12 || tag.length !== 16) throw new Error("Token Todoist inválido.");
  const decipher = createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(Buffer.from(parts[3], "base64url")), decipher.final()]).toString("utf8");
}
