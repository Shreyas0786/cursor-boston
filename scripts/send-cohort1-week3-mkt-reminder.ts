#!/usr/bin/env node
/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * Deadline-day REMINDER (Fri May 29, 2026) to every admitted Cohort 1
 * applicant: short nudge that Week 3 (Vibe Marketing Build) PRs close at
 * 5pm EST today, with the 6pm voting-call Zoom. Sent after the morning
 * send-cohort1-week3-mkt-deadline.ts blast.
 *
 * Idempotent via `cohort1Week3MktReminderEmailedAt` (separate from the
 * morning send's `cohort1Week3MktDeadlineEmailedAt`). `--force` re-sends.
 * `--only-email=foo@bar` restricts to a single recipient.
 *
 * Usage:
 *   npx tsx scripts/send-cohort1-week3-mkt-reminder.ts --dry-run
 *   npx tsx scripts/send-cohort1-week3-mkt-reminder.ts --send --only-email=rhunt@bentley.edu
 *   npx tsx scripts/send-cohort1-week3-mkt-reminder.ts --send
 *   npx tsx scripts/send-cohort1-week3-mkt-reminder.ts --send --force
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
const STAMP_FIELD = "cohort1Week3MktReminderEmailedAt";

const ZOOM_URL = "https://bentley.zoom.us/j/93655364421";
const ZOOM_CHAT_URL = "https://bentley.zoom.us/launch/jc/93655364421";
const ZOOM_MEETING_ID = "936 5536 4421";

function buildEmail(r: Cohort1Recipient): EmailContent {
  const first = escapeHtml(r.firstName?.trim() || "there");
  const firstText = r.firstName?.trim() || "there";
  const unsubUrl = buildUnsubscribeUrl(r.email);
  const withdrawUrl = buildWithdrawUrl(r.email, "cohort-1");

  const subject = "Reminder: Week 3 PRs close at 5pm EST today ⏰";

  const html = `<!DOCTYPE html><html><body style="font-family:system-ui,Segoe UI,sans-serif;line-height:1.6;color:#111;max-width:640px;">
<p>Hi ${first},</p>

<p><strong>Quick reminder — get your Week 3 vibe marketing submission PR&apos;d by 5pm EST today.</strong> Everything that&apos;s in by 5 gets merged and is live on the cohort page in time for tonight&apos;s call. Don&apos;t leave it to the last minute.</p>

<p>
  <a href="${COHORT_URL}" style="display:inline-block;background:#0284c7;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">
    Open the Week 3 tab + submit →
  </a>
</p>

<p style="margin-top:18px;">Then we&apos;re on Zoom at <strong>6pm EST</strong> to present and pick a winner — the room&apos;s yours to run tonight.</p>

<div style="border:1px solid #d1d5db;border-radius:8px;padding:16px;margin:20px 0;background:#f9fafb;font-size:14px;color:#111;">
  <p style="margin:0 0 10px 0;"><strong>Zoom — tonight, Fri May 29 · 6:00 pm EST</strong></p>
  <p style="margin:0 0 6px 0;">Join: <a href="${escapeHtml(ZOOM_URL)}">${escapeHtml(ZOOM_URL)}</a></p>
  <p style="margin:0 0 6px 0;">Meeting chat: <a href="${escapeHtml(ZOOM_CHAT_URL)}">${escapeHtml(ZOOM_CHAT_URL)}</a></p>
  <p style="margin:0;">Meeting ID: <strong>${ZOOM_MEETING_ID}</strong></p>
</div>

<p>Ship it. 🚀</p>

<p>— Roger<br/>
<a href="mailto:roger@cursorboston.com">roger@cursorboston.com</a></p>

<p style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e5e5;font-size:12px;color:#888;">
You&apos;re receiving this because you&apos;re admitted to Cohort 1 of the Cursor Boston summer cohort.<br/>
<a href="${escapeHtml(unsubUrl)}" style="color:#888;">Unsubscribe from emails</a> · <a href="${escapeHtml(withdrawUrl)}" style="color:#888;">Withdraw from Cohort 1</a>
</p>
</body></html>`;

  const text = `Hi ${firstText},

Quick reminder — get your Week 3 vibe marketing submission PR'd by 5pm EST today. Everything that's in by 5 gets merged and is live on the cohort page in time for tonight's call. Don't leave it to the last minute.

Open the Week 3 tab + submit: ${COHORT_URL}

Then we're on Zoom at 6pm EST to present and pick a winner — the room's yours to run tonight.

ZOOM — TONIGHT, FRI MAY 29 · 6:00 PM EST
  Join: ${ZOOM_URL}
  Meeting chat: ${ZOOM_CHAT_URL}
  Meeting ID: ${ZOOM_MEETING_ID}

Ship it.

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
    name: "Cohort 1 Week 3 marketing reminder",
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
