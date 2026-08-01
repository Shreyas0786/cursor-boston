/**
 * @jest-environment node
 */

/**
 * Property-based tests for the security-sensitive parsing surfaces.
 *
 * These assert invariants that must hold for *every* input, not just the
 * hand-picked examples covered by the example-based suites alongside this
 * file. Each property states something a caller depends on for safety —
 * "a sanitized doc ID can never contain a path separator" — rather than the
 * weaker "arbitrary input does not throw".
 *
 * Surfaces covered:
 *   - lib/sanitize.ts    text / name / URL / Firestore doc ID normalization
 *   - lib/client-ip.ts   proxy header parsing
 *   - lib/github.ts      HMAC webhook signature verification
 *   - lib/api-schemas/   Zod request-boundary validation
 */

import { createHmac } from "crypto";
import fc from "fast-check";

import {
  sanitizeText,
  sanitizeName,
  sanitizeUrl,
  sanitizeDocId,
  isValidHackathonId,
} from "@/lib/sanitize";
import { getClientIp } from "@/lib/client-ip";
import { PaginationQuerySchema } from "@/lib/api-schemas/common";

/* ------------------------------------------------------------------ */
/*  lib/github requires a little setup                                 */
/* ------------------------------------------------------------------ */

// The module snapshots GITHUB_WEBHOOK_SECRET at import time, so the env var
// has to be assigned before the require() below. Its Firestore and logger
// imports are stubbed purely so the module loads —  verifyWebhookSignature
// itself touches neither.
const WEBHOOK_SECRET = "property-test-webhook-secret";
process.env.GITHUB_WEBHOOK_SECRET = WEBHOOK_SECRET;

jest.mock("@/lib/firebase-admin", () => ({ getAdminDb: () => null }));
jest.mock("@/lib/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    logError: jest.fn(),
  },
}));
jest.mock("firebase-admin/firestore", () => ({
  FieldValue: {
    serverTimestamp: () => "SERVER_TS",
    increment: (n: number) => n,
  },
}));

const { verifyWebhookSignature } = require("@/lib/github") as typeof import("@/lib/github");

/* ------------------------------------------------------------------ */
/*  Arbitraries                                                        */
/* ------------------------------------------------------------------ */

/**
 * Strings biased toward the characters these functions exist to handle:
 * control bytes, whitespace variants, path separators, and protocol
 * prefixes. Plain `fc.string()` rarely generates a NUL byte or "../".
 */
const messyString = fc
  .array(
    fc.oneof(
      fc.string({ maxLength: 6 }),
      fc.constantFrom(
        " ",
        "\u0000", // NUL
        "\u0007", // BEL
        "\u001F", // unit separator - top of the stripped control range
        "\u007F", // DEL
        "\t",
        "\r",
        "\n",
        "\u00A0", // non-breaking space
        "<",
        ">",
        "&",
        '"',
        "'",
        "/",
        "\\",
        "..",
        ".",
        "javascript:",
        "data:",
        "file:",
        "http://",
        "https://"
      )
    ),
    { maxLength: 24 }
  )
  .map((parts) => parts.join(""));

/** A syntactically valid IPv4 address — no commas, no whitespace. */
const ipv4 = fc
  .tuple(fc.nat(255), fc.nat(255), fc.nat(255), fc.nat(255))
  .map(([a, b, c, d]) => `${a}.${b}.${c}.${d}`);

function requestWith(headers: Record<string, string>): Request {
  return new Request("https://example.com/api/test", { headers });
}

/* ------------------------------------------------------------------ */
/*  sanitizeText                                                       */
/* ------------------------------------------------------------------ */

describe("sanitizeText — properties", () => {
  it("is idempotent: sanitizing twice equals sanitizing once", () => {
    fc.assert(
      fc.property(messyString, (input) => {
        const once = sanitizeText(input);
        expect(sanitizeText(once)).toBe(once);
      })
    );
  });

  it("never leaves a stripped control character in the output", () => {
    // Matches exactly the class the implementation removes, plus \t and \r
    // which it folds into spaces. \n is deliberately preserved.
    fc.assert(
      fc.property(messyString, (input) => {
        expect(sanitizeText(input)).not.toMatch(
          /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\t\r]/
        );
      })
    );
  });

  it("never returns a string with leading or trailing whitespace", () => {
    fc.assert(
      fc.property(messyString, (input) => {
        const output = sanitizeText(input);
        expect(output).toBe(output.trim());
      })
    );
  });
});

/* ------------------------------------------------------------------ */
/*  sanitizeName                                                       */
/* ------------------------------------------------------------------ */

