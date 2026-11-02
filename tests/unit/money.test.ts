import { describe, expect, it } from "vitest";
import { compactNumber, formatMoney, toMajor, toMinor } from "@/lib/money";
import { invoiceTotals } from "@/lib/invoices";
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

describe("invoice totals (mirrors the database trigger)", () => {
  it("applies discount before tax and caps the discount at the subtotal", () => {
    const totals = invoiceTotals(
      [
        { qty: 1, unit_price: 5_000_000 },
        { qty: 2, unit_price: 250_000 },
      ],
      100_000,
      16,
    );
    expect(totals).toEqual({ subtotal: 5_500_000, discount: 100_000, tax: 864_000, total: 6_264_000 });
    expect(invoiceTotals([{ qty: 1, unit_price: 100 }], 500, 0).discount).toBe(100);
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
