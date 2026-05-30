/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * Email-campaign harness for the `scripts/send-*` one-off scripts.
 *
 * Each send script previously inlined ~150 lines of identical boilerplate:
 * env validation, recipient query, dry-run preview, a throttled send loop with
 * per-recipient try/catch + progress logging, and an optional post-send
 * idempotency stamp. This module owns all of that; a script only has to supply
 * `loadRecipients` + `buildEmail` (+ an optional `onSent` stamp writer).
 *
 * Sender overrides go through the per-call `from` field on the returned email
 * content or the `MAILGUN_FROM` env var — never by editing `lib/mailgun.ts`.
 */
import type { Firestore } from "firebase-admin/firestore";
import { getAdminDb } from "../../lib/firebase-admin";
import { sendEmail } from "../../lib/mailgun";
import {
  requireFirebaseEnv,
  requireMailgunEnv,
  sleep,
  type SendArgs,
} from "./script-utils";

export interface EmailContent {
  subject: string;
  html: string;
  text: string;
  /** Optional per-message sender override (defaults to MAILGUN_FROM). */
  from?: string;
}

export interface RunEmailCampaignOptions<R> {
  /** Parsed CLI flags (see parseSendArgs). */
  args: SendArgs;
  /** Human label for logs, e.g. "Cohort 1 Week 3 reminder". */
  name: string;
  /**
   * Optional pre-send side effect (e.g. `syncMailgunSuppressions(db)`). Runs
   * once after env validation, only on a real send (not dry-run), before
   * recipients are loaded.
   */
  beforeSend?: (ctx: { db: Firestore }) => Promise<unknown>;
  /** Query + filter recipients. Receives the live db handle and parsed args. */
  loadRecipients: (ctx: { db: Firestore; args: SendArgs }) => Promise<R[]>;
  /** Address used for sending, dedupe, and logging. */
  getEmail: (r: R) => string;
  /** Build the subject/html/text for one recipient. */
  buildEmail: (r: R) => EmailContent;
  /**
   * Optional post-send write (idempotency stamp). Runs after a successful send,
   * inside the same loop, before the throttle delay. Failures here are logged
   * but do not abort the run.
   */
  onSent?: (r: R, ctx: { db: Firestore }) => Promise<unknown>;
  /** Delay between sends in ms (default 450). */
  throttleMs?: number;
  /** Which body to print in the dry-run sample preview (default "html"). */
  previewMode?: "html" | "text";
  /** Log progress every N sends (default 25). */
  progressEvery?: number;
}

export interface CampaignResult {
  total: number;
  sent: number;
  failed: number;
}

/**
 * Run an email campaign end-to-end. Validates env, loads recipients, prints a
 * dry-run preview (and returns) when `args.dryRun`, otherwise sends with
 * throttling, per-recipient error isolation, and an optional idempotency stamp.
 */
export async function runEmailCampaign<R>(
  opts: RunEmailCampaignOptions<R>
): Promise<CampaignResult> {
  const {
    args,
    name,
    beforeSend,
    loadRecipients,
    getEmail,
    buildEmail,
    onSent,
    throttleMs = 450,
    previewMode = "html",
    progressEvery = 25,
  } = opts;

  requireFirebaseEnv();
  if (args.send) requireMailgunEnv();

  const db = getAdminDb();
  if (!db) {
    throw new Error("Firebase Admin not configured (getAdminDb returned null).");
  }

  if (args.send && beforeSend) await beforeSend({ db });

  console.log(`\n[${name}] loading recipients…`);
  const recipients = await loadRecipients({ db, args });
  console.log(`[${name}] recipients to email: ${recipients.length}`);

  if (args.dryRun) {
    const sample = recipients[0];
    if (sample) {
      const { subject, html, text } = buildEmail(sample);
      console.log(`\nSample to: ${getEmail(sample)}`);
      console.log(`Subject: ${subject}`);
      if (previewMode === "text") {
        console.log(`\n---- text preview ----\n${text}`);
      } else {
        console.log(
          `\n---- HTML preview (first 1800 chars) ----\n${html.slice(0, 1800)}\n…`
        );
      }
    } else {
      console.log("\n(no recipients matched — nothing to send)");
    }
    console.log(`\n--dry-run: no emails sent and no writes.`);
    return { total: recipients.length, sent: 0, failed: 0 };
  }

  let sent = 0;
  let failed = 0;
  for (const r of recipients) {
    const email = getEmail(r);
    const { subject, html, text, from } = buildEmail(r);
    try {
      await sendEmail({ to: email, subject, html, text, from });
      if (onSent) {
        try {
          await onSent(r, { db });
        } catch (stampErr) {
          console.error(`  [stamp-failed] ${email}`, stampErr);
        }
      }
      sent++;
      if (sent % progressEvery === 0) {
        console.log(`  Progress: ${sent}/${recipients.length}`);
      }
    } catch (e) {
      failed++;
      console.error(`  [fail] ${email}`, e);
    }
    await sleep(throttleMs);
  }

  console.log(`\n[${name}] done. Sent ${sent}, failed ${failed}.`);
  return { total: recipients.length, sent, failed };
}