describe("sanitizeName — properties", () => {
  it("only ever emits characters from the allowed set", () => {
    fc.assert(
      fc.property(messyString, (input) => {
        expect(sanitizeName(input)).toMatch(/^[A-Za-z0-9 \-_.]*$/);
      })
    );
  });

  it("never emits two consecutive spaces", () => {
    fc.assert(
      fc.property(messyString, (input) => {
        expect(sanitizeName(input)).not.toMatch(/ {2}/);
      })
    );
  });

  it("is idempotent", () => {
    fc.assert(
      fc.property(messyString, (input) => {
        const once = sanitizeName(input);
        expect(sanitizeName(once)).toBe(once);
      })
    );
  });
});

/* ------------------------------------------------------------------ */
/*  sanitizeUrl                                                        */
/* ------------------------------------------------------------------ */

describe("sanitizeUrl — properties", () => {
  it("never returns a URL outside the http/https schemes", () => {
    // The security-critical one: a `javascript:` or `data:` URL reaching an
    // href would be an XSS vector. Non-null output must always be http(s).
    fc.assert(
      fc.property(messyString, (input) => {
        const output = sanitizeUrl(input);
        if (output !== null) {
          expect(output).toMatch(/^https?:\/\//);
        }
      })
    );
  });

  it("rejects every javascript: and data: URL regardless of casing or padding", () => {
    fc.assert(
      fc.property(
        fc.constantFrom("javascript", "JavaScript", "JAVASCRIPT", "data", "DATA", "file", "vbscript"),
        fc.string({ maxLength: 20 }),
        fc.nat(4),
        (scheme, rest, padding) => {
          const candidate = `${" ".repeat(padding)}${scheme}:${rest}`;
          expect(sanitizeUrl(candidate)).toBeNull();
        }
      )
    );
  });

  it("is idempotent on the URLs it accepts", () => {
    fc.assert(
      fc.property(messyString, (input) => {
        const once = sanitizeUrl(input);
        if (once !== null) {
          expect(sanitizeUrl(once)).toBe(once);
        }
      })
    );
  });
});

/* ------------------------------------------------------------------ */
/*  sanitizeDocId                                                      */
/* ------------------------------------------------------------------ */

describe("sanitizeDocId — properties", () => {
  it("never returns an ID containing a Firestore path separator", () => {
    // A "/" in a doc ID would let caller-supplied input escape into a
    // different collection path.
    fc.assert(
      fc.property(messyString, (input) => {
        const output = sanitizeDocId(input);
        if (output !== null) {
          expect(output).not.toContain("/");
        }
      })
    );
  });

  it("non-null results always satisfy the documented ID format and length cap", () => {
    fc.assert(
      fc.property(messyString, (input) => {
        const output = sanitizeDocId(input);
        if (output !== null) {
          expect(output).toMatch(/^[A-Za-z0-9_-]+$/);
          expect(output.length).toBeGreaterThan(0);
          expect(output.length).toBeLessThanOrEqual(1500);
        }
      })
    );
  });

  it("rejects the Firestore-reserved '.' and '..' identifiers", () => {
    expect(sanitizeDocId(".")).toBeNull();
    expect(sanitizeDocId("..")).toBeNull();
  });

  it("rejects anything longer than the 1500-character cap", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1501, max: 2000 }), (length) => {
        expect(sanitizeDocId("a".repeat(length))).toBeNull();
      })
    );
  });
});

/* ------------------------------------------------------------------ */
/*  isValidHackathonId                                                 */
/* ------------------------------------------------------------------ */

describe("isValidHackathonId — properties", () => {
  it("only accepts IDs free of uppercase and path separators", () => {
    fc.assert(
      fc.property(messyString, (input) => {
        if (isValidHackathonId(input)) {
          expect(input).not.toMatch(/[A-Z]/);
          expect(input).not.toContain("/");
          expect(input).not.toContain("\\");
        }
      })
    );
  });
});

/* ------------------------------------------------------------------ */
/*  getClientIp                                                        */
/* ------------------------------------------------------------------ */

