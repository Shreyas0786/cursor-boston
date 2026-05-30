#!/usr/bin/env node
/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * Morning-of broadcast for the May 26 Sports Hack — sent at ~7:30am ET
 * 2026-05-26, doors at 9am / event start 10am. Same content as the prior
 * evening blast (send-may26-event-today.ts), refreshed for "this morning"
 * timing and sent from "Cursor Boston" rather than "Roger".
 *
 * Audience: same union as the evening send. Stamps a separate field
 * (`sportsHack2026EventMorningEmailedAt`) so this fires independently
 * of the evening's `sportsHack2026EventTodayEmailedAt`.
 *
 * Usage:
 *   npx tsx scripts/send-may26-event-morning.ts --dry-run
 *   npx tsx scripts/send-may26-event-morning.ts --send --only-email=rhunt@bentley.edu
 *   npx tsx scripts/send-may26-event-morning.ts --send
 *   npx tsx scripts/send-may26-event-morning.ts --send --force
 */
import { loadEnv, escapeHtml, parseSendArgs } from "./_lib/script-utils";
loadEnv();

import { FieldValue } from "firebase-admin/firestore";
import { runEmailCampaign, type EmailContent } from "./_lib/campaign-runner";
import { syncMailgunSuppressions } from "../lib/mailgun-suppressions";
import { buildUnsubscribeUrl } from "../lib/unsubscribe-token";
import {
  getDeclinedEmailsForEvent,
  getJudgeEmailsForEvent,
} from "../lib/hackathon-event-signup";
import {
  SPORTS_HACK_2026_EVENT_ID,
  SPORTS_HACK_2026_NAME,
} from "../lib/sports-hack-2026";

const EVENT_ID = SPORTS_HACK_2026_EVENT_ID;
const STAMP_FIELD = "sportsHack2026EventMorningEmailedAt";

const FROM_ADDRESS = "Cursor Boston <roger@cursorboston.com>";

interface Recipient {
  email: string;
  firstName: string;
  source: "website" | "luma";
  sourceDocId: string;
}

function firstNameFrom(s: string | null | undefined): string {
  if (!s) return "";
  return s.trim().split(/\s+/)[0] ?? "";
}

