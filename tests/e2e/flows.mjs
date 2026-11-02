/**
 * End-to-end check of the brief's "done when" criteria against a running app
 * (npm run dev) and a LOCAL Supabase stack (npm run db:start).
 *
 *   node --env-file=.env.local tests/e2e/flows.mjs
 *
 * Uses the Playwright that ships with the dev environment (or `npm i -D playwright`).
 */
import { createRequire } from "node:module";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { sessionCookies } from "./session.mjs";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const stamp = Date.now().toString(36);
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const browser = await chromium.launch();
let page;
const results = [];
async function step(name, fn) {
  try {
    await fn();
    results.push(["✔", name]);
  } catch (error) {
    results.push(["✘", name, String(error.message).split("\n")[0]]);
    if (process.env.E2E_SHOTS) await page?.screenshot({ path: `${process.env.E2E_SHOTS}/${name.replace(/\W+/g, "-")}.png` }).catch(() => {});
  }
}

async function contextFor(email, role) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  context.setDefaultTimeout(20000);
  if (email) await context.addCookies(await sessionCookies({ email, role, name: `${role} ${stamp}` }));
  return context;
}

// ── Access ────────────────────────────────────────────────────────────────
await step("signed-out visitors are sent to /login", async () => {
  page = await (await contextFor()).newPage();
  await page.goto(`${BASE}/payments`);
  assert.match(page.url(), /\/login\?next=%2Fpayments/);
});

await step("an email that is not on the team list is blocked", async () => {
  const email = `stranger-${stamp}@example.com`;
  const context = await contextFor(email, "staff");
  await admin.from("team_members").delete().eq("email", email); // take them off the allowlist
  page = await context.newPage();
  await page.goto(`${BASE}/`);
  await page.waitForURL(/\/auth\/denied/);
  await page.getByText("Access not granted").waitFor();
});

await step("staff only see Projects + Settings and cannot open finance pages", async () => {
  page = await (await contextFor(`staff-${stamp}@example.com`, "staff")).newPage();
  await page.goto(`${BASE}/payments`);
  await page.waitForURL(/\/projects/);
  const nav = await page.getByRole("navigation", { name: "Main" }).first().innerText();
  assert.ok(!nav.includes("Payments") && nav.includes("Projects"), `unexpected nav: ${nav}`);
});

// ── Phase 1 + 2 flow as owner ─────────────────────────────────────────────
const owner = await contextFor("owner@growthify.test", "owner");
page = await owner.newPage();
const lead = `E2E Lead ${stamp}`;
const business = `E2E Traders ${stamp}`;
const project = `E2E Website ${stamp}`;

await step("add a lead", async () => {
  await page.goto(`${BASE}/leads`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Add lead" }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel(/^Name/).fill(lead);
  await dialog.getByLabel("Business").fill(business);
  await dialog.getByLabel("Phone / WhatsApp").fill("0300-1234567");
  await dialog.getByLabel("Estimated value").fill("100000");
  await dialog.getByRole("button", { name: "Add lead" }).click();
  await page.getByText(lead).first().waitFor();
});

await step("convert the lead to a client with a project", async () => {
  await page.getByRole("button", { name: `Actions for ${lead}` }).click();
  await page.getByRole("menuitem", { name: "Convert to client" }).click();
  await page.getByLabel("Project title").fill(project);
  await page.getByRole("dialog").getByRole("button", { name: "Convert to client" }).click();
  await page.getByRole("link", { name: "Open client" }).click();
  await page.waitForURL(/\/clients\/[0-9a-f-]{36}/);
  await page.getByRole("heading", { name: business }).waitFor();
});

await step("the project appears on the client page", async () => {
  await page.getByRole("link", { name: "Projects", exact: true }).last().click();
  await page.getByRole("link", { name: project }).click();
  await page.waitForURL(/\/projects\/[0-9a-f-]{36}/);
});

await step("add a milestone and mark it paid (creates income)", async () => {
  await page.getByRole("button", { name: "Add", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Name").fill("Advance 50%");
  await dialog.getByLabel(/Amount/).fill("50000");
  await dialog.getByRole("button", { name: "Save" }).click();
  await page.getByText("Advance 50%").waitFor();
  await page.getByRole("button", { name: "Mark paid" }).click();
  const pay = page.getByRole("dialog");
  await pay.getByLabel("Method").selectOption("jazzcash");
  await pay.getByLabel("Reference / TID").fill(`TID-${stamp}`);
  await pay.getByRole("button", { name: "Mark paid" }).click();
  await page.getByText("Paid", { exact: true }).waitFor();
});

await step("the income shows in Payments with its TID", async () => {
  await page.goto(`${BASE}/payments?q=${encodeURIComponent(`TID-${stamp}`)}`);
  await page.getByText(`TID-${stamp}`).first().waitFor();
  await page.getByText("+PKR 50,000").first().waitFor();
});

await step("Overview renders KPIs and charts", async () => {
  await page.goto(`${BASE}/`);
  for (const label of ["Monthly Recurring", "Revenue This Month", "Outstanding", "Active Clients", "Revenue vs Expenses", "Cash Balance"]) {
    await page.getByText(label, { exact: true }).first().waitFor();
  }
});

await step("global search finds the new client", async () => {
  await page.keyboard.press("Control+k");
  await page.getByPlaceholder(/Type a client/).fill(business.slice(0, 14));
  await page.getByRole("option", { name: new RegExp(business) }).first().waitFor();
});

await browser.close();
for (const [mark, name, error] of results) console.log(`${mark} ${name}${error ? `\n    ${error}` : ""}`);
const failed = results.filter(([mark]) => mark === "✘").length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