describe("getClientIp — properties", () => {
  const originalHops = process.env.TRUSTED_PROXY_HOPS;

  beforeEach(() => {
    // Pin the hop count so the X-Forwarded-For selection is deterministic.
    delete process.env.TRUSTED_PROXY_HOPS;
  });

  afterAll(() => {
    if (originalHops === undefined) {
      delete process.env.TRUSTED_PROXY_HOPS;
    } else {
      process.env.TRUSTED_PROXY_HOPS = originalHops;
    }
  });

  it("never returns an empty or untrimmed value", () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 40 }), fc.string({ maxLength: 40 }), (xff, cf) => {
        const result = getClientIp(
          requestWith({ "x-forwarded-for": xff, "cf-connecting-ip": cf })
        );
        expect(result.length).toBeGreaterThan(0);
        expect(result).toBe(result.trim());
      })
    );
  });

  it("returns 'unknown' when no forwarding header carries a value", () => {
    fc.assert(
      fc.property(fc.stringMatching(/^[ \t]*$/), (blank) => {
        expect(getClientIp(requestWith({ "x-forwarded-for": blank }))).toBe("unknown");
      })
    );
  });

  it("never leaks the whole X-Forwarded-For list — it selects one entry", () => {
    // The default of one trusted hop means the right-most address wins; the
    // caller-controlled left-hand entries must never be returned verbatim.
    fc.assert(
      fc.property(fc.array(ipv4, { minLength: 1, maxLength: 8 }), (addresses) => {
        const result = getClientIp(
          requestWith({ "x-forwarded-for": addresses.join(", ") })
        );
        expect(result).not.toContain(",");
        expect(addresses).toContain(result);
        expect(result).toBe(addresses[addresses.length - 1]);
      })
    );
  });

  it("strips the brackets from a bracketed IPv6 literal", () => {
    fc.assert(
      fc.property(fc.constantFrom("::1", "2001:db8::1", "fe80::1"), (addr) => {
        expect(getClientIp(requestWith({ "x-vercel-forwarded-for": `[${addr}]` }))).toBe(addr);
      })
    );
  });
});

/* ------------------------------------------------------------------ */
/*  verifyWebhookSignature                                             */
/* ------------------------------------------------------------------ */

function signPayload(payload: string, secret = WEBHOOK_SECRET): string {
  return "sha256=" + createHmac("sha256", secret).update(payload).digest("hex");
}

describe("verifyWebhookSignature — properties", () => {
  it("accepts a correctly computed signature for any payload", () => {
    fc.assert(
      fc.property(messyString, (payload) => {
        expect(verifyWebhookSignature(payload, signPayload(payload))).toBe(true);
      })
    );
  });

  it("never throws, whatever the attacker puts in the signature header", () => {
    // Regression guard: comparing buffers of differing length used to throw
    // out of timingSafeEqual, turning a bad signature into a 500 instead of
    // the intended 401. Wrong-length signatures are exactly what property
    // generation produces in bulk.
    fc.assert(
      fc.property(messyString, fc.option(messyString, { nil: null }), (payload, signature) => {
        expect(() => verifyWebhookSignature(payload, signature)).not.toThrow();
      })
    );
  });

  it("rejects every signature that is not the exact expected digest", () => {
    fc.assert(
      fc.property(messyString, messyString, (payload, forged) => {
        fc.pre(forged !== signPayload(payload));
        expect(verifyWebhookSignature(payload, forged)).toBe(false);
      })
    );
  });

  it("rejects a signature computed with the wrong secret", () => {
    fc.assert(
      fc.property(messyString, fc.string({ minLength: 1, maxLength: 32 }), (payload, otherSecret) => {
        fc.pre(otherSecret !== WEBHOOK_SECRET);
        expect(verifyWebhookSignature(payload, signPayload(payload, otherSecret))).toBe(false);
      })
    );
  });

  it("rejects a valid signature replayed against a different payload", () => {
    fc.assert(
      fc.property(messyString, messyString, (payload, otherPayload) => {
        fc.pre(payload !== otherPayload);
        expect(verifyWebhookSignature(otherPayload, signPayload(payload))).toBe(false);
      })
    );
  });
});

/* ------------------------------------------------------------------ */
/*  Zod request boundary                                               */
/* ------------------------------------------------------------------ */

describe("PaginationQuerySchema — properties", () => {
  it("never throws on arbitrary query input", () => {
    fc.assert(
      fc.property(
        fc.record(
          { limit: fc.option(messyString, { nil: undefined }), cursor: fc.option(messyString, { nil: undefined }) },
          { requiredKeys: [] }
        ),
        (query) => {
          expect(() => PaginationQuerySchema.safeParse(query)).not.toThrow();
        }
      )
    );
  });

  it("only accepts a `limit` that is entirely digits", () => {
    fc.assert(
      fc.property(messyString, (limit) => {
        const result = PaginationQuerySchema.safeParse({ limit });
        if (result.success) {
          expect(limit).toMatch(/^\d+$/);
        }
      })
    );
  });

  it("accepts every all-digit limit", () => {
    fc.assert(
      fc.property(fc.nat(100000), (n) => {
        expect(PaginationQuerySchema.safeParse({ limit: String(n) }).success).toBe(true);
      })
    );
  });
});
