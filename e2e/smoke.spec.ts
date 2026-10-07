import { expect, test, type Page } from "@playwright/test";

/** Seeds the saved lobby settings before the app loads. */
async function seedLobby(page: Page, seats: ("human" | "bot")[], botSpeed = "instant") {
  const bots = ["hunter", "racer", "gambler", "banker"];
  const match = {
    playerCount: seats.length,
    observationMode: "choice",
    botSpeed,
    seats: [0, 1, 2, 3].map((i) => ({ kind: seats[i] ?? "bot", bot: bots[i], name: seats[i] === "human" ? "You" : "" })),
  };
  await page.addInitScript((m) => localStorage.setItem("qludo.match.v1", JSON.stringify(m)), match);
}

test("lobby offers players, Force mode and start", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Quantum Ludo" })).toBeVisible();
  await expect(page.getByRole("radio", { name: "4 players" })).toBeChecked();
  await expect(page.getByRole("radio", { name: "Tactical (choice)" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Start game" })).toBeVisible();
});

test("a human can roll and play a turn", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await seedLobby(page, ["human", "bot"]);
  await page.goto("/");
  await page.getByRole("button", { name: "Start game" }).click();
  await expect(page.getByRole("img", { name: "Quantum Ludo board" })).toBeVisible();

  // Keep acting until the log shows we rolled at least three times.
  for (let i = 0; i < 200; i++) {
    for (const label of [/^Roll/, /^Move/, /^Land on A/, /^Pass/]) {
      const b = page.getByRole("button", { name: label });
      if (await b.isVisible().catch(() => false)) await b.click();
    }
    const movable = page.getByRole("button", { name: /^Token \d/ });
    if (await movable.first().isVisible().catch(() => false)) await movable.first().click();
    if ((await page.getByText(/^You rolled a \d$/).count()) >= 3) break;
  }
  expect(await page.getByText(/^You rolled a \d$/).count()).toBeGreaterThanOrEqual(3);
  expect(errors).toEqual([]);
});

test("an all-bot game plays to the results screen", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await seedLobby(page, ["bot", "bot", "bot", "bot"]);
  await page.goto("/");
  await page.getByRole("button", { name: "Start game" }).click();
  const results = page.getByRole("dialog");
  await expect(results).toBeVisible({ timeout: 80_000 });
  await expect(results.getByRole("row")).toHaveCount(5); // header + 4 placements
  await expect(results.getByRole("button", { name: "Rematch" })).toBeVisible();
  expect(errors).toEqual([]);
});

for (const mechanic of ["Split", "Ghost"] as const) {
  test(`a human can use ${mechanic} through the UI`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await seedLobby(page, ["human", "bot"]);
    await page.goto("/");
    await page.getByRole("button", { name: "Start game" }).click();

    const quantum = page.getByRole("button", { name: new RegExp(`^${mechanic}`) });
    for (let i = 0; i < 400 && !(await quantum.isVisible().catch(() => false)); i++) {
      // Roll and pick a token; move only when the quantum option is not on offer.
      for (const label of [/^Roll/, /^Land on A/, /^Pass/]) {
        const b = page.getByRole("button", { name: label });
        if (await b.isVisible().catch(() => false)) await b.click();
      }
      const token = page.getByRole("button", { name: /^Token \d/ });
      if (await token.first().isVisible().catch(() => false)) await token.first().click();
      if (await quantum.isVisible().catch(() => false)) break;
      const move = page.getByRole("button", { name: /^Move/ });
      if (await move.isVisible().catch(() => false)) await move.click();
    }
    await quantum.click();
    await page.getByRole("button", { name: `Confirm ${mechanic}` }).click();
    // The full log is a sidebar on desktop and a sheet on phones, so check the entry exists.
    await expect(page.getByText(`You used ${mechanic}`, { exact: true })).toBeAttached();
    expect(errors).toEqual([]);
  });
}

test("the die tumbles before showing the roll, with sound", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  // Count synthesised sounds by wrapping the Web Audio oscillator factory.
  await page.addInitScript(() => {
    const w = window as unknown as { __oscillators: number };
    w.__oscillators = 0;
    const original = AudioContext.prototype.createOscillator;
    AudioContext.prototype.createOscillator = function (this: AudioContext) {
      w.__oscillators++;
      return original.call(this);
    };
  });
  await seedLobby(page, ["human", "bot"], "fast");
  await page.goto("/");
  await page.getByRole("button", { name: "Start game" }).click();

  await page.getByRole("button", { name: /^Roll/ }).click();
  await expect(page.getByRole("img", { name: "Rolling the die" })).toBeVisible();
  await expect(page.getByText("You are rolling…")).toBeVisible();
  await expect(page.getByRole("button", { name: /^Roll/ })).toBeHidden();

  await expect(page.getByRole("img", { name: /^Die shows [1-6]$/ })).toBeVisible({ timeout: 2000 });
  // The roll reaches the move log only once the die has landed.
  await expect(page.getByText(/^You rolled a [1-6]$/).first()).toBeAttached();
  expect(await page.evaluate(() => (window as unknown as { __oscillators: number }).__oscillators)).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});
