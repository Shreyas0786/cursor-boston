#!/usr/bin/env node
/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * General broadcast to all eventContacts (2026-05-28).
 *
 * Two beats with equal weight:
 *   1. End of Cohort 1 Hack — Fri Jun 19, 9 AM–7 PM ET at Microsoft NERD,
 *      drop-in, open to everyone (not just cohort 1)
 *   2. First Global Algorithmacy Conference (Trinidad) CFP — abstracts
 *      open now, tentative end-October, definitive dates next week,
 *      3 days
 *
 * Mirrors send-broadcast-2026-05-26.ts plumbing.
 *
 * Usage:
 *   npx tsx scripts/send-broadcast-2026-05-28.ts --dry-run
 *   npx tsx scripts/send-broadcast-2026-05-28.ts --send
 */
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { getAdminDb } from "../lib/firebase-admin";
import { sendEmail } from "../lib/mailgun";
import { syncMailgunSuppressions } from "../lib/mailgun-suppressions";
import { buildUnsubscribeUrl } from "../lib/unsubscribe-token";

const EVENT_PAGE_URL =
  "https://www.cursorboston.com/events/cursor-boston-cohort1-end-hack-2026";
const LUMA_URL = "https://luma.com/cursor-4doe";
const ALGORITHMACY_PAGE_URL = "https://www.cursorboston.com/research";
const ALGORITHMACY_REPO_URL =
  "https://github.com/rogerSuperBuilderAlpha/algorithmacy-conference";
const ALGORITHMACY_SUBMIT_URL =
  "https://github.com/rogerSuperBuilderAlpha/algorithmacy-conference/new/main/submissions";
const ALGORITHMACY_TEMPLATE_URL =
  "https://github.com/rogerSuperBuilderAlpha/algorithmacy-conference/blob/main/submissions/TEMPLATE.md";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

interface ContactData {
  email: string;
  name: string;
  firstName: string;
}

