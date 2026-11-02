import { describe, expect, it } from "vitest";
import { formatPhone, normalizePhone, whatsappLink } from "@/lib/phone";
import { addBillingMonths, addDays, daysBetween, dueLabel, fiscalYearStart, formatDate, todayPK } from "@/lib/dates";

describe("Pakistani phone numbers", () => {
  it.each([
    ["0321-6312898", "923216312898"],
    ["03216312898", "923216312898"],
    ["3216312898", "923216312898"],
    ["+92 321 6312898", "923216312898"],
    ["0092 321 6312898", "923216312898"],
    ["+44 20 7946 0958", "442079460958"],
  ])("normalises %s", (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });

  it("rejects junk and formats for display", () => {
    expect(normalizePhone("12")).toBeNull();
    expect(normalizePhone("")).toBeNull();
    expect(formatPhone("03216312898")).toBe("+92 321 6312898");
  });

  it("builds wa.me links that only open WhatsApp", () => {
    expect(whatsappLink("0321-6312898", "Salam! Payment reminder 5 Nov")).toBe(
      "https://wa.me/923216312898?text=Salam!%20Payment%20reminder%205%20Nov",
    );
    expect(whatsappLink(null)).toBeNull();
  });
});

describe("business dates (Asia/Karachi)", () => {
  it("computes today in Pakistan, not UTC", () => {
    // 20:30 UTC on 1 Nov is 01:30 on 2 Nov in Karachi.
    expect(todayPK(new Date("2026-11-01T20:30:00Z"))).toBe("2026-11-02");
    expect(todayPK(new Date("2026-11-01T18:59:00Z"))).toBe("2026-11-01");
  });

  it("clamps billing days to month ends (same rule as the database)", () => {
    expect(addBillingMonths("2026-01-31", 1, 31)).toBe("2026-02-28");
    expect(addBillingMonths("2026-02-28", 1, 31)).toBe("2026-03-31");
    expect(addBillingMonths("2028-01-31", 1, 31)).toBe("2028-02-29");
    expect(addBillingMonths("2026-11-15", 3, 15)).toBe("2027-02-15");
  });

  it("handles day arithmetic and labels", () => {
    expect(addDays("2026-12-30", 3)).toBe("2027-01-02");
    expect(daysBetween("2026-11-01", "2026-11-08")).toBe(7);
    expect(dueLabel("2026-11-02", "2026-11-02")).toBe("Due today");
    expect(dueLabel("2026-10-30", "2026-11-02")).toBe("3 days overdue");
    expect(formatDate("2026-11-01")).toBe("1 Nov 2026");
  });

  it("knows Pakistan's July–June fiscal year", () => {
    expect(fiscalYearStart("2026-11-02")).toBe("2026-07-01");
    expect(fiscalYearStart("2027-03-15")).toBe("2026-07-01");
  });
});
