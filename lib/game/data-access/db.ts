/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * Shared Firestore-admin accessor for the game's server modules.
 *
 * `adminDbOrThrow()` was defined byte-identically in eight game modules
 * (data-server, armageddon-resolve, community, hero-lore, prophecies, orders,
 * pacts, reactions). It is the foundational handle every server-side game write
 * goes through; centralized here.
 */
import type { Firestore } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";

/** Return the Firestore admin handle, throwing if Admin SDK isn't configured. */
export function adminDbOrThrow(): Firestore {
  const db = getAdminDb();
  if (!db) throw new Error("Firebase Admin not initialized");
  return db;
}
