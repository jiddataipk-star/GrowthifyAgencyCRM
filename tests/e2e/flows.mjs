/**
 * End-to-end check of the main flows against a running app
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
  await page.goto(`${BASE}/transactions`);
  assert.match(page.url(), /\/login\?next=%2Ftransactions/);
});

await step("old /payments bookmarks redirect to Transactions", async () => {
  const response = await fetch(`${BASE}/payments`, { redirect: "manual" });
  assert.equal(response.status, 308);
  assert.match(response.headers.get("location") ?? "", /\/transactions$/);
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

await step("staff only see Projects + Settings and cannot open money pages", async () => {
  page = await (await contextFor(`staff-${stamp}@example.com`, "staff")).newPage();
  for (const path of ["/transactions", "/collections", "/whatsapp"]) {
    await page.goto(`${BASE}${path}`);
    await page.waitForURL(/\/projects/);
  }
  const nav = await page.getByRole("navigation", { name: "Main" }).first().innerText();
  assert.ok(!/Transactions|Collections|WhatsApp/.test(nav) && nav.includes("Projects"), `unexpected nav: ${nav}`);
});

// ── Owner flow ────────────────────────────────────────────────────────────
const owner = await contextFor("owner@growthify.test", "owner");
page = await owner.newPage();
const lead = `E2E Lead ${stamp}`;
const business = `E2E Traders ${stamp}`;
const project = `E2E Website ${stamp}`;
const tid = `TID-${stamp}`;

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

await step("schedule an advance on the project and mark it paid (name, time, TID)", async () => {
  await page.getByRole("button", { name: "Add payment" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel(/For what/).fill("Advance 50%");
  await dialog.getByLabel(/^Amount/).fill("50000");
  await dialog.getByRole("button", { name: "Add", exact: true }).click();
  await page.getByText("Advance 50%").waitFor();
  await page.getByRole("button", { name: "Mark paid" }).first().click();
  const pay = page.getByRole("dialog");
  await pay.getByLabel("Method").selectOption("jazzcash");
  await pay.getByLabel(/^Time/).fill("14:35");
  await pay.getByLabel(/Received from/).fill("Muhammad Imran");
  await pay.getByLabel(/Reference \/ TID/).fill(tid);
  await pay.getByRole("button", { name: "Mark paid" }).click();
  await page.getByText("Paid", { exact: true }).first().waitFor();
});

await step("the payment shows in Transactions with name, time and TID", async () => {
  await page.goto(`${BASE}/transactions?q=${encodeURIComponent(tid)}`);
  await page.getByText(tid).first().waitFor();
  await page.getByText("+PKR 50,000").first().waitFor();
  await page.getByText("Muhammad Imran").first().waitFor();
});

await step("add a payment to collect from a person, then cancel it", async () => {
  const title = `Logo design ${stamp}`;
  await page.goto(`${BASE}/collections`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Add payment to collect" }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("radio", { name: "Someone else" }).click();
  await dialog.getByLabel(/^Name/).fill("Bilal Ahmed");
  await dialog.getByLabel("WhatsApp / phone").fill("0321-7654321");
  await dialog.getByLabel(/For what/).fill(title);
  await dialog.getByLabel(/^Amount/).fill("15000");
  await dialog.getByRole("button", { name: "Add", exact: true }).click();
  await page.getByText(title).first().waitFor();
  await page.getByRole("button", { name: `Actions for ${title}` }).first().click();
  await page.getByRole("menuitem", { name: "Cancel payment" }).click();
  await page.getByLabel("Cancellation reason").fill("Client backed out");
  await page.getByRole("alertdialog").getByRole("button", { name: "Cancel payment" }).click();
  await page.getByText("Payment cancelled").waitFor();
  const { data } = await admin.from("dues").select("status").eq("title", title).single();
  assert.equal(data?.status, "cancelled");
});

await step("add a WhatsApp API client on a 3-month plan with payment received", async () => {
  const wa = `E2E WA Store ${stamp}`;
  await page.goto(`${BASE}/whatsapp`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Add WhatsApp client" }).first().click();
  const dialog = page.getByRole("dialog");
  const newClient = dialog.getByRole("button", { name: "+ New client" });
  if (await newClient.isVisible()) await newClient.click();
  await dialog.getByLabel(/Business name/).fill(wa);
  await dialog.getByLabel("WhatsApp / phone").first().fill("0333-1112233");
  await dialog.getByRole("radio", { name: /3 months/i }).click();
  await dialog.getByLabel(/^Price for/).fill("27000");
  await dialog.getByLabel(/Reference \/ TID/).fill(`WA-${stamp}`);
  await dialog.getByRole("button", { name: "Add WhatsApp client" }).click();
  await page.getByText(wa).filter({ visible: true }).first().waitFor();
  const { data } = await admin.from("transactions").select("amount, category").eq("reference", `WA-${stamp}`).single();
  assert.equal(data?.amount, 2700000);
  assert.equal(data?.category, "subscription");
});

await step("Overview shows this month, profit, top clients and latest transactions", async () => {
  await page.goto(`${BASE}/`);
  for (const label of ["This month", "Collected", "Spent", "Profit", "To collect", "Money in vs money out", "Top paying clients", "Latest transactions", "WhatsApp API"]) {
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
