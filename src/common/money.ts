import { ValidationError } from './errors/errors';

export type MinorUnits = number & { readonly __brand: 'MinorUnits' };

export const MAX_AMOUNT = 9_000_000_000_000;

const AMOUNT_PATTERN = /^[1-9][0-9]{0,12}$/;

export function parseAmount(raw: string): MinorUnits {
  if (!AMOUNT_PATTERN.test(raw)) {
    throw new ValidationError('Amount must be a positive integer string in minor units', { amount: raw });
  }
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value > MAX_AMOUNT) {
    throw new ValidationError('Amount exceeds the maximum', { amount: raw, max: String(MAX_AMOUNT) });
  }
  return value as MinorUnits;
}

export function formatAmount(amount: number): string {
  return String(amount);
}

export function assertSupportedAsset(asset: string, supported: readonly string[]): void {
  if (!supported.includes(asset)) {
    throw new ValidationError('Unsupported asset', { asset });
  }
}
