#!/usr/bin/env node
/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * Deadline-day broadcast (Fri May 29, 2026) to every admitted Cohort 1
 * applicant: Week 3 (Vibe Marketing Build) PRs are due today by 5pm EST.
 * Roger merges everything that's in by 6pm, then we get on Zoom for the
 * voting call. Roger can't stay on long today but leaves the room open so
 * the cohort can present and pick the winner themselves. Heads-up that
 * Monday's call kicks off Week 4 — and the format is switching up.
 *
 * Idempotent via `cohort1Week3MktDeadlineEmailedAt`. `--force` re-sends.
 * `--only-email=foo@bar` restricts to a single recipient.
 *
 * Usage:
 *   npx tsx scripts/send-cohort1-week3-mkt-deadline.ts --dry-run
 *   npx tsx scripts/send-cohort1-week3-mkt-deadline.ts --send --only-email=rhunt@bentley.edu
 *   npx tsx scripts/send-cohort1-week3-mkt-deadline.ts --send
 *   npx tsx scripts/send-cohort1-week3-mkt-deadline.ts --send --force
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
const STAMP_FIELD = "cohort1Week3MktDeadlineEmailedAt";

const ZOOM_URL = "https://bentley.zoom.us/j/93655364421";
const ZOOM_CHAT_URL = "https://bentley.zoom.us/launch/jc/93655364421";
const ZOOM_MEETING_ID = "936 5536 4421";
const ZOOM_ONE_TAP_1 = "+13126266799,,93655364421# US (Chicago)";
const ZOOM_ONE_TAP_2 = "+16468769923,,93655364421# US (New York)";

function buildEmail(r: Cohort1Recipient): EmailContent {
  const first = escapeHtml(r.firstName?.trim() || "there");
  const firstText = r.firstName?.trim() || "there";
  const unsubUrl = buildUnsubscribeUrl(r.email);
  const withdrawUrl = buildWithdrawUrl(r.email, "cohort-1");

  const subject = "Week 3 PRs due 5pm today — Zoom at 6, you pick the winner 🚀";

  const html = `<!DOCTYPE html><html><body style="font-family:system-ui,Segoe UI,sans-serif;line-height:1.6;color:#111;max-width:640px;">
<p>Hi ${first},</p>

<p><strong>Today&apos;s the day for the Week 3 vibe marketing build.</strong> Get your platform PR&apos;d by <strong>5pm EST today</strong> and you&apos;re in. I&apos;ll make sure everything that&apos;s in by then is <strong>merged by 6pm</strong>, so it&apos;s live on the cohort page in time for the call.</p>

<p>
  <a href="${COHORT_URL}" style="display:inline-block;background:#0284c7;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">
    Open the Week 3 tab + submit →
  </a>
</p>

<h3 style="margin-top:22px;margin-bottom:10px;">Tonight on Zoom — 6pm EST</h3>
<p>Heads up: I can&apos;t be on the call too long today. But I&apos;m going to <strong>leave the room open</strong> — so once everyone&apos;s on, go ahead and <strong>present your builds and decide as a cohort who wins</strong>. This one&apos;s yours to run. Hear each other out, vote, crown a winner.</p>

<div style="border:1px solid #d1d5db;border-radius:8px;padding:16px;margin:20px 0;background:#f9fafb;font-size:14px;color:#111;">
  <p style="margin:0 0 10px 0;"><strong>Zoom — tonight, Fri May 29 · 6:00 pm EST</strong></p>
  <p style="margin:0 0 6px 0;">
    Join: <a href="${escapeHtml(ZOOM_URL)}">${escapeHtml(ZOOM_URL)}</a>
  </p>
  <p style="margin:0 0 6px 0;">
    Meeting chat: <a href="${escapeHtml(ZOOM_CHAT_URL)}">${escapeHtml(ZOOM_CHAT_URL)}</a>
  </p>
  <p style="margin:0 0 6px 0;">
    Meeting ID: <strong>${ZOOM_MEETING_ID}</strong>
  </p>
  <p style="margin:0;color:#555;font-size:13px;">
    One-tap mobile: ${escapeHtml(ZOOM_ONE_TAP_1)} · ${escapeHtml(ZOOM_ONE_TAP_2)}
  </p>
</div>

<h3 style="margin-top:22px;margin-bottom:10px;">Monday night — Week 4 kickoff</h3>
<p>Then <strong>Monday night I&apos;ll be on</strong> to walk through next week&apos;s tasks. Quick teaser: <strong>it&apos;s switching up.</strong> Different format from the last three weeks — more on that Monday.</p>

<p>Ship it. See you at 6.</p>

<p>— Roger<br/>
<a href="mailto:roger@cursorboston.com">roger@cursorboston.com</a></p>

<p style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e5e5;font-size:12px;color:#888;">
You&apos;re receiving this because you&apos;re admitted to Cohort 1 of the Cursor Boston summer cohort.<br/>
<a href="${escapeHtml(unsubUrl)}" style="color:#888;">Unsubscribe from emails</a> · <a href="${escapeHtml(withdrawUrl)}" style="color:#888;">Withdraw from Cohort 1</a>
</p>
</body></html>`;

  const text = `Hi ${firstText},

Today's the day for the Week 3 vibe marketing build. Get your platform PR'd by 5pm EST today and you're in. I'll make sure everything that's in by then is merged by 6pm, so it's live on the cohort page in time for the call.

Open the Week 3 tab + submit: ${COHORT_URL}

TONIGHT ON ZOOM — 6PM EST
I can't be on the call too long today. But I'm going to leave the room open — so once everyone's on, go ahead and present your builds and decide as a cohort who wins. This one's yours to run. Hear each other out, vote, crown a winner.

  Join: ${ZOOM_URL}
  Meeting chat: ${ZOOM_CHAT_URL}
  Meeting ID: ${ZOOM_MEETING_ID}
  One-tap mobile: ${ZOOM_ONE_TAP_1} · ${ZOOM_ONE_TAP_2}

MONDAY NIGHT — WEEK 4 KICKOFF
Then Monday night I'll be on to walk through next week's tasks. Quick teaser: it's switching up. Different format from the last three weeks — more on that Monday.

Ship it. See you at 6.

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
    name: "Cohort 1 Week 3 marketing deadline",
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
