export const ZCoinPolicy = {
  // DEV (non-owner admin) limits.
  // NPN1_DEV bypasses these limits server-side.
  DEV_GRANT_PER_OPERATION: 10_000,
  DEV_REVOKE_PER_OPERATION: 5_000,
  DEV_GRANT_DAILY_LIMIT: 50_000,
  DEV_REVOKE_DAILY_LIMIT: 25_000,
  DEV_TOTAL_DAILY_LIMIT: 75_000,
  DEV_USER_GRANT_DAILY_LIMIT: 20_000,
  DEV_USER_REVOKE_DAILY_LIMIT: 10_000,
  DEV_GRANT_DAILY_OPERATIONS: 20,
  DEV_REVOKE_DAILY_OPERATIONS: 20,

  // Owner-only: no policy cap is applied by the Z-Coin mutation layer.
  OWNER_ROLE: "NPN1_DEV",

  SYSTEM_MAX_OPERATION: 1_000_000_000,
} as const;

export function startOfDay() {
  return new Date(Date.now() - 24 * 60 * 60 * 1000);
}