function buildEmail(contact: ContactData): { subject: string; html: string; text: string } {
  const first = escapeHtml(
    contact.firstName?.trim() || contact.name?.split(" ")[0]?.trim() || "there",
  );
  const unsubUrl = buildUnsubscribeUrl(contact.email);

  const subject = "Drop-in hack Jun 19 at Microsoft NERD — and submit a talk for Trinidad";

  const html = `<!DOCTYPE html><html><body style="font-family:system-ui,Segoe UI,sans-serif;line-height:1.6;color:#111;max-width:640px;">
<p>Hi ${first},</p>

<p>Two things on deck, both worth your time.</p>

<h3 style="margin-top:24px;margin-bottom:8px;">1. End of Cohort 1 Hack — Friday June 19, Microsoft NERD</h3>

<p>We&apos;re closing out Summer Cohort 1 with a <strong>drop-in build day at Microsoft NERD in Kendall Square on Friday June 19, 9 AM to 7 PM ET</strong>. Bring a project, pick one up from the wall, or pair with a cohort member on their Week 6 build. Lunch is on us.</p>

<p>Open to everyone — not just Cohort 1. Show up when you can, leave when you need to.</p>

<p><a href="${LUMA_URL}" style="display:inline-block;margin:8px 0;padding:12px 22px;background:#10b981;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">RSVP on Luma</a></p>

<p style="font-size:13px;color:#666;">Event page on the site: <a href="${EVENT_PAGE_URL}">${EVENT_PAGE_URL}</a></p>

<h3 style="margin-top:32px;margin-bottom:8px;">2. Algorithmacy Conference in Trinidad — submit a talk</h3>

<p>The <strong>First Global Algorithmacy Conference</strong> is happening in Trinidad, <strong>tentative dates the end of October</strong> (definitive dates land next week). Three days talking AI in the sunshine — prepare accordingly.</p>

<p>Convened by Roger Hunt III (Bentley University), the conference convenes scholars and practitioners around <em>algorithmacy</em>: the communication competency through which a worker coordinates with another human through an algorithmic third party. If you&apos;re building, studying, or living with that dynamic, <strong>we want your abstract</strong>.</p>

<p><a href="${ALGORITHMACY_SUBMIT_URL}" style="display:inline-block;margin:8px 0;padding:12px 22px;background:#4f46e5;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">Submit an abstract (open a PR)</a></p>

<p style="font-size:13px;color:#666;">Submission template: <a href="${ALGORITHMACY_TEMPLATE_URL}">${ALGORITHMACY_TEMPLATE_URL}</a><br/>
Full CFP + repo: <a href="${ALGORITHMACY_REPO_URL}">${ALGORITHMACY_REPO_URL}</a><br/>
Conference overview: <a href="${ALGORITHMACY_PAGE_URL}">${ALGORITHMACY_PAGE_URL}</a></p>

<hr style="margin:32px 0;border:none;border-top:1px solid #e5e5e5;"/>

<p>Reply with thoughts, questions, or talk ideas you&apos;re kicking around — I read every reply.</p>

<p>— Roger<br/>
<a href="mailto:roger@cursorboston.com">roger@cursorboston.com</a></p>

<p style="font-size:12px;color:#888;margin-top:24px;border-top:1px solid #e5e5e5;padding-top:16px;">You&apos;re receiving this because you registered for a Cursor Boston event. <a href="${unsubUrl}" style="color:#888;">Unsubscribe</a> at any time.</p>
</body></html>`;

  const text = `Hi ${first},

Two things on deck, both worth your time.

1. END OF COHORT 1 HACK — FRIDAY JUNE 19, MICROSOFT NERD

We're closing out Summer Cohort 1 with a drop-in build day at Microsoft NERD in Kendall Square on Friday June 19, 9 AM to 7 PM ET. Bring a project, pick one up from the wall, or pair with a cohort member on their Week 6 build. Lunch is on us.

Open to everyone — not just Cohort 1. Show up when you can, leave when you need to.

RSVP on Luma: ${LUMA_URL}
Event page: ${EVENT_PAGE_URL}

2. ALGORITHMACY CONFERENCE IN TRINIDAD — SUBMIT A TALK

The First Global Algorithmacy Conference is happening in Trinidad, tentative dates the end of October (definitive dates land next week). Three days talking AI in the sunshine — prepare accordingly.

Convened by Roger Hunt III (Bentley University), the conference convenes scholars and practitioners around algorithmacy: the communication competency through which a worker coordinates with another human through an algorithmic third party. If you're building, studying, or living with that dynamic, we want your abstract.

Submit an abstract (open a PR):
${ALGORITHMACY_SUBMIT_URL}

Submission template: ${ALGORITHMACY_TEMPLATE_URL}
Full CFP + repo:     ${ALGORITHMACY_REPO_URL}
Conference overview: ${ALGORITHMACY_PAGE_URL}

---

Reply with thoughts, questions, or talk ideas you're kicking around — I read every reply.

— Roger
roger@cursorboston.com

You're receiving this because you registered for a Cursor Boston event.
Unsubscribe: ${unsubUrl}
`;

  return { subject, html, text };
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const send = args.includes("--send");

  if ((dryRun && send) || (!dryRun && !send)) {
    console.error("Specify exactly one of: --dry-run | --send");
    process.exit(1);
  }
  if (send) {
    if (!process.env.MAILGUN_API_KEY || !process.env.MAILGUN_DOMAIN) {
      console.error("For --send, set MAILGUN_API_KEY and MAILGUN_DOMAIN.");
      process.exit(1);
    }
  }

  const db = getAdminDb();
  if (!db) {
    console.error(
      "Firebase Admin not configured (FIREBASE_SERVICE_ACCOUNT_JSON / GOOGLE_APPLICATION_CREDENTIALS).",
    );
    process.exit(1);
  }

  await syncMailgunSuppressions(db);

  console.log("Loading contacts from eventContacts…");
  const snap = await db.collection("eventContacts").get();
  console.log(`Total contacts: ${snap.size}`);

  const contacts: ContactData[] = [];
  let skippedUnsubscribed = 0;

  for (const doc of snap.docs) {
    const data = doc.data();
    if (data.unsubscribed === true) {
      skippedUnsubscribed++;
      continue;
    }
    contacts.push({
      email: data.email || doc.id,
      name: data.name || "",
      firstName: data.firstName || "",
    });
  }

  console.log(`Eligible: ${contacts.length} | Skipped unsubscribed: ${skippedUnsubscribed}`);

  if (dryRun) {
    console.log("\n--dry-run: no emails sent.\n");
    const sample = contacts[0];
    if (sample) {
      const { subject, html, text } = buildEmail(sample);
      console.log(`Sample to: ${sample.email}`);
      console.log(`Subject: ${subject}`);
      console.log("\n--- HTML preview (first 2000 chars) ---");
      console.log(html.slice(0, 2000));
      console.log("\n--- Text preview ---");
      console.log(text);
    }
    console.log(`\nWould send to ${contacts.length} contacts.`);
    return;
  }

  let sent = 0;
  let failed = 0;
  for (const contact of contacts) {
    const { subject, html, text } = buildEmail(contact);
    try {
      await sendEmail({ to: contact.email, subject, html, text });
      sent++;
      if (sent % 50 === 0) {
        console.log(`  Progress: ${sent}/${contacts.length}`);
      }
    } catch (e) {
      failed++;
      console.error(`Failed: ${contact.email}`, e);
    }
    await sleep(450);
  }

  console.log(`\nDone. Sent ${sent}, failed ${failed}, skipped ${skippedUnsubscribed}.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
