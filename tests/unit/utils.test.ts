import { describe, it, expect } from "vitest";
import { encrypt, decrypt, cn } from "../../src/lib/utils";

describe("encrypt / decrypt", () => {
  const KEY = "test-secret-key-for-unit-tests";

  it("round-trips a plain string", () => {
    const plain = "my-api-key-12345";
    expect(decrypt(encrypt(plain, KEY), KEY)).toBe(plain);
  });

  it("produces different ciphertext each call (random IV)", () => {
    const plain = "same-input";
    const c1 = encrypt(plain, KEY);
    const c2 = encrypt(plain, KEY);
    expect(c1).not.toBe(c2);
    // Both decrypt to original
    expect(decrypt(c1, KEY)).toBe(plain);
    expect(decrypt(c2, KEY)).toBe(plain);
  });

  it("ciphertext is hex:hex format", () => {
    const c = encrypt("test", KEY);
    const parts = c.split(":");
    expect(parts).toHaveLength(2);
    expect(parts[0]).toMatch(/^[0-9a-f]{32}$/); // 16-byte IV
    expect(parts[1]).toMatch(/^[0-9a-f]+$/);
  });

  it("throws when decrypting with wrong key", () => {
    const c = encrypt("secret", KEY);
    expect(() => decrypt(c, "wrong-key")).toThrow();
  });

  it("round-trips special characters", () => {
    const plain = "key!@#$%^&*()_+-=[]{}|;':\",./<>?";
    expect(decrypt(encrypt(plain, KEY), KEY)).toBe(plain);
  });

  it("round-trips empty string", () => {
    expect(decrypt(encrypt("", KEY), KEY)).toBe("");
  });
});

describe("cn (className utility)", () => {
  it("merges class names", () => {
    expect(cn("a", "b")).toBe("a b");
  });

  it("handles falsy values", () => {
    expect(cn("a", false && "b", undefined, null as unknown as string)).toBe("a");
  });

  it("resolves Tailwind conflicts — last wins", () => {
    const result = cn("p-4", "p-8");
    expect(result).toBe("p-8");
  });

  it("handles conditional classes", () => {
    const active = true;
    expect(cn("base", active && "active")).toBe("base active");
  });
});
