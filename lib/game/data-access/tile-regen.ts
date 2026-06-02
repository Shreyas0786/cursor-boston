/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * Lazy BASE-unit regen applied on read.
 *
 * Extracted from data-server and split into a **pure** computation
 * (`computeLazyBaseRegen` — no I/O, unit-testable) and the side-effecting
 * wrappers (`applyLazyRegen` / `applyLazyRegenBatch`) that fire the
 * non-awaited Firestore writeback. This decouples the read getters from the
 * write path so they can live in the data-access layer without dragging
 * mutation logic along.
 */
import type { Firestore, Timestamp } from "firebase-admin/firestore";
import { applyBaseRegen, baseUnitsTarget } from "../combat";
import { logger } from "@/lib/logger";
import type { GamePlayer, GameTile } from "../types";
import { GAME_COLLECTIONS as COLLECTIONS } from "./collections";
import { adminDbOrThrow } from "./db";

/**
 * Pure BASE-regen computation for one tile. Returns the regenerated
 * `baseUnits`/`baseRegenedAt` when regen is due, or `null` when the tile is
 * unowned or there's nothing to regen (so the caller can skip the writeback).
 */
export function computeLazyBaseRegen(
  tile: GameTile,
  player: GamePlayer | null,
  now: Date
): { baseUnits: GameTile["baseUnits"]; baseRegenedAt: Date } | null {
  if (!tile.ownerId) return null;
  const currentBase = tile.baseUnits ?? { ground: 0, siege: 0, air: 0 };
  const target = baseUnitsTarget({
    landType: tile.type,
    caste: player?.caste ?? null,
    upgradeIds: tile.upgradeIds,
    intrinsicBuffs: tile.intrinsicBuffs,
    createdAt:
      tile.createdAt instanceof Date
        ? tile.createdAt
        : typeof (tile.createdAt as Timestamp | undefined)?.toDate === "function"
          ? (tile.createdAt as Timestamp).toDate()
          : undefined,
    activeUpgrades: player?.activeUpgrades ?? {},
    productionSpellsActive: player?.productionSpellsActive,
    now,
  });
  const baseRegenedAt =
    tile.baseRegenedAt instanceof Date
      ? tile.baseRegenedAt
      : typeof (tile.baseRegenedAt as Timestamp | undefined)?.toDate ===
          "function"
        ? (tile.baseRegenedAt as Timestamp).toDate()
        : tile.createdAt instanceof Date
          ? tile.createdAt
          : typeof (tile.createdAt as Timestamp | undefined)?.toDate ===
              "function"
            ? (tile.createdAt as Timestamp).toDate()
            : now;
  const result = applyBaseRegen({
    currentBase,
    target,
    landType: tile.type,
    baseRegenedAt,
    now,
  });
  if (result.deltaUnits <= 0) return null;
  return { baseUnits: result.baseUnits, baseRegenedAt: result.baseRegenedAt };
}

/**
 * Apply lazy regen to one tile: computes the regen, fires a fire-and-forget
 * Firestore writeback when there's a delta (failures logged, not awaited, so
 * the read path stays snappy), and returns the regenerated tile in-memory.
 */
export function applyLazyRegen(
  tile: GameTile,
  player: GamePlayer | null,
  now: Date,
  db: Firestore
): GameTile {
  const regen = computeLazyBaseRegen(tile, player, now);
  if (!regen) return tile;
  db.collection(COLLECTIONS.TILES)
    .doc(tile.tileId)
    .update({
      baseUnits: regen.baseUnits,
      baseRegenedAt: regen.baseRegenedAt,
    })
    .catch((e) => {
      logger.warn("applyLazyRegen writeback failed", {
        tileId: tile.tileId,
        error: e instanceof Error ? e.message : String(e),
      });
    });
  return {
    ...tile,
    baseUnits: regen.baseUnits,
    baseRegenedAt: regen.baseRegenedAt,
  };
}

// In-memory + fire-and-forget Firestore writeback of BASE regen across a
// batch of tiles. Returns the regenerated tiles. Writes only fire for tiles
// where the BASE delta is non-zero (avoids write storms on read-heavy paths).
// The writes are not awaited — the caller's response uses the in-memory
// regen result; the next request reads the persisted values.
export function applyLazyRegenBatch(
  tiles: GameTile[],
  player: GamePlayer | null,
  now: Date
): GameTile[] {
  const db = adminDbOrThrow();
  const out: GameTile[] = [];
  for (const t of tiles) {
    out.push(applyLazyRegen(t, player, now, db));
  }
  return out;
}
