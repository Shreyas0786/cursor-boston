/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * World-meta singleton accessors.
 *
 * `defaultedWorldMeta` (the pure defaulting helper) and `getWorldMetaServer`
 * (the read-only fetch) move here out of data-server. The transactional
 * `readWorldMetaInTx` stays in data-server and imports `defaultedWorldMeta`
 * back — this module holds no transaction state, so there's no cycle.
 */
import type { GameWorldMeta } from "../types";
import { GAME_COLLECTIONS as COLLECTIONS, WORLD_META_DOC } from "./collections";
import { adminDbOrThrow } from "./db";

/** Fill a partial/absent world-meta doc with its documented defaults. */
export function defaultedWorldMeta(
  raw: Partial<GameWorldMeta> | undefined
): GameWorldMeta {
  return {
    playerCount: raw?.playerCount ?? 0,
    seasonNumber: raw?.seasonNumber ?? 1,
    sealsBroken: raw?.sealsBroken ?? 0,
    seals: raw?.seals ?? [],
    armageddonState: raw?.armageddonState ?? "active",
    armageddonStartedAt: raw?.armageddonStartedAt,
    armageddonResolvedAt: raw?.armageddonResolvedAt,
    lastSpawnAt: raw?.lastSpawnAt,
    updatedAt: raw?.updatedAt,
  };
}

/** Read-only world-meta fetch for dashboard / hall-of-fame surfacing.
 *  Returns the defaulted shape even when the doc doesn't exist yet. */
export async function getWorldMetaServer(): Promise<GameWorldMeta> {
  const db = adminDbOrThrow();
  const snap = await db
    .collection(COLLECTIONS.WORLD_META)
    .doc(WORLD_META_DOC)
    .get();
  const raw = snap.exists ? (snap.data() as Partial<GameWorldMeta>) : undefined;
  return defaultedWorldMeta(raw);
}
