import { describe, expect, it } from "vitest";
import { buttonVariants } from "@talasea/ui";
import { ApiError } from "@/lib/api";
import { describeError } from "@/lib/errors";
import { AmountError, formatMinor, toMinorUnits } from "@/lib/money";

const translate = (key: string, values?: Record<string, string>) =>
  values?.id ? `${key}:${values.id}` : key;

describe("money", () => {
  it("parses two decimal places into minor units", () => {
    expect(toMinorUnits("10.50")).toBe("1050");
    expect(toMinorUnits("1")).toBe("100");
  });

  it("rejects extra decimals and zero", () => {
    expect(() => toMinorUnits("1.234")).toThrow(AmountError);
    expect(() => toMinorUnits("0")).toThrow(AmountError);
  });

  it("formats currency for fa and en", () => {
    expect(formatMinor("1050", "USD", "en")).toMatch(/10\.50/);
    expect(formatMinor("1050", "USD", "fa")).toMatch(/۱۰/);
    expect(formatMinor("-1050", "EUR", "en")).toMatch(/10\.50/);
  });
});

describe("describeError", () => {
  it("maps amount, network, and request ids", () => {
    expect(describeError(new AmountError("invalid"), translate)).toBe("amount.invalid");
    expect(describeError(new ApiError(0, "NETWORK", "NETWORK", {}, null), translate)).toBe("network");
    expect(describeError(new ApiError(500, "REQUEST_FAILED", "REQUEST_FAILED", {}, "abc"), translate)).toBe(
      "requestFailed requestId:abc",
    );
    expect(describeError(new Error("nope"), translate)).toBe("unknown");
  });
});

describe("buttonVariants", () => {
  it("keeps a 44px touch target on md and lg", () => {
    expect(buttonVariants({ size: "md" })).toContain("h-11");
    expect(buttonVariants({ size: "lg" })).toContain("h-12");
    expect(buttonVariants({ variant: "primary" })).toContain("btn-primary");
  });
});
