import { beforeAll, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";

beforeAll(() => {
  process.env.TOKEN_ENCRYPTION_KEY = randomBytes(32).toString("base64");
});

describe("token encryption (AES-256-GCM)", () => {
  it("round-trips and never stores plaintext", async () => {
    const { decryptSecret, encryptSecret } = await import("@/lib/crypto");
    const sealed = encryptSecret("EAAG-secret-token");
    expect(sealed.startsWith("v1.")).toBe(true);
    expect(sealed).not.toContain("EAAG");
    expect(decryptSecret(sealed)).toBe("EAAG-secret-token");
    expect(encryptSecret("same")).not.toBe(encryptSecret("same")); // random IV
  });

  it("rejects tampered ciphertext", async () => {
    const { decryptSecret, encryptSecret } = await import("@/lib/crypto");
    const [v, iv, tag, data] = encryptSecret("secret").split(".");
    const flipped = Buffer.from(data, "base64url");
    flipped[0] ^= 1;
    expect(() => decryptSecret([v, iv, tag, flipped.toString("base64url")].join("."))).toThrow();
  });
});
