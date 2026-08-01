# Fuzz harnesses

Coverage-guided fuzz tests for input-handling code paths. Run by
ClusterFuzzLite in CI (see `.github/workflows/fuzz.yml`) on every PR
that touches a fuzz target or the code it covers.

Why these specific targets:

- **`sanitize.fuzz.ts`** — `lib/sanitize.ts` is the single point of
  contact between untrusted user input (display names, URLs, free-text)
  and Firestore writes / link rendering. Regression in any of its regex
  paths could open XSS or ReDoS. Fuzzed for both crashes and the
  documented invariants (no control chars in output, URLs always
  resolve to a valid `http(s)`/null result, doc IDs always match the
  Firestore charset).

## Relationship to the fast-check property tests

`__tests__/lib/security-properties.test.ts` covers overlapping ground with
`sanitize.fuzz.ts`. The two are complementary rather than redundant, for two
reasons:

- **Different trigger.** This workflow only runs on PRs that touch
  `lib/sanitize.ts`, `fuzz/**`, `.clusterfuzzlite/**`, or its own YAML. The
  Jest property tests run on *every* PR, so a refactor elsewhere that breaks a
  sanitizer invariant is caught immediately rather than at the next fuzz run.
- **Different reach.** The fuzzer goes deeper on `lib/sanitize.ts` — byte-level
  coverage-guided search finds inputs a generator would not. The property tests
  go wider: they also cover proxy-header parsing (`lib/client-ip.ts`), HMAC
  webhook signature verification (`lib/github.ts`), and Zod request boundaries,
  none of which have fuzz targets.

The property tests also assert relational invariants a single-pass fuzz harness
cannot express — idempotence (`f(f(x)) === f(x)`), replay resistance, and
"rejects everything except the one correct digest".

If you add a fuzz target for a surface the property tests already cover, keep
both and note the split here.

How to add a new target:

1. Create `fuzz/<name>.fuzz.ts` that exports `fuzz(data: Buffer)`.
2. Add the new target file to the corpus matrix in
   `.github/workflows/fuzz.yml`.
3. Add a one-line description here so future maintainers know what
   each target proves.
