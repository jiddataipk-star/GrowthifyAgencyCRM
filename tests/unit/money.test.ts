import { describe, expect, it } from "vitest";
import { compactNumber, formatMoney, toMajor, toMinor } from "@/lib/money";
import { dueState, remaining, renewalLabel, renewalState } from "@/lib/collections";
import { toCsv } from "@/lib/csv";

describe("money", () => {
  it("converts major ↔ minor units without float drift", () => {
    expect(toMinor(15000)).toBe(1_500_000);
    expect(toMinor("1,25,000.50")).toBe(12_500_050);
    expect(toMinor(0.1 + 0.2)).toBe(30);
    expect(toMajor(1_500_000)).toBe(15000);
    expect(toMinor("abc")).toBe(0);
  });

  it("formats PKR and USD like the style frame", () => {
    expect(formatMoney(18_500_000, "PKR")).toBe("PKR 185,000");
    expect(formatMoney(-1_840_000, "PKR")).toBe("−PKR 18,400");
    expect(formatMoney(1_500_000, "PKR", { sign: "always" })).toBe("+PKR 15,000");
    expect(formatMoney(25_050, "USD")).toBe("USD 250.50");
    expect(formatMoney(25_000, "USD")).toBe("USD 250");
  });

  it("compacts numbers for chart axes", () => {
    expect(compactNumber(642_500)).toBe("643k");
    expect(compactNumber(1_250_000)).toBe("1.3M");
    expect(compactNumber(950)).toBe("950");
  });
});

describe("collections & prepaid renewals", () => {
  const today = "2026-11-02";
  it("derives a due's state, overdue first", () => {
    expect(dueState({ status: "pending", due_date: "2026-11-01", amount_paid: 500 }, today)).toBe("overdue");
    expect(dueState({ status: "pending", due_date: today, amount_paid: 0 }, today)).toBe("due_today");
    expect(dueState({ status: "pending", due_date: "2026-11-09", amount_paid: 500 }, today)).toBe("partial");
    expect(dueState({ status: "pending", due_date: "2026-11-09", amount_paid: 0 }, today)).toBe("pending");
    expect(dueState({ status: "paid", due_date: "2026-10-01", amount_paid: 1 }, today)).toBe("paid");
    expect(dueState({ status: "cancelled", due_date: "2026-10-01", amount_paid: 0 }, today)).toBe("cancelled");
    expect(remaining({ amount: 1000, amount_paid: 1200 })).toBe(0);
  });

  it("treats the renewal date as the day payment is due", () => {
    expect(renewalState({ status: "active", next_due_date: "2026-12-01" }, today)).toBe("active");
    expect(renewalState({ status: "active", next_due_date: "2026-11-06" }, today)).toBe("expiring");
    expect(renewalState({ status: "active", next_due_date: today }, today)).toBe("expired");
    expect(renewalState({ status: "paused", next_due_date: "2026-10-01" }, today)).toBe("paused");
    expect(renewalLabel("2026-10-21", today)).toBe("Lapsed 12 days ago");
    expect(renewalLabel("2026-11-03", today)).toBe("Renews tomorrow");
  });
});

describe("csv", () => {
  it("escapes quotes/commas and neutralises spreadsheet formulas", () => {
    const csv = toCsv(["a", "b"], [["x,y", '=HYPERLINK("evil")'], [null, 5]]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain('"x,y"');
    expect(csv).toContain(`"'=HYPERLINK(""evil"")"`);
    expect(csv.endsWith(",5")).toBe(true);
  });
});
