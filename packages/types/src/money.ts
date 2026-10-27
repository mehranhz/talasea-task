/** Largest minor-unit amount that still fits in a safe integer. */
export const MAX_MINOR_AMOUNT = 9_000_000_000_000;

/** Positive integer string in minor units, at most 13 digits. */
export const MINOR_AMOUNT_PATTERN = /^[1-9][0-9]{0,12}$/;

/** 24-hex Mongo ObjectId used as a wallet id on the wire. */
export const WALLET_ID_PATTERN = /^[a-fA-F0-9]{24}$/;
