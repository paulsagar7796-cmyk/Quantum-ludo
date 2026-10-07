/// <reference lib="dom" />
import { expect, test, type Page } from "@playwright/test";

// Plays against the real Supabase project, so it only runs when asked: ONLINE_E2E=1 pnpm e2e
test.skip(!process.env.ONLINE_E2E, "set ONLINE_E2E=1 to run against the live game server");
test.describe.configure({ mode: "serial" });

async function act(page: Page) {
  for (const label of [/^Roll/, /^Move(?!s)/, /^Land on A/, /^Pass/]) {
    const b = page.getByRole("button", { name: label });
    if (await b.isVisible().catch(() => false)) await b.click().catch(() => {});
  }
  const token = page.getByRole("button", { name: /^Token \d/ });
  if (
    await token
      .first()
      .isVisible()
      .catch(() => false)
  )
    await token
      .first()
      .click()
      .catch(() => {});
}

test("two players meet in an online room and play", async ({ browser }, info) => {
  test.skip(info.project.name !== "desktop", "one run is enough against the live server");
  test.setTimeout(180_000);
  const hostCtx = await browser.newContext();
  const guestCtx = await browser.newContext();
  const host = await hostCtx.newPage();
  const guest = await guestCtx.newPage();
  const errors: string[] = [];
  for (const p of [host, guest]) p.on("pageerror", (e) => errors.push(String(e)));

  await host.addInitScript(() =>
    localStorage.setItem(
      "qludo.match.v1",
      JSON.stringify({
        playerCount: 3,
        observationMode: "choice",
        botSpeed: "fast",
        seats: [
          { kind: "human", bot: "hunter", name: "" },
          { kind: "remote", bot: "racer", name: "" },
          { kind: "bot", bot: "gambler", name: "" },
          { kind: "bot", bot: "banker", name: "" },
        ],
      }),
    ),
  );

  // Host: lobby → Host game → Online room → name → Create.
  await host.goto("/");
  await host.getByRole("button", { name: "Host game" }).click();
  await host.getByRole("button", { name: /Online room/ }).click();
  await host.getByRole("textbox", { name: "Your name" }).fill("Ana");
  await host.getByRole("button", { name: "Create room" }).click();
  const code = (await host.getByLabel("Room code").textContent({ timeout: 20_000 }))!.trim();
  expect(code).toMatch(/^[A-HJKMNP-Z2-9]{5}$/);

  // Guest joins with an invite link.
  await guest.goto(`/?room=${code}`);
  await guest.getByRole("textbox", { name: "Your name" }).fill("Ben");
  await guest.getByRole("button", { name: "Join room" }).click();
  await expect(guest.getByText("Waiting for the host to start…")).toBeVisible({ timeout: 20_000 });
  await expect(host.getByText("Ben", { exact: true })).toBeVisible({ timeout: 20_000 });

  await host.getByRole("button", { name: "Start game" }).click();
  await expect(host.getByRole("img", { name: "Quantum Ludo board" })).toBeVisible({ timeout: 20_000 });
  await expect(guest.getByRole("img", { name: "Quantum Ludo board" })).toBeVisible({ timeout: 20_000 });

  // Each sees the other's rolls; the Gambler bot plays on the server between them.
  const benRolls = () => host.getByText(/^Ben rolled a [1-6]$/).count();
  const anaRolls = () => guest.getByText(/^Ana rolled a [1-6]$/).count();
  const botRolls = () => host.getByText(/^The Gambler rolled a [1-6]$/).count();
  // A 6 gives another roll, so wait for the bot's turn too rather than just counting rolls.
  const done = async () => (await benRolls()) >= 2 && (await anaRolls()) >= 2 && (await botRolls()) >= 1;
  for (let i = 0; i < 300 && !(await done()); i++) {
    await act(host);
    await act(guest);
    await host.waitForTimeout(200);
  }
  expect(await benRolls()).toBeGreaterThanOrEqual(2);
  expect(await anaRolls()).toBeGreaterThanOrEqual(2);
  expect(await botRolls()).toBeGreaterThanOrEqual(1);

  // Once both are idle, both boards show the same scores.
  await host.waitForTimeout(3000);
  const pts = (p: Page) =>
    p
      .locator("aside")
      .first()
      .getByText(/^-?\d+ pts$/)
      .allTextContents();
  expect(await pts(guest)).toEqual(await pts(host));

  // A refresh drops the guest back to the lobby, which offers to rejoin the same seat.
  await guest.reload();
  await guest.getByRole("button", { name: "Rejoin room" }).click();
  await expect(guest.getByRole("img", { name: "Quantum Ludo board" })).toBeVisible({ timeout: 20_000 });
  await host.waitForTimeout(2000);
  expect(await pts(guest)).toEqual(await pts(host));
  expect(errors).toEqual([]);
  await hostCtx.close();
  await guestCtx.close();
});
