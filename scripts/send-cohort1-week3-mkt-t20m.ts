#!/usr/bin/env node
/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * T-20m FINAL CALL (Fri May 29, 2026) to every admitted Cohort 1 applicant:
 * ~20 minutes left to PR the Week 3 (Vibe Marketing Build) submission before
 * the 5pm EST cutoff. Short, urgent. Sent after the morning blast
 * (send-cohort1-week3-mkt-deadline.ts) and the midday reminder
 * (send-cohort1-week3-mkt-reminder.ts).
 *
 * Idempotent via `cohort1Week3MktT20mEmailedAt` (separate stamp). `--force`
 * re-sends. `--only-email=foo@bar` restricts to a single recipient.
 *
 * Usage:
 *   npx tsx scripts/send-cohort1-week3-mkt-t20m.ts --dry-run
 *   npx tsx scripts/send-cohort1-week3-mkt-t20m.ts --send --only-email=rhunt@bentley.edu
 *   npx tsx scripts/send-cohort1-week3-mkt-t20m.ts --send
 *   npx tsx scripts/send-cohort1-week3-mkt-t20m.ts --send --force
 */
import { loadEnv, escapeHtml, parseSendArgs } from "./_lib/script-utils";
loadEnv();

import { runEmailCampaign, type EmailContent } from "./_lib/campaign-runner";
import {
  loadAdmittedCohort1Recipients,
  stampCohort1,
  type Cohort1Recipient,
} from "./_lib/cohort1-recipients";
import { buildUnsubscribeUrl, buildWithdrawUrl } from "../lib/unsubscribe-token";

const COHORT_URL = "https://cursorboston.com/summer-cohort";
const STAMP_FIELD = "cohort1Week3MktT20mEmailedAt";

const ZOOM_URL = "https://bentley.zoom.us/j/93655364421";
const ZOOM_MEETING_ID = "936 5536 4421";

function buildEmail(r: Cohort1Recipient): EmailContent {
  const first = escapeHtml(r.firstName?.trim() || "there");
  const firstText = r.firstName?.trim() || "there";
  const unsubUrl = buildUnsubscribeUrl(r.email);
  const withdrawUrl = buildWithdrawUrl(r.email, "cohort-1");

  const subject = "⏰ 20 minutes left — get your Week 3 PR in NOW";

  const html = `<!DOCTYPE html><html><body style="font-family:system-ui,Segoe UI,sans-serif;line-height:1.6;color:#111;max-width:640px;">
<p>Hi ${first},</p>

<p style="font-size:18px;"><strong>This is it — about 20 minutes until the 5pm EST cutoff.</strong> If your Week 3 vibe marketing project isn&apos;t PR&apos;d yet, open the PR <strong>now</strong>. Anything in by 5 gets merged and is live for tonight&apos;s 6pm call.</p>

<div style="border:2px solid #b91c1c;border-radius:8px;padding:14px;margin:18px 0;background:#fef2f2;color:#7f1d1d;text-align:center;">
  <p style="margin:0;font-size:17px;font-weight:700;">PR by 5:00 PM EST. Don&apos;t miss it.</p>
</div>

<p>
  <a href="${COHORT_URL}" style="display:inline-block;background:#b91c1c;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700;">
    Submit your Week 3 PR now →
  </a>
</p>

<p style="margin-top:18px;">Then see you on Zoom at <strong>6pm EST</strong> to present and pick the winner:<br/>
<a href="${escapeHtml(ZOOM_URL)}">${escapeHtml(ZOOM_URL)}</a> · Meeting ID <strong>${ZOOM_MEETING_ID}</strong></p>

<p>Go go go. 🚀</p>

<p>— Roger<br/>
<a href="mailto:roger@cursorboston.com">roger@cursorboston.com</a></p>

<p style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e5e5;font-size:12px;color:#888;">
You&apos;re receiving this because you&apos;re admitted to Cohort 1 of the Cursor Boston summer cohort.<br/>
<a href="${escapeHtml(unsubUrl)}" style="color:#888;">Unsubscribe from emails</a> · <a href="${escapeHtml(withdrawUrl)}" style="color:#888;">Withdraw from Cohort 1</a>
</p>
</body></html>`;

  const text = `Hi ${firstText},

THIS IS IT — about 20 minutes until the 5pm EST cutoff. If your Week 3 vibe marketing project isn't PR'd yet, open the PR NOW. Anything in by 5 gets merged and is live for tonight's 6pm call.

>>> PR by 5:00 PM EST. Don't miss it. <<<

Submit your Week 3 PR now: ${COHORT_URL}

Then see you on Zoom at 6pm EST to present and pick the winner:
  ${ZOOM_URL}  ·  Meeting ID ${ZOOM_MEETING_ID}

Go go go.

— Roger
roger@cursorboston.com

---
You're receiving this because you're admitted to Cohort 1 of the Cursor Boston summer cohort.
Unsubscribe from emails: ${unsubUrl}
Withdraw from Cohort 1:  ${withdrawUrl}
`;

  return { subject, html, text };
}

async function main(): Promise<void> {
  const args = parseSendArgs();

  await runEmailCampaign<Cohort1Recipient>({
    args,
    name: "Cohort 1 Week 3 marketing T-20m",
    previewMode: "text",
    getEmail: (r) => r.email,
    buildEmail,
    loadRecipients: (ctx) => loadAdmittedCohort1Recipients(ctx, STAMP_FIELD),
    onSent: (r, { db }) => stampCohort1(db, r.applicationId, STAMP_FIELD),
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
