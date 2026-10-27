import { MAX_MINOR_AMOUNT, MINOR_AMOUNT_PATTERN } from '@talasea/types';
import { ValidationError } from './errors/errors';

/** Integer minor units. The brand stops a raw number from being treated as money unless parseAmount produced it. */
/** Integer minor units. Only parseAmount may create one, so a float cannot enter a debit. */
export type MinorUnits = number & { readonly __brand: 'MinorUnits' };

/** Stays inside Number.MAX_SAFE_INTEGER so $inc cannot round the balance. */
/** Stays inside Number.MAX_SAFE_INTEGER so $inc cannot lose low-order units. */
export const MAX_AMOUNT = MAX_MINOR_AMOUNT;

/** Accepts a positive integer string. Zero, negatives, and decimals are rejected before any wallet is touched. */
export function parseAmount(raw: string): MinorUnits {
  if (!MINOR_AMOUNT_PATTERN.test(raw)) {
    throw new ValidationError('Amount must be a positive integer string in minor units', { amount: raw });
  }
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value > MAX_AMOUNT) {
    throw new ValidationError('Amount exceeds the maximum', { amount: raw, max: String(MAX_AMOUNT) });
  }
  return value as MinorUnits;
}

/** Wire form is a decimal string, matching the string the client sent in. */
export function formatAmount(amount: number): string {
  return String(amount);
}

/** Create is limited to the configured asset list, so a wallet cannot be opened in an unknown currency. */
export function assertSupportedAsset(asset: string, supported: readonly string[]): void {
  if (!supported.includes(asset)) {
    throw new ValidationError('Unsupported asset', { asset });
  }
}
