import { describe, expect, it } from "vitest";
import {
  corr, dateLong, groupDigits, isValidAmount, money, moneyCompact, monthYear, pct, ratio, year,
} from "@/lib/format";

describe("money", () => {
  it("uses Indian grouping for INR like the reference screenshot", () => {
    expect(money("6000900.00", "INR")).toBe("₹60,00,900");
    expect(money("1000000.00", "INR", 2)).toBe("₹10,00,000.00");
    expect(money("0.01", "INR", 2)).toBe("₹0.01");
  });

  it("uses western grouping for USD and keeps the largest allowed amount", () => {
    expect(money("10000", "USD")).toBe("$10,000");
    expect(money("999999999999.99", "USD", 2)).toBe("$999,999,999,999.99");
  });

  it("formats negatives and zero", () => {
    expect(money(-185000, "INR")).toBe("-₹1,85,000");
    expect(money("0", "USD", 2)).toBe("$0.00");
  });
});

describe("moneyCompact", () => {
  it("produces lakh/crore axis ticks for INR", () => {
    expect(moneyCompact(7000000, "INR")).toBe("₹70L");
    expect(moneyCompact(12000000, "INR")).toBe("₹1.2Cr");
    expect(moneyCompact(4500, "INR")).toBe("₹4.5K");
    expect(moneyCompact(0, "INR")).toBe("₹0");
  });

  it("produces K/M/B ticks for USD", () => {
    expect(moneyCompact(70000, "USD")).toBe("$70K");
    expect(moneyCompact(1250000, "USD")).toBe("$1.25M");
    expect(moneyCompact(-2000, "USD")).toBe("-$2K");
  });
});

describe("pct / ratio / corr", () => {
  it("formats decimals as percentages, signing only when asked", () => {
    expect(pct(0.184, { sign: true })).toBe("+18.4%");
    expect(pct(0.184)).toBe("18.4%");
    expect(pct(-0.05, { sign: true })).toBe("-5.0%");
    expect(pct(0, { sign: true })).toBe("0.0%");
    expect(pct(0.04, { digits: 2 })).toBe("4.00%");
  });

  it("formats ratios and correlations", () => {
    expect(ratio(1.5168)).toBe("1.52");
    expect(corr(-0.1049)).toBe("-0.10");
  });
});

describe("dates", () => {
  it("formats ISO dates in UTC", () => {
    expect(monthYear("2021-01-04")).toBe("Jan 2021");
    expect(monthYear("2025-12-31")).toBe("Dec 2025");
    expect(year("2025-12-31")).toBe("2025");
    expect(dateLong("2024-03-05")).toBe("5 Mar 2024");
  });
});

describe("amount input helpers", () => {
  it("validates decimal strings like the API", () => {
    expect(isValidAmount("1000000.00")).toBe(true);
    expect(isValidAmount("0.01")).toBe(true);
    expect(isValidAmount("999999999999.99")).toBe(true);
    for (const bad of ["", "0", "0.00", "-1", "1.001", "1e5", "1,000", "1000000000000", "abc"]) {
      expect(isValidAmount(bad), bad).toBe(false);
    }
  });

  it("groups digits for display without changing the decimals", () => {
    expect(groupDigits("1000000", "INR")).toBe("10,00,000");
    expect(groupDigits("1000000.5", "USD")).toBe("1,000,000.5");
    expect(groupDigits("12a", "INR")).toBe("12a");
  });
});
