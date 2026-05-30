/**
 * @jest-environment node
 *
 * Canonical UnitStack arithmetic helpers, extracted from the four modules that
 * each had their own copy.
 */
import {
  sumStack,
  emptyStack,
  addStacks,
  subtractStack,
  stackHasAtLeast,
  isValidUnitStack,
} from "@/lib/game/unit-stack";

describe("unit-stack", () => {
  it("sumStack totals all three arms", () => {
    expect(sumStack({ ground: 2, siege: 3, air: 5 })).toBe(10);
    expect(sumStack(emptyStack())).toBe(0);
  });

  it("emptyStack is a fresh zero stack", () => {
    expect(emptyStack()).toEqual({ ground: 0, siege: 0, air: 0 });
  });

  it("addStacks sums component-wise", () => {
    expect(addStacks({ ground: 1, siege: 2, air: 3 }, { ground: 4, siege: 5, air: 6 })).toEqual(
      { ground: 5, siege: 7, air: 9 }
    );
  });

  it("subtractStack floors each arm at zero", () => {
    expect(subtractStack({ ground: 5, siege: 1, air: 0 }, { ground: 2, siege: 3, air: 4 })).toEqual(
      { ground: 3, siege: 0, air: 0 }
    );
  });

  it("stackHasAtLeast requires coverage in every arm", () => {
    const have = { ground: 5, siege: 5, air: 5 };
    expect(stackHasAtLeast(have, { ground: 5, siege: 5, air: 5 })).toBe(true);
    expect(stackHasAtLeast(have, { ground: 6, siege: 0, air: 0 })).toBe(false);
  });

  it("isValidUnitStack rejects non-integer, negative, and malformed stacks", () => {
    expect(isValidUnitStack({ ground: 1, siege: 2, air: 3 })).toBe(true);
    expect(isValidUnitStack({ ground: 1.5, siege: 2, air: 3 })).toBe(false);
    expect(isValidUnitStack({ ground: -1, siege: 2, air: 3 })).toBe(false);
    expect(isValidUnitStack({ ground: 1, siege: 2 })).toBe(false);
    expect(isValidUnitStack(null)).toBe(false);
    expect(isValidUnitStack("nope")).toBe(false);
  });
});
