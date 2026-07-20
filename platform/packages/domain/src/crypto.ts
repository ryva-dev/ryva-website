import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual
} from "node:crypto";
const parameters = { cost: 16_384, blockSize: 8, parallelization: 1, keyLength: 64 };

function derive(password: string, salt: Buffer, keyLength: number, cost: number, blockSize: number, parallelization: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(
      password,
      salt,
      keyLength,
      { N: cost, r: blockSize, p: parallelization },
      (error, value) => {
        if (error) reject(error);
        else resolve(value);
      }
    );
  });
}

export async function hashPassword(password: string, pepper = ""): Promise<string> {
  if (password.length < 14 || password.length > 256) {
    throw new Error("Password must be between 14 and 256 characters.");
  }
  const salt = randomBytes(16);
  const derived = await derive(
    `${password}${pepper}`,
    salt,
    parameters.keyLength,
    parameters.cost,
    parameters.blockSize,
    parameters.parallelization
  );
  return [
    "scrypt",
    parameters.cost,
    parameters.blockSize,
    parameters.parallelization,
    salt.toString("base64url"),
    derived.toString("base64url")
  ].join("$");
}

export async function verifyPassword(password: string, encoded: string, pepper = ""): Promise<boolean> {
  const [algorithm, cost, blockSize, parallelization, saltValue, expectedValue] = encoded.split("$");
  if (
    algorithm !== "scrypt" ||
    !cost ||
    !blockSize ||
    !parallelization ||
    !saltValue ||
    !expectedValue
  ) {
    return false;
  }
  const expected = Buffer.from(expectedValue, "base64url");
  const actual = await derive(
    `${password}${pepper}`,
    Buffer.from(saltValue, "base64url"),
    expected.length,
    Number(cost),
    Number(blockSize),
    Number(parallelization)
  );
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function secureDigest(value: string, pepper: string): string {
  return createHmac("sha256", pepper || "development-only-pepper").update(value).digest("hex");
}

export function publicDigest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function encryptionKey(raw: string): Buffer {
  const key = /^[a-f0-9]{64}$/i.test(raw) ? Buffer.from(raw, "hex") : Buffer.from(raw, "base64");
  if (key.length !== 32) throw new Error("FIELD_ENCRYPTION_KEY must decode to exactly 32 bytes.");
  return key;
}

export function encryptSecret(value: string, rawKey: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(rawKey), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map((part) => part.toString("base64url")).join(".");
}

export function decryptSecret(value: string, rawKey: string): string {
  const [ivValue, tagValue, encryptedValue] = value.split(".");
  if (!ivValue || !tagValue || !encryptedValue) throw new Error("Invalid encrypted value.");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(rawKey),
    Buffer.from(ivValue, "base64url")
  );
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, "base64url")),
    decipher.final()
  ]).toString("utf8");
}
