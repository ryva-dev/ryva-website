const VERIFIED_MODES = new Set(["verify", "verify-full"]);

/**
 * Map Ryva's explicit PGSSL policy onto node-postgres options.
 * - verify-full (default): encrypted and certificate-verified.
 * - require: encrypted, but accepts a provider-managed/self-signed chain.
 * - disable: plaintext; intended only for an already-encrypted local/private transport.
 */
export function resolvePostgresSsl(rawMode = process.env.PGSSL) {
  const mode = String(rawMode ?? "verify-full").trim().toLowerCase() || "verify-full";
  if (mode === "disable") return false;
  if (mode === "require") return { rejectUnauthorized: false };
  if (VERIFIED_MODES.has(mode)) return { rejectUnauthorized: true };
  throw new Error('PGSSL must be one of "verify-full", "verify", "require", or "disable".');
}
