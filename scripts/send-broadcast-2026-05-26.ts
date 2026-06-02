#!/usr/bin/env node
/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * General broadcast to all eventContacts (2026-05-26 evening).
 *
 * Sent the evening after the Boston Tech Week Sports Hack at Hult.
 * Three beats:
 *   1. Thanks — the Sports Hack today was a knockout
 *   2. Want to host an event with us? Reply.
 *   3. New essay from Roger: The Death of the University Degree
 *
 * Mirrors send-broadcast-2026-05-07.ts mechanics: pulls from eventContacts,
 * skips unsubscribed, syncs Mailgun suppressions first, HMAC unsubscribe link.
 *
 * Usage:
 *   npx tsx scripts/send-broadcast-2026-05-26.ts --dry-run
 *   npx tsx scripts/send-broadcast-2026-05-26.ts --send
 *
 * Requires: FIREBASE_SERVICE_ACCOUNT_JSON
 * For --send: MAILGUN_API_KEY, MAILGUN_DOMAIN, UNSUBSCRIBE_SECRET
 */
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { getAdminDb } from "../lib/firebase-admin";
import { sendEmail } from "../lib/mailgun";
import { syncMailgunSuppressions } from "../lib/mailgun-suppressions";
import { buildUnsubscribeUrl } from "../lib/unsubscribe-token";

const SUBMISSIONS_URL =
  "https://www.cursorboston.com/events/cursor-boston-sports-hack-2026";
const SUBSTACK_URL =
  "https://rogerhuntphdcand.substack.com/p/the-death-of-the-university-degree";
const REPO_URL = "https://github.com/rogerSuperBuilderAlpha/cursor-boston";

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

  const subject = "Thanks for a knockout Sports Hack — and a new essay";

  const html = `<!DOCTYPE html><html><body style="font-family:system-ui,Segoe UI,sans-serif;line-height:1.6;color:#111;max-width:640px;">
<p>Hi ${first},</p>

<p>Today was a <strong>total knockout</strong>. Thank you to everyone who showed up at the Boston Tech Week Sports Hack at Hult — builders, mentors, sponsors, and the crew making sure the wifi held up. The room was electric, the submissions kept landing all afternoon, and the demos were genuinely impressive.</p>

<p>If you want to see what got built, the submission board is here: <a href="${SUBMISSIONS_URL}">${SUBMISSIONS_URL}</a>. Every project is open source.</p>

<h3 style="margin-top:24px;margin-bottom:8px;">Want to host an event with us?</h3>

<p>If you&apos;ve been thinking about running a hackathon, workshop, or evening build at your company, school, or space — <strong>reply to this email</strong>. We&apos;ll figure it out. The Sports Hack was the fourth event we&apos;ve done this month and we have the playbook dialed in: registration, judging, sponsorship, AI scoring, the works. You bring the audience and the room; we&apos;ll bring the format.</p>

<h3 style="margin-top:24px;margin-bottom:8px;">New essay — The Death of the University Degree</h3>

<p>I wrote a piece this week on what AI-native tooling is doing to the credentialing model that most of higher ed still runs on. If you care about how people learn to build now — and where the signal of "this person can ship" actually comes from — give it a read:</p>

<p><a href="${SUBSTACK_URL}" style="display:inline-block;margin:8px 0;padding:12px 22px;background:#111;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">Read: The Death of the University Degree</a></p>

<p>Reply with thoughts, pushback, or quotes from your own experience — I&apos;m collecting reactions.</p>

<p>— Roger<br/>
<a href="mailto:roger@cursorboston.com">roger@cursorboston.com</a></p>

<p style="font-size:12px;color:#888;margin-top:24px;border-top:1px solid #e5e5e5;padding-top:16px;">You&apos;re receiving this because you registered for a Cursor Boston event. <a href="${unsubUrl}" style="color:#888;">Unsubscribe</a> at any time.<br/>
<small>Repo: <a href="${REPO_URL}" style="color:#888;">${REPO_URL}</a></small></p>
</body></html>`;

  const text = `Hi ${first},

Today was a TOTAL KNOCKOUT. Thank you to everyone who showed up at the Boston Tech Week Sports Hack at Hult — builders, mentors, sponsors, and the crew making sure the wifi held up. The room was electric, the submissions kept landing all afternoon, and the demos were genuinely impressive.

If you want to see what got built, the submission board is here:
${SUBMISSIONS_URL}

Every project is open source.

WANT TO HOST AN EVENT WITH US?

If you've been thinking about running a hackathon, workshop, or evening build at your company, school, or space — reply to this email. We'll figure it out. The Sports Hack was the fourth event we've done this month and we have the playbook dialed in: registration, judging, sponsorship, AI scoring, the works. You bring the audience and the room; we'll bring the format.

NEW ESSAY — THE DEATH OF THE UNIVERSITY DEGREE

I wrote a piece this week on what AI-native tooling is doing to the credentialing model that most of higher ed still runs on. If you care about how people learn to build now — and where the signal of "this person can ship" actually comes from — give it a read:

${SUBSTACK_URL}

Reply with thoughts, pushback, or quotes from your own experience — I'm collecting reactions.

— Roger
roger@cursorboston.com

---
You're receiving this because you registered for a Cursor Boston event.
Unsubscribe: ${unsubUrl}
Repo: ${REPO_URL}
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
      console.log("\n--- HTML preview (first 1800 chars) ---");
      console.log(html.slice(0, 1800));
      console.log("\n--- Text preview (first 1200 chars) ---");
      console.log(text.slice(0, 1200));
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
