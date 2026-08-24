const { encrypt, decrypt } = require("../src/utils/crypto");
const { normalizeMonth } = require("../src/utils/month");

const originalEncryptionKey = process.env.ENCRYPTION_KEY;

beforeAll(() => {
  process.env.ENCRYPTION_KEY = "ab".repeat(32);
});

afterAll(() => {
  if (originalEncryptionKey === undefined) {
    delete process.env.ENCRYPTION_KEY;
  } else {
    process.env.ENCRYPTION_KEY = originalEncryptionKey;
  }
});

describe("field encryption", () => {
  test("round-trips sensitive data without storing plaintext", () => {
    const plaintext = "+1-202-555-0147";
    const encrypted = encrypt(plaintext);

    expect(encrypted).not.toContain(plaintext);
    expect(decrypt(encrypted)).toBe(plaintext);
  });

  test("uses a fresh IV for repeated values", () => {
    expect(encrypt("same value")).not.toBe(encrypt("same value"));
  });

  test("rejects malformed encrypted data", () => {
    expect(() => decrypt("not-an-encrypted-value")).toThrow("Malformed encrypted payload");
  });
});

describe("month normalization", () => {
  test.each([
    ["2026-08", "2026-08-01"],
    ["2026-08-24", "2026-08-01"],
  ])("normalizes %s", (input, expected) => {
    expect(normalizeMonth(input)).toBe(expected);
  });

  test.each(["", "2026-00", "2026-13", "August 2026"])("rejects %s", (input) => {
    expect(() => normalizeMonth(input)).toThrow("month must be in YYYY-MM format");
  });
});
