/// <reference lib="dom" />
import { expect, test, type Page } from "@playwright/test";

// Two devices on one network, simulated by two isolated browser contexts talking over real WebRTC.
// Chrome normally hides local IPs behind mDNS names, which this sandbox can't resolve; real devices
// on a home Wi-Fi resolve them fine. Using plain local addresses here still exercises the full flow.
test.use({ launchOptions: { args: ["--disable-features=WebRtcHideLocalIpsWithMdns"] } });
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

async function readCode(page: Page, label: string): Promise<string> {
  await page.getByRole("button", { name: "Show text" }).click();
  const box = page.getByRole("textbox", { name: `${label} (text)` });
  await expect(box).toHaveValue(/^QL1\./);
  return box.inputValue();
}

async function pairUp(browser: import("@playwright/test").Browser) {
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
        playerCount: 2,
        observationMode: "coin",
        botSpeed: "fast",
        seats: [
          { kind: "human", bot: "hunter", name: "Paul" },
          { kind: "remote", bot: "racer", name: "" },
          { kind: "bot", bot: "gambler", name: "" },
          { kind: "bot", bot: "banker", name: "" },
        ],
      }),
    ),
  );

  // Host opens a room and creates an invite for the Yellow seat.
  await host.goto("/");
  await host.getByRole("button", { name: "Host Wi-Fi game" }).click();
  await host.getByRole("button", { name: "Invite player" }).click();
  const invite = await readCode(host, "Invite for Yellow");

  // Guest pastes the invite and gets a reply code.
  await guest.goto("/");
  await guest.getByRole("button", { name: "Join a game on this Wi-Fi" }).click();
  await guest.getByRole("textbox", { name: "Your name" }).fill("Sam");
  await guest.getByRole("textbox", { name: "Or paste the invite code" }).fill(invite);
  await guest.getByRole("button", { name: "Use pasted code" }).click();
  const reply = await readCode(guest, "Your reply code");

  // Host reads the reply: the two devices connect directly.
  await host.getByRole("button", { name: "Read their reply" }).click();
  await host.getByRole("textbox", { name: "Their reply code" }).fill(reply);
  await host.getByRole("button", { name: "Use pasted code" }).click();
  await expect(host.getByText("Connected", { exact: true })).toBeVisible({ timeout: 15_000 });
  await expect(guest.getByText("Connected!")).toBeVisible();
  await expect(host.getByText("Yellow · Sam")).toBeVisible();

  await host.getByRole("button", { name: "Start game" }).click();
  await expect(host.getByRole("img", { name: "Quantum Ludo board" })).toBeVisible();
  await expect(guest.getByRole("img", { name: "Quantum Ludo board" })).toBeVisible();
  return { host, guest, hostCtx, guestCtx, errors };
}

test("a guest joins the host's game by code and both can play", async ({ browser }) => {
  const { host, guest, hostCtx, guestCtx, errors } = await pairUp(browser);

  // Play until each side has rolled at least twice; the host sees the guest's rolls and vice versa.
  const guestRolls = () => host.getByText(/^Sam rolled a [1-6]$/).count();
  const hostRolls = () => guest.getByText(/^Paul rolled a [1-6]$/).count();
  for (let i = 0; i < 120 && ((await guestRolls()) < 2 || (await hostRolls()) < 2); i++) {
    await act(host);
    await act(guest);
    await host.waitForTimeout(100);
  }
  expect(await guestRolls()).toBeGreaterThanOrEqual(2);
  expect(await hostRolls()).toBeGreaterThanOrEqual(2);

  // Both screens show the same board state.
  const pointsOn = (p: Page) => p.getByText(/^-?\d+ pts$/).allTextContents();
  await host.waitForTimeout(800);
  expect(await pointsOn(guest)).toEqual(await pointsOn(host));
  expect(errors).toEqual([]);

  await hostCtx.close();
  await guestCtx.close();
});

test("the host can replace a disconnected guest with a bot", async ({ browser }) => {
  const { host, hostCtx, guestCtx, errors } = await pairUp(browser);
  await guestCtx.close(); // the guest walks away

  await expect(host.getByRole("status").filter({ hasText: "Sam is not connected" })).toBeVisible({ timeout: 15_000 });
  await expect(host.getByText("offline", { exact: true }).first()).toBeAttached();

  await host.getByRole("button", { name: /^Players/ }).click();
  await host.getByRole("button", { name: "Use a bot instead" }).click();
  await host.keyboard.press("Escape");

  // The game carries on: the Yellow bot takes its turns.
  for (let i = 0; i < 80 && (await host.getByText(/^The Racer rolled a [1-6]$/).count()) < 1; i++) {
    await act(host);
    await host.waitForTimeout(100);
  }
  expect(await host.getByText(/^The Racer rolled a [1-6]$/).count()).toBeGreaterThanOrEqual(1);
  expect(errors).toEqual([]);
  await hostCtx.close();
});
