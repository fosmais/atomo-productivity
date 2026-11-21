import "server-only";
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";

function getEncryptionKey(): Buffer {
  const encoded = process.env.GOOGLE_TOKEN_ENCRYPTION_KEY;

  if (!encoded) {
    throw new Error("Chave de criptografia Google não configurada.");
  }

  const key = Buffer.from(encoded, "base64");

  if (key.length !== 32) {
    throw new Error("A chave de criptografia deve conter 32 bytes.");
  }

  return key;
}

export function encryptGoogleToken(token: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv);

  const encrypted = Buffer.concat([
    cipher.update(token, "utf8"),
    cipher.final(),
  ]);

  const tag = cipher.getAuthTag();

  return [
    "v1",
    iv.toString("base64url"),
    tag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}

export function decryptGoogleToken(value: string): string {
  const parts = value.split(".");

  if (parts.length !== 4 || parts[0] !== "v1") {
    throw new Error("Formato de token criptografado inválido.");
  }

  const [, ivEncoded, tagEncoded, encryptedEncoded] = parts;

  const iv = Buffer.from(ivEncoded, "base64url");
  const tag = Buffer.from(tagEncoded, "base64url");
  const encrypted = Buffer.from(encryptedEncoded, "base64url");

  if (iv.length !== 12 || tag.length !== 16) {
    throw new Error("Parâmetros de criptografia inválidos.");
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    getEncryptionKey(),
    iv
  );

  decipher.setAuthTag(tag);

  return Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]).toString("utf8");
}