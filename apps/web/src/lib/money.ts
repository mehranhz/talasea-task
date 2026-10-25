const DECIMALS = 2;

export class AmountError extends Error {
  readonly code: "invalid" | "decimals" | "positive";

  constructor(code: "invalid" | "decimals" | "positive") {
    super(code);
    this.name = "AmountError";
    this.code = code;
  }
}

const localeTag: Record<string, string> = {
  fa: "fa-IR",
  en: "en-US",
};

export function formatMinor(minor: string, asset: string, locale = "en"): string {
  const negative = minor.startsWith("-");
  const digits = minor.replace(/\D/g, "") || "0";
  const padded = digits.padStart(DECIMALS + 1, "0");
  const whole = padded.slice(0, -DECIMALS).replace(/^0+(?=\d)/, "");
  const frac = padded.slice(-DECIMALS);
  const value = Number(`${negative ? "-" : ""}${whole}.${frac}`);
  const currency = asset === "EUR" ? "EUR" : "USD";
  return new Intl.NumberFormat(localeTag[locale] ?? locale, {
    style: "currency",
    currency,
    minimumFractionDigits: DECIMALS,
    maximumFractionDigits: DECIMALS,
  }).format(value);
}

export function toMinorUnits(input: string): string {
  const trimmed = input.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    throw new AmountError("invalid");
  }
  const [wholeRaw, fracRaw = ""] = trimmed.split(".");
  if (fracRaw.length > DECIMALS) {
    throw new AmountError("decimals");
  }
  const whole = wholeRaw ?? "0";
  const frac = fracRaw.padEnd(DECIMALS, "0");
  const combined = `${whole}${frac}`.replace(/^0+(?=\d)/, "");
  if (!/^[1-9][0-9]{0,12}$/.test(combined)) {
    throw new AmountError("positive");
  }
  return combined;
}

export type AmountHint =
  | { kind: "empty" }
  | { kind: "decimals" }
  | { kind: "minor"; value: string };

export function amountHint(amount: string): AmountHint {
  try {
    return amount.trim() ? { kind: "minor", value: toMinorUnits(amount) } : { kind: "empty" };
  } catch (error) {
    if (error instanceof AmountError && error.code === "decimals") return { kind: "decimals" };
    return { kind: "decimals" };
  }
}

export function newReferenceId(): string {
  return crypto.randomUUID();
}

export const WALLET_ID = /^[a-fA-F0-9]{24}$/;