function buildEmail(r: Recipient): EmailContent {
  const first = escapeHtml(r.firstName?.trim() || "there");
  const firstText = r.firstName?.trim() || "there";
  const unsubUrl = buildUnsubscribeUrl(r.email);

  const subject = "Sports Hack this morning — doors at 9, EAT FIRST, see you at Hult";

  const html = `<!DOCTYPE html><html><body style="font-family:system-ui,Segoe UI,sans-serif;line-height:1.6;color:#111;max-width:640px;">
<p>Good morning ${first},</p>

<p><strong>${escapeHtml(SPORTS_HACK_2026_NAME)}</strong> is in a few hours at Hult International, Cambridge. Quick refresher so you arrive ready.</p>

<div style="border:2px solid #b91c1c;border-radius:8px;padding:14px;margin:18px 0;background:#fef2f2;color:#7f1d1d;text-align:center;">
  <p style="margin:0;font-size:18px;font-weight:700;">EAT + GRAB COFFEE BEFORE YOU COME.</p>
  <p style="margin:6px 0 0 0;font-size:14px;">No coffee or food in the AM. Pizza + drinks arrive around 2:30pm — plan ahead if you need to eat before then.</p>
</div>

<h3 style="margin-top:22px;margin-bottom:10px;">When to arrive</h3>
<ul style="padding-left:20px;">
  <li style="margin-bottom:8px;"><strong>Check-in opens at 9am.</strong> Event starts at 10am. Aim for 9–9:45 — earlier is better.</li>
  <li style="margin-bottom:8px;">200-person venue. Don&apos;t cut it close.</li>
</ul>

<h3 style="margin-top:22px;margin-bottom:10px;">The day</h3>
<ol style="padding-left:20px;">
  <li style="margin-bottom:8px;"><strong>10am — talk from Antonio Mele</strong> (London School of Economics).</li>
  <li style="margin-bottom:8px;"><strong>Hackathon sprint</strong> — build for two hours after the talk.</li>
  <li style="margin-bottom:8px;"><strong>Submit your project</strong> → you get a <strong>Cursor credit link</strong>. Everyone who submits gets one.</li>
  <li style="margin-bottom:8px;"><strong>~2:30pm — pizza + drinks.</strong></li>
  <li style="margin-bottom:8px;"><strong>6 winners total: 3 AI-judged + 3 human-judge picked.</strong> Winners announced at 4pm.</li>
</ol>

<h3 style="margin-top:22px;margin-bottom:10px;">Bring</h3>
<ul style="padding-left:20px;">
  <li style="margin-bottom:6px;">Laptop, charger, whatever you need to build (your own infra — no shared machines).</li>
  <li style="margin-bottom:6px;">Coffee + something to eat <strong>before you walk in</strong>.</li>
</ul>

<p style="margin-top:22px;">See you in a few hours.</p>

<p>— Cursor Boston<br/>
<a href="mailto:roger@cursorboston.com">roger@cursorboston.com</a></p>

<p style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e5e5;font-size:12px;color:#888;">
You&apos;re receiving this because you registered for the Cursor Boston May 26 event on Luma, Partiful, or the website.<br/>
<a href="${escapeHtml(unsubUrl)}" style="color:#888;">Unsubscribe from emails</a>
</p>
</body></html>`;

  const text = `Good morning ${firstText},

${SPORTS_HACK_2026_NAME} is in a few hours at Hult International, Cambridge. Quick refresher so you arrive ready.

⚠️ EAT + GRAB COFFEE BEFORE YOU COME.
No coffee or food in the AM. Pizza + drinks arrive around 2:30pm —
plan ahead if you need to eat before then.

WHEN TO ARRIVE
  - Check-in opens at 9am. Event starts at 10am. Aim for 9–9:45 — earlier is better.
  - 200-person venue. Don't cut it close.

THE DAY
  1. 10am — talk from Antonio Mele (London School of Economics).
  2. Hackathon sprint — build for two hours after the talk.
  3. Submit your project → you get a Cursor credit link. Everyone who submits gets one.
  4. ~2:30pm — pizza + drinks.
  5. 6 winners total: 3 AI-judged + 3 human-judge picked. Winners announced at 4pm.

BRING
  - Laptop, charger, whatever you need to build (your own infra — no shared machines).
  - Coffee + something to eat BEFORE you walk in.

See you in a few hours.

— Cursor Boston
roger@cursorboston.com

---
You're receiving this because you registered for the Cursor Boston May 26 event on Luma, Partiful, or the website.
Unsubscribe: ${unsubUrl}
`;

  return { subject, html, text, from: FROM_ADDRESS };
}

