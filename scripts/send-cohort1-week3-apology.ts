#!/usr/bin/env node
/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * Apology note (Fri May 29, 2026) to every admitted Cohort 1 applicant:
 * Roger missed the Week 3 voting call. Short, warm, sincere — "sorry,
 * heck of a week, see you Monday." No Zoom block (Monday's link TBD).
 *
 * Idempotent via `cohort1Week3ApologyEmailedAt`. `--force` re-sends.
 * `--only-email=foo@bar` restricts to a single recipient.
 *
 * Usage:
 *   npx tsx scripts/send-cohort1-week3-apology.ts --dry-run
 *   npx tsx scripts/send-cohort1-week3-apology.ts --send --only-email=rhunt@bentley.edu
 *   npx tsx scripts/send-cohort1-week3-apology.ts --send
 *   npx tsx scripts/send-cohort1-week3-apology.ts --send --force
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

const STAMP_FIELD = "cohort1Week3ApologyEmailedAt";

function buildEmail(r: Cohort1Recipient): EmailContent {
  const first = escapeHtml(r.firstName?.trim() || "there");
  const firstText = r.firstName?.trim() || "there";
  const unsubUrl = buildUnsubscribeUrl(r.email);
  const withdrawUrl = buildWithdrawUrl(r.email, "cohort-1");

  const subject = "My apologies, folks — see you Monday";

  const html = `<!DOCTYPE html><html><body style="font-family:system-ui,Segoe UI,sans-serif;line-height:1.6;color:#111;max-width:640px;">
<p>Hi ${first},</p>

<p>I owe you an apology — I missed it again tonight. It was one heck of a week, and I&apos;m sorry I couldn&apos;t be there with you.</p>

<p>Thank you to everyone who shipped and showed up to present. I&apos;ll catch up on what you built.</p>

<p>I&apos;ll be on with you <strong>Monday night</strong> to talk through what&apos;s next — and as I mentioned, the format&apos;s switching up. See you then.</p>

<p>My apologies again, and thank you for your patience.</p>

<p>— Roger<br/>
<a href="mailto:roger@cursorboston.com">roger@cursorboston.com</a></p>

<p style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e5e5;font-size:12px;color:#888;">
You&apos;re receiving this because you&apos;re admitted to Cohort 1 of the Cursor Boston summer cohort.<br/>
<a href="${escapeHtml(unsubUrl)}" style="color:#888;">Unsubscribe from emails</a> · <a href="${escapeHtml(withdrawUrl)}" style="color:#888;">Withdraw from Cohort 1</a>
</p>
</body></html>`;

  const text = `Hi ${firstText},

I owe you an apology — I missed it again tonight. It was one heck of a week, and I'm sorry I couldn't be there with you.

Thank you to everyone who shipped and showed up to present. I'll catch up on what you built.

I'll be on with you Monday night to talk through what's next — and as I mentioned, the format's switching up. See you then.

My apologies again, and thank you for your patience.

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
    name: "Cohort 1 Week 3 apology",
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
