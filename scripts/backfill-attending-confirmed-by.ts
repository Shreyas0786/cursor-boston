#!/usr/bin/env node
/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * One-shot backfill for the new `attendingConfirmedBy` field on
 * `hackathonEventSignups`. Defaults to `"user"` for every existing doc that
 * has `attendingConfirmedAt` set but no `attendingConfirmedBy`.
 *
 * Why "user" is the safe default: this script ships before any door
 * check-in flow has run for sports-hack-2026 (event is May 26). All current
 * `attendingConfirmedAt` rows were written by POST /api/.../confirm-attendance
 * which is the user-initiated path. Once this backfill lands, new writes are
 * tagged at the source (POST tags "user", checkin route tags "admin").
 *
 * Idempotent: re-runs only touch docs that lack the field.
 *
 * Usage:
 *   npx tsx scripts/backfill-attending-confirmed-by.ts --dry-run
 *   npx tsx scripts/backfill-attending-confirmed-by.ts --write
 *
 * Optional: --event=<id> restricts to one event. Default: all events.
 */
import { loadEnv, parseDbArgs } from "./_lib/script-utils";
loadEnv();

import { runBackfill, type WriteOp } from "./_lib/db-runner";
import type { QueryDocumentSnapshot } from "firebase-admin/firestore";

async function main(): Promise<void> {
  const args = parseDbArgs(process.argv.slice(2), ["--write"]);
  const eventArg = process.argv.find((a) => a.startsWith("--event="));
  const eventFilter = eventArg ? eventArg.slice("--event=".length) : null;

  await runBackfill<QueryDocumentSnapshot>({
    args,
    name: "attendingConfirmedBy backfill",
    load: async ({ db }) => {
      let query: FirebaseFirestore.Query = db.collection("hackathonEventSignups");
      if (eventFilter) {
        query = query.where("eventId", "==", eventFilter);
        console.log(`Filtering to eventId="${eventFilter}"`);
      }
      const snap = await query.get();
      console.log(`Total signup docs scanned: ${snap.size}`);

      let alreadyTagged = 0;
      let noConfirmAt = 0;
      const toBackfill: QueryDocumentSnapshot[] = [];
      for (const doc of snap.docs) {
        const data = doc.data();
        if (!data.attendingConfirmedAt) {
          noConfirmAt++;
          continue;
        }
        if (
          data.attendingConfirmedBy === "user" ||
          data.attendingConfirmedBy === "admin"
        ) {
          alreadyTagged++;
          continue;
        }
        toBackfill.push(doc);
      }

      console.log(`Already tagged:           ${alreadyTagged}`);
      console.log(`No attendingConfirmedAt:  ${noConfirmAt}`);
      console.log(`Would backfill to "user": ${toBackfill.length}`);

      if (toBackfill.length > 0) {
        const byEvent = new Map<string, number>();
        for (const doc of toBackfill) {
          const eid = (doc.data().eventId as string) ?? "?";
          byEvent.set(eid, (byEvent.get(eid) ?? 0) + 1);
        }
        console.log("\nBy event:");
        for (const [eid, n] of [...byEvent].sort((a, b) => b[1] - a[1])) {
          console.log(`  ${eid.padEnd(28)} ${n}`);
        }
      }
      return toBackfill;
    },
    process: (doc): WriteOp => ({
      ref: doc.ref,
      mode: "update",
      data: { attendingConfirmedBy: "user" },
    }),
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
