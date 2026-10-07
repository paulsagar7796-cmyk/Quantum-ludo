import { describe as suite, expect, it } from "vitest";
import { describe } from "./format";

const name = (seat: number) => ["You", "The Racer"][seat]!;

suite("move log text", () => {
  it("uses the right grammar for you and for others", () => {
    expect(describe({ type: "passed", seat: 0 }, name)?.text).toBe("You have no move");
    expect(describe({ type: "passed", seat: 1 }, name)?.text).toBe("The Racer has no move");
    expect(
      describe({ type: "captured", seat: 1, victim: { seat: 0, token: 2 }, square: 7, wasSplit: false }, name)?.text,
    ).toBe("The Racer captured you");
    expect(describe({ type: "knockback", seat: 0, token: 1, from: 30, to: 24 }, name)?.text).toBe(
      "Your linked partner was knocked back 6",
    );
  });

  it("marks a free Force on the leader", () => {
    expect(
      describe({ type: "observed", seat: 1, target: { seat: 0, token: 0 }, mode: "choice", free: true }, name)?.text,
    ).toBe("The Racer used Force on you (free: leader)");
  });

  it("skips bookkeeping events", () => {
    expect(describe({ type: "qSpent", seat: 0, mechanic: "ghost" }, name)).toBeNull();
    expect(describe({ type: "turnStart", seat: 0, round: 1, bonus: false }, name)).toBeNull();
  });
});
