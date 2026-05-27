#!/usr/bin/env node
/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * Add never-assigned Cursor referral codes to the treasure-hunt prize pool.
 *
 * Use case: an event distribution (e.g. sports-hack-2026) pre-printed N
 * referral codes for a credit band, but only M < N attendees met the
 * submission requirement. The remaining N - M codes were never emailed
 * to anyone — they're free to hide behind website puzzles.
 *
 * Unlike scripts/treasure-hunt-build-pool.ts (which sources from
 * hackathonCreditCodes assigned by rank), this script takes a flat JSON
 * array of referral URLs + an offset of how many were already used.
 *
 * Each unused URL is verified against Cursor's referral API (matching the
 * existing pool builder) before landing in treasureHuntPrizes with status
 * = "available" and originalAssignee = null.
 *
 * Usage:
 *   npx tsx scripts/treasure-hunt-add-unassigned-codes.ts \
 *     --codes /tmp/sports-hack-2026-credits.json \
 *     --used 31 \
 *     --source sports-hack-2026-leftovers \
 *     --dry-run
 *
 *   npx tsx scripts/treasure-hunt-add-unassigned-codes.ts \
 *     --codes /tmp/sports-hack-2026-credits.json \
 *     --used 31 \
 *     --source sports-hack-2026-leftovers \
 *     --write
 *
 * Flags:
 *   --codes <path>   JSON file: array of referral URL strings
 *   --used <n>       Number of leading URLs in the file already distributed
 *   --source <tag>   Free-form label stored on each prize doc for auditing
 *   --skip-verify    Don't hit Cursor's API (faster; skip only for fresh codes)
 *   --dry-run        Plan only — no Firestore writes
 *   --write          Commit the inserts
 */
import { readFileSync } from "fs";
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "../lib/firebase-admin";

const REFERRAL_REGEX = /https?:\/\/cursor\.com\/referral\?code=([A-Z0-9]+)/i;
const CHECK_ENDPOINT = "https://cursor.com/api/dashboard/check-referral-code";
const CHECK_DELAY_MS = 500;

type ReferralStatus = "active" | "redeemed" | "unknown";

async function checkReferral(code: string, retries = 3): Promise<ReferralStatus> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      if (attempt > 0) await new Promise((r) => setTimeout(r, CHECK_DELAY_MS * attempt));
      const res = await fetch(CHECK_ENDPOINT, {
        method: "POST",
        headers: {
          accept: "*/*",
          "content-type": "application/json",
          origin: "https://cursor.com",
          referer: `https://cursor.com/referral?code=${code}`,
          "user-agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
        },
        body: JSON.stringify({ referralCode: code }),
      });
      if (res.status === 200) {
        const json = (await res.json()) as Record<string, unknown>;
        if (json && typeof json === "object" && "isValid" in json) {
          const v = json as { isValid: boolean; userIsEligible?: boolean };
          return v.isValid && v.userIsEligible ? "active" : "redeemed";
        }
        if (json && Object.keys(json).length === 0) return "redeemed";
        const title = (json as { metadata?: { title?: string } })?.metadata?.title?.toLowerCase() ?? "";
        if (title.includes("already been used") || title.includes("expired")) return "redeemed";
        return "unknown";
      }
      if (res.status === 500 && attempt < retries - 1) continue;
      return "unknown";
    } catch {
      if (attempt < retries - 1) continue;
      return "unknown";
    }
  }
  return "unknown";
}

function parseArgs(argv: string[]) {
  const get = (flag: string): string | null => {
    const i = argv.indexOf(flag);
    return i >= 0 && argv[i + 1] ? argv[i + 1]! : null;
  };
  const dryRun = argv.includes("--dry-run");
  const write = argv.includes("--write");
  const skipVerify = argv.includes("--skip-verify");
  const codesPath = get("--codes");
  const usedRaw = get("--used");
  const source = get("--source");

  if ((dryRun && write) || (!dryRun && !write)) {
    console.error("Specify exactly one of: --dry-run | --write");
    process.exit(1);
  }
  if (!codesPath) {
    console.error("--codes <path-to-json-array> required");
    process.exit(1);
  }
  if (!source) {
    console.error("--source <tag> required (free-form audit label)");
    process.exit(1);
  }
  const used = usedRaw ? Number.parseInt(usedRaw, 10) : 0;
  if (Number.isNaN(used) || used < 0) {
    console.error("--used must be a non-negative integer");
    process.exit(1);
  }
  return { dryRun, write, skipVerify, codesPath, used, source };
}

async function main(): Promise<void> {
  const { dryRun, skipVerify, codesPath, used, source } = parseArgs(
    process.argv.slice(2),
  );

  let urls: string[];
  try {
    const raw = readFileSync(codesPath, "utf8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.some((x) => typeof x !== "string")) {
      console.error("Codes file must be a JSON array of URL strings.");
      process.exit(1);
    }
    urls = parsed as string[];
  } catch (e) {
    console.error(`Cannot read codes file: ${codesPath}`, e);
    process.exit(1);
  }

  console.log(`Loaded ${urls.length} URL(s) from ${codesPath}`);
  console.log(`Marked as already used: ${used}`);
  if (used > urls.length) {
    console.error(`--used (${used}) exceeds total URL count (${urls.length}).`);
    process.exit(1);
  }

  const remaining = urls.slice(used);
  console.log(`Leftover to add to pool: ${remaining.length}`);

  const db = getAdminDb();
  if (!db) {
    console.error(
      "Firebase Admin not configured (FIREBASE_SERVICE_ACCOUNT_JSON / GOOGLE_APPLICATION_CREDENTIALS).",
    );
    process.exit(1);
  }
  const col = db.collection("treasureHuntPrizes");

  type Candidate = { url: string; code: string };
  const candidates: Candidate[] = [];
  const skippedMalformed: string[] = [];
  for (const url of remaining) {
    const match = url.match(REFERRAL_REGEX);
    if (!match) {
      skippedMalformed.push(url);
      continue;
    }
    candidates.push({ url, code: match[1]!.toUpperCase() });
  }
  if (skippedMalformed.length > 0) {
    console.warn(`[warn] Skipped ${skippedMalformed.length} URL(s) that don't match the referral pattern.`);
  }

  // Dedupe against codes already in the pool — don't double-insert.
  const existing = new Set<string>();
  const existSnap = await col.get();
  for (const doc of existSnap.docs) {
    existing.add(doc.id);
  }
  const fresh = candidates.filter((c) => !existing.has(c.code));
  const duplicates = candidates.filter((c) => existing.has(c.code));
  if (duplicates.length > 0) {
    console.log(`Already in pool (will skip): ${duplicates.length}`);
  }
  console.log(`To verify + insert: ${fresh.length}`);

  let toInsert: Array<Candidate & { status: ReferralStatus }>;
  if (skipVerify) {
    toInsert = fresh.map((c) => ({ ...c, status: "active" as const }));
    console.log("[info] --skip-verify: trusting all leftovers as active.");
  } else {
    console.log(`\nVerifying ${fresh.length} code(s) against Cursor's referral API...`);
    const verified: Array<Candidate & { status: ReferralStatus }> = [];
    for (let i = 0; i < fresh.length; i++) {
      const c = fresh[i]!;
      const status = await checkReferral(c.code);
      console.log(`  [${i + 1}/${fresh.length}] ${c.code} → ${status}`);
      verified.push({ ...c, status });
      if (i < fresh.length - 1) await new Promise((r) => setTimeout(r, CHECK_DELAY_MS));
    }
    toInsert = verified;
  }

  const active = toInsert.filter((v) => v.status === "active");
  const redeemed = toInsert.filter((v) => v.status === "redeemed");
  const unknown = toInsert.filter((v) => v.status === "unknown");

  console.log(
    `\nResult: ${active.length} active | ${redeemed.length} already redeemed | ${unknown.length} unknown (skipped)`,
  );

  if (dryRun) {
    console.log("\n--dry-run: no Firestore writes. Would insert:");
    for (const a of active) {
      console.log(`  ${a.code}`);
    }
    return;
  }

  if (active.length === 0) {
    console.log("Nothing to write.");
    return;
  }

  const batch = db.batch();
  for (const a of active) {
    batch.set(col.doc(a.code), {
      code: a.code,
      creditUrl: a.url,
      originalAssignee: {
        email: null,
        name: null,
        uid: null,
        role: null,
      },
      status: "available",
      claimedByUid: null,
      claimedByEmail: null,
      claimedPath: null,
      claimedAt: null,
      emailSentAt: null,
      source,
      createdAt: FieldValue.serverTimestamp(),
    });
  }
  await batch.commit();
  console.log(`\nWrote ${active.length} prize doc(s) to treasureHuntPrizes (source=${source}).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
