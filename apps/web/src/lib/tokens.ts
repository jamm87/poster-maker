import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { env } from "./env";

export function randomToken(bytes = 24): string {
  return randomBytes(bytes).toString("base64url");
}

export function sign(value: string, secret = env().APP_SECRET): string {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

export function verify(value: string, signature: string, secret = env().APP_SECRET): boolean {
  const expected = Buffer.from(sign(value, secret));
  const given = Buffer.from(signature);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}
