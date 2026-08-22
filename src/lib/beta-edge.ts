export const BETA_COOKIE_NAME = "zeon_beta_access";

function decodeBase64Url(value: string) {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padding = "=".repeat((4 - (normalized.length % 4)) % 4);
  const decoded = atob(`${normalized}${padding}`);
  return Uint8Array.from(decoded, (character) => character.charCodeAt(0));
}

export async function verifyBetaTokenEdge(token: string | undefined, now = Math.floor(Date.now() / 1000)) {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 4 || parts[0] !== "beta" || parts[1] !== "v1") return false;
  const expiresAt = Number(parts[2]);
  const secret = process.env.ZEON_BETA_SESSION_SECRET || process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || "";
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= now || !secret) return false;

  try {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );
    return await crypto.subtle.verify(
      "HMAC",
      key,
      decodeBase64Url(parts[3]),
      new TextEncoder().encode(parts.slice(0, 3).join(".")),
    );
  } catch {
    return false;
  }
}