async function main(): Promise<void> {
  const args = parseSendArgs();

  await runEmailCampaign<Recipient>({
    args,
    name: "May 26 Sports Hack morning-of",
    previewMode: "text",
    getEmail: (r) => r.email,
    buildEmail,
    beforeSend: ({ db }) => syncMailgunSuppressions(db),
    loadRecipients: async ({ db }) => {
      const signupSnap = await db
        .collection("hackathonEventSignups")
        .where("eventId", "==", EVENT_ID)
        .get();
      const websiteUserIds = signupSnap.docs
        .map((d) => d.data().userId as string | undefined)
        .filter((u): u is string => Boolean(u));
      const userMap = new Map<string, FirebaseFirestore.DocumentData>();
      for (let i = 0; i < websiteUserIds.length; i += 10) {
        const chunk = websiteUserIds.slice(i, i + 10);
        const refs = chunk.map((id) => db.collection("users").doc(id));
        const snaps = await db.getAll(...refs);
        for (const s of snaps) if (s.exists) userMap.set(s.id, s.data() ?? {});
      }
      console.log(`Website signups (${EVENT_ID}): ${signupSnap.size}`);

      const lumaSnap = await db
        .collection("hackathonLumaRegistrants")
        .where("eventId", "==", EVENT_ID)
        .get();
      console.log(`Luma+Partiful registrants (${EVENT_ID}): ${lumaSnap.size}`);

      const ecSnap = await db.collection("eventContacts").get();
      const unsubscribedEmails = new Set<string>();
      for (const doc of ecSnap.docs) {
        if (doc.data().unsubscribed === true) {
          const e = (doc.data().email || doc.id).toString().trim().toLowerCase();
          if (e) unsubscribedEmails.add(e);
        }
      }
      console.log(`Unsubscribed emails (global): ${unsubscribedEmails.size}`);

      const judgeEmails = getJudgeEmailsForEvent(EVENT_ID);
      const declinedEmails = getDeclinedEmailsForEvent(EVENT_ID);

      const recipients: Recipient[] = [];
      const seenEmails = new Set<string>();
      const websiteGithubLogins = new Set<string>();

      let skippedAlreadyEmailed = 0;
      let skippedOnlyEmailFilter = 0;
      let skippedJudgeOrDeclined = 0;
      let skippedUnsubscribed = 0;
      let skippedNoEmail = 0;

      for (const doc of signupSnap.docs) {
        const data = doc.data();
        const userId = data.userId as string | undefined;
        if (!userId) { skippedNoEmail++; continue; }
        const profile = userMap.get(userId) ?? {};
        const email =
          typeof profile.email === "string" ? profile.email.trim().toLowerCase() : null;
        if (!email) { skippedNoEmail++; continue; }
        if (judgeEmails.has(email) || declinedEmails.has(email)) { skippedJudgeOrDeclined++; continue; }
        if (unsubscribedEmails.has(email)) { skippedUnsubscribed++; continue; }
        if (!args.force && data[STAMP_FIELD]) { skippedAlreadyEmailed++; continue; }
        if (args.onlyEmail && email !== args.onlyEmail) { skippedOnlyEmailFilter++; continue; }
        seenEmails.add(email);
        const ghLogin =
          profile.github && typeof profile.github === "object"
            ? (profile.github as { login?: string }).login ?? null
            : null;
        if (ghLogin) websiteGithubLogins.add(ghLogin.toLowerCase());
        recipients.push({
          email,
          firstName: firstNameFrom(
            typeof profile.displayName === "string" ? profile.displayName : "",
          ),
          source: "website",
          sourceDocId: doc.id,
        });
      }

      for (const doc of lumaSnap.docs) {
        const d = doc.data();
        const email = (d.email as string | undefined)?.trim().toLowerCase() ?? "";
        if (!email) { skippedNoEmail++; continue; }
        if (judgeEmails.has(email) || declinedEmails.has(email)) { skippedJudgeOrDeclined++; continue; }
        if (unsubscribedEmails.has(email)) { skippedUnsubscribed++; continue; }
        if (seenEmails.has(email)) continue;
        const ghLogin = typeof d.githubLogin === "string" ? d.githubLogin : null;
        if (ghLogin && websiteGithubLogins.has(ghLogin.toLowerCase())) continue;
        if (!args.force && d[STAMP_FIELD]) { skippedAlreadyEmailed++; continue; }
        if (args.onlyEmail && email !== args.onlyEmail) { skippedOnlyEmailFilter++; continue; }
        seenEmails.add(email);
        recipients.push({
          email,
          firstName: firstNameFrom(typeof d.name === "string" ? d.name : ""),
          source: "luma",
          sourceDocId: doc.id,
        });
      }

      console.log(`\nRecipients: ${recipients.length}${args.onlyEmail ? ` (--only-email=${args.onlyEmail})` : ""}`);
      const wsCount = recipients.filter((r) => r.source === "website").length;
      console.log(`  Website-signup recipients:        ${wsCount}`);
      console.log(`  Luma/Partiful-only recipients:    ${recipients.length - wsCount}`);
      console.log(`Skipped — judge/declined:           ${skippedJudgeOrDeclined}`);
      console.log(`Skipped — unsubscribed:             ${skippedUnsubscribed}`);
      console.log(`Skipped — no email:                 ${skippedNoEmail}`);
      console.log(`Skipped — already emailed (stamp):  ${skippedAlreadyEmailed}`);
      if (args.onlyEmail) console.log(`Skipped — --only-email filter:      ${skippedOnlyEmailFilter}`);
      return recipients;
    },
    onSent: (r, { db }) =>
      db
        .collection(
          r.source === "website" ? "hackathonEventSignups" : "hackathonLumaRegistrants"
        )
        .doc(r.sourceDocId)
        .update({ [STAMP_FIELD]: FieldValue.serverTimestamp() }),
  });
}

main().catch((e) => { console.error(e); process.exit(1); });
