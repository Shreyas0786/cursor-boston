/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * Shared recipient loading for the Cohort 1 send-* scripts.
 *
 * Every `send-cohort1-*` script walked the summer-cohort collection with the
 * identical "admitted, in cohort-1, not yet stamped, optional --only-email"
 * filter and the same skip-counter logging. That block lived (byte-identical)
 * in 4+ scripts; it lives here once now. Each campaign differs only in its
 * idempotency stamp field and email template.
 */
import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { SUMMER_COHORT_COLLECTION } from "../../lib/summer-cohort";
import type { SendArgs } from "./script-utils";

export interface Cohort1Recipient {
  applicationId: string;
  email: string;
  firstName: string;
}

/**
 * Load admitted cohort-1 applicants not yet stamped with `stampField`, honoring
 * `--force` (ignore stamp) and `--only-email`. Logs per-reason skip counts.
 */
export async function loadAdmittedCohort1Recipients(
  ctx: { db: Firestore; args: SendArgs },
  stampField: string
): Promise<Cohort1Recipient[]> {
  const { db, args } = ctx;
  const appsSnap = await db.collection(SUMMER_COHORT_COLLECTION).get();

  const recipients: Cohort1Recipient[] = [];
  let skippedNotCohort1 = 0;
  let skippedNotAdmitted = 0;
  let skippedAlreadyEmailed = 0;
  let skippedNoEmail = 0;
  let skippedOnlyEmailFilter = 0;

  for (const appDoc of appsSnap.docs) {
    const d = appDoc.data() as {
      cohorts?: string[];
      status?: string;
      email?: string;
      name?: string;
      [key: string]: unknown;
    };
    const cohorts = Array.isArray(d.cohorts) ? d.cohorts : [];
    if (!cohorts.includes("cohort-1")) {
      skippedNotCohort1++;
      continue;
    }
    if (d.status !== "admitted") {
      skippedNotAdmitted++;
      continue;
    }
    if (!d.email) {
      skippedNoEmail++;
      continue;
    }
    if (!args.force && d[stampField]) {
      skippedAlreadyEmailed++;
      continue;
    }
    if (args.onlyEmail && d.email.trim().toLowerCase() !== args.onlyEmail) {
      skippedOnlyEmailFilter++;
      continue;
    }
    const name = d.name?.trim() || "";
    const firstName = name.split(" ")[0] || "";
    recipients.push({
      applicationId: appDoc.id,
      email: d.email.trim(),
      firstName,
    });
  }

  console.log(
    `Eligible (admitted cohort-1${args.onlyEmail ? `, --only-email=${args.onlyEmail}` : ""}, not yet emailed): ${recipients.length}`
  );
  console.log(`Skipped — not cohort-1: ${skippedNotCohort1}`);
  console.log(`Skipped — not admitted: ${skippedNotAdmitted}`);
  console.log(`Skipped — no email: ${skippedNoEmail}`);
  console.log(`Skipped — already emailed (${stampField}): ${skippedAlreadyEmailed}`);
  if (args.onlyEmail) {
    console.log(`Skipped — --only-email filter: ${skippedOnlyEmailFilter}`);
  }
  return recipients;
}

/** Write the idempotency stamp for a cohort-1 recipient after a successful send. */
export function stampCohort1(
  db: Firestore,
  applicationId: string,
  stampField: string
): Promise<unknown> {
  return db
    .collection(SUMMER_COHORT_COLLECTION)
    .doc(applicationId)
    .update({ [stampField]: FieldValue.serverTimestamp() });
}
