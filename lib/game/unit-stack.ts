/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * Canonical helpers for `UnitStack` arithmetic.
 *
 * `sumStack` was previously defined byte-identically in four files
 * (data-server, combat, npc-weekly, discord-game) and `addStack`/`addStacks`
 * in two more — drifting copies of the same trivial math. They live here once
 * now. Note `zero-turn.ts` keeps its own `addStack(a, delta: Partial<UnitStack>)`
 * deliberately: that is a partial-delta merge with different semantics, not this
 * two-full-stacks addition.
 */
import type { UnitStack } from "./types";

/** Total unit count across all three arms. */
export function sumStack(s: UnitStack): number {
  return s.ground + s.siege + s.air;
}

/** A fresh zero stack. */
export function emptyStack(): UnitStack {
  return { ground: 0, siege: 0, air: 0 };
}

/** Component-wise sum of two full stacks. */
export function addStacks(a: UnitStack, b: UnitStack): UnitStack {
  return {
    ground: a.ground + b.ground,
    siege: a.siege + b.siege,
    air: a.air + b.air,
  };
}

/** Component-wise subtraction, floored at zero per arm. */
export function subtractStack(a: UnitStack, b: UnitStack): UnitStack {
  return {
    ground: Math.max(0, a.ground - b.ground),
    siege: Math.max(0, a.siege - b.siege),
    air: Math.max(0, a.air - b.air),
  };
}

/** True when `have` covers `need` in every arm. */
export function stackHasAtLeast(have: UnitStack, need: UnitStack): boolean {
  return (
    have.ground >= need.ground &&
    have.siege >= need.siege &&
    have.air >= need.air
  );
}

/** Runtime guard: a non-negative integer stack on all three arms. */
export function isValidUnitStack(s: unknown): s is UnitStack {
  if (!s || typeof s !== "object") return false;
  const obj = s as Record<string, unknown>;
  return (
    typeof obj.ground === "number" &&
    typeof obj.siege === "number" &&
    typeof obj.air === "number" &&
    obj.ground >= 0 &&
    obj.siege >= 0 &&
    obj.air >= 0 &&
    Number.isInteger(obj.ground) &&
    Number.isInteger(obj.siege) &&
    Number.isInteger(obj.air)
  );
}
