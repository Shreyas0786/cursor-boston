/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * Firestore backfill/seed harness for the `scripts/{seed,backfill,sync}-*`
 * one-off scripts.
 *
 * Owns the parts those scripts kept re-implementing: env validation, the
 * `--dry-run` vs `--apply` branch, idempotency-skip counting, batched writes
 * with the 500-op Firestore cap (default chunk 400), and a summary line.
 *
 * A caller supplies `load` (the documents/items to walk) and `process` (turn
 * one item into zero or more writes, or skip it).
 */
import type { DocumentReference, Firestore } from "firebase-admin/firestore";
import { getAdminDb } from "../../lib/firebase-admin";
import { requireFirebaseEnv, type DbArgs } from "./script-utils";

export type WriteMode = "set" | "merge" | "update" | "delete";

export interface WriteOp {
  ref: DocumentReference;
  /** Required for set/merge/update; ignored for delete. */
  data?: Record<string, unknown>;
  mode: WriteMode;
}

export interface RunBackfillOptions<T> {
  args: DbArgs;
  name: string;
  /** Fetch the items to process (doc snapshots, refs, rows — caller's choice). */
  load: (ctx: { db: Firestore; args: DbArgs }) => Promise<T[]>;
  /**
   * Turn one item into zero or more writes. Return `null` (or `[]`) to skip the
   * item — skips are counted and reported separately from writes.
   */
  process: (item: T, ctx: { db: Firestore }) => WriteOp[] | WriteOp | null;
  /** Max ops per committed batch (default 400; Firestore hard cap is 500). */
  batchSize?: number;
}

export interface BackfillResult {
  total: number;
  written: number;
  skipped: number;
}

/**
 * Walk a set of items, compute writes for each, and commit them in batches
 * (or just report them, under `--dry-run`).
 */
export async function runBackfill<T>(
  opts: RunBackfillOptions<T>
): Promise<BackfillResult> {
  const { args, name, load, process: processItem, batchSize = 400 } = opts;

  requireFirebaseEnv();
  const db = getAdminDb();
  if (!db) {
    throw new Error("Firebase Admin not configured (getAdminDb returned null).");
  }

  console.log(`\n[${name}] loading items…`);
  const items = await load({ db, args });
  console.log(`[${name}] items: ${items.length}`);

  const ops: WriteOp[] = [];
  let skipped = 0;
  for (const item of items) {
    const result = processItem(item, { db });
    if (!result) {
      skipped++;
      continue;
    }
    const list = Array.isArray(result) ? result : [result];
    if (list.length === 0) {
      skipped++;
      continue;
    }
    ops.push(...list);
  }

  console.log(
    `[${name}] writes queued: ${ops.length} | items skipped: ${skipped}`
  );

  if (args.dryRun) {
    console.log(`\n--dry-run: no writes committed.`);
    for (const op of ops.slice(0, 5)) {
      console.log(`  would ${op.mode}: ${op.ref.path}`);
    }
    if (ops.length > 5) console.log(`  …and ${ops.length - 5} more`);
    return { total: items.length, written: 0, skipped };
  }

  let written = 0;
  for (let i = 0; i < ops.length; i += batchSize) {
    const chunk = ops.slice(i, i + batchSize);
    const batch = db.batch();
    for (const op of chunk) {
      if (op.mode === "delete") {
        batch.delete(op.ref);
      } else if (op.mode === "set") {
        batch.set(op.ref, op.data ?? {});
      } else if (op.mode === "merge") {
        batch.set(op.ref, op.data ?? {}, { merge: true });
      } else {
        batch.update(op.ref, op.data ?? {});
      }
    }
    await batch.commit();
    written += chunk.length;
    console.log(`  committed ${written}/${ops.length}`);
  }

  console.log(`\n[${name}] done. Wrote ${written}, skipped ${skipped}.`);
  return { total: items.length, written, skipped };
}
