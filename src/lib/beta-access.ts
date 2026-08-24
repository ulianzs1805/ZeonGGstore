import { createHmac, timingSafeEqual } from "node:crypto";

export const BETA_COOKIE_NAME = "zeon_beta_access";
// Keep beta access across normal redeploys and long testing sessions.
// The cookie is tied to the site's domain, so deployments on the same stable
// domain do not require entering the beta code again.
export const BETA_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

function getSessionSecret() {
  return process.env.ZEON_BETA_SESSION_SECRET || process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || "";
}

function toBase64Url(value: Buffer) {
  return value.toString("base64url");
}

function signature(payload: string) {
  const secret = getSessionSecret();
  if (!secret) return "";
  return toBase64Url(createHmac("sha256", secret).update(payload).digest());
}

export function createBetaToken(now = Math.floor(Date.now() / 1000)) {
  const expiresAt = now + BETA_COOKIE_MAX_AGE;
  const payload = `beta.v1.${expiresAt}`;
  const signed = signature(payload);
  return signed ? `${payload}.${signed}` : "";
}

export function verifyBetaToken(token: string | undefined, now = Math.floor(Date.now() / 1000)) {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 4 || parts[0] !== "beta" || parts[1] !== "v1") return false;
  const expiresAt = Number(parts[2]);
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= now) return false;
  const expected = signature(parts.slice(0, 3).join("."));
  if (!expected || expected.length !== parts[3].length) return false;
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(parts[3]));
  } catch {
    return false;
  }
}

export function isBetaConfigured() {
  return Boolean(process.env.ZEON_BETA_CODE && getSessionSecret());
}

export function isBetaCodeValid(input: string) {
  const configuredCode = process.env.ZEON_BETA_CODE;
  if (!configuredCode || Buffer.byteLength(input) !== Buffer.byteLength(configuredCode)) return false;
  try {
    return timingSafeEqual(Buffer.from(input), Buffer.from(configuredCode));
  } catch {
    return false;
  }
}