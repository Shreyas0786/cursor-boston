/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * Shared helpers for the one-off scripts in `scripts/`.
 *
 * These collapse boilerplate that was previously copy-pasted into every
 * `send-*` / `seed-*` / `backfill-*` / `sync-*` script: env loading, env
 * validation, HTML escaping, throttling, and CLI flag parsing.
 *
 * Import order note: `loadEnv()` must run before any module that reads
 * `process.env` at import time (e.g. `../lib/firebase-admin`). Call it at the
 * very top of a script, before those imports.
 */
import { loadEnvConfig } from "@next/env";

/** Load `.env.local` etc. from the repo root. Call first, before lib imports. */
export function loadEnv(): void {
  loadEnvConfig(process.cwd());
}

/** Escape the five HTML-significant characters for safe interpolation. */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Resolve after `ms` milliseconds. Used to throttle Mailgun/Firestore loops. */
export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Throw with a clear message if Firebase Admin credentials are absent.
 * Mirrors the `getAdminDb() === null` check every script used to inline.
 */
export function requireFirebaseEnv(): void {
  if (
    !process.env.FIREBASE_SERVICE_ACCOUNT_JSON &&
    !process.env.GOOGLE_APPLICATION_CREDENTIALS
  ) {
    throw new Error(
      "Firebase Admin not configured: set FIREBASE_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS."
    );
  }
}

/** Throw if Mailgun send credentials are absent. Only needed for `--send`. */
export function requireMailgunEnv(): void {
  if (!process.env.MAILGUN_API_KEY || !process.env.MAILGUN_DOMAIN) {
    throw new Error("For --send, set MAILGUN_API_KEY and MAILGUN_DOMAIN.");
  }
}

/**
 * Standard send-script CLI flags.
 *
 * Requires exactly one of `--dry-run` / `--send`. Also recognizes the optional
 * `--force` (re-send to already-stamped recipients) and `--only-email=foo@bar`
 * (restrict to a single address) flags that several scripts had grown ad hoc.
 */
export interface SendArgs {
  dryRun: boolean;
  send: boolean;
  force: boolean;
  onlyEmail: string | null;
}

export function parseSendArgs(argv: string[] = process.argv.slice(2)): SendArgs {
  const dryRun = argv.includes("--dry-run");
  const send = argv.includes("--send");
  if (dryRun === send) {
    // both or neither
    console.error("Specify exactly one of: --dry-run | --send");
    process.exit(1);
  }
  const onlyArg = argv.find((a) => a.startsWith("--only-email="));
  return {
    dryRun,
    send,
    force: argv.includes("--force"),
    onlyEmail: onlyArg
      ? onlyArg.slice("--only-email=".length).trim().toLowerCase()
      : null,
  };
}

/**
 * Standard db-script CLI flags: requires exactly one of `--dry-run` / `--apply`.
 * `--apply` is the canonical "really write" flag (aliased from `--write`/`--send`
 * in older scripts); pass `writeAliases` to accept legacy spellings.
 */
export interface DbArgs {
  dryRun: boolean;
  apply: boolean;
  force: boolean;
}

export function parseDbArgs(
  argv: string[] = process.argv.slice(2),
  writeAliases: string[] = ["--apply", "--write", "--send"]
): DbArgs {
  const apply = writeAliases.some((flag) => argv.includes(flag));
  const dryRun = argv.includes("--dry-run") || !apply;
  if (dryRun && apply) {
    console.error(`Specify exactly one of: --dry-run | ${writeAliases[0]}`);
    process.exit(1);
  }
  return { dryRun, apply, force: argv.includes("--force") };
}
