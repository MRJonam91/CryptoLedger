// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 Manoj Rollo <fbxmano@gmail.com> (https://github.com/MRJonam91)

export const SATOSHI_DECIMALS = 8;
export const EPSILON = 1e-9;

/**
 * Parses numeric strings in both international (1,234.56) and european (1.234,56 or 0,5) formats,
 * stripping currency signs ($ € £) and whitespace.
 */
export function parseCryptoNumber(val: string | number | undefined | null): number {
  if (val === undefined || val === null) return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;

  let str = val.trim().replace(/[$€£\s]/g, '');
  if (!str) return 0;

  // Handle european formatting: "1.250,50" -> "1250.50" or "0,25" -> "0.25"
  if (str.includes(',') && str.includes('.')) {
    if (str.lastIndexOf(',') > str.lastIndexOf('.')) {
      str = str.replace(/\./g, '').replace(',', '.');
    } else {
      str = str.replace(/,/g, '');
    }
  } else if (str.includes(',')) {
    str = str.replace(',', '.');
  }

  const parsed = parseFloat(str);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Rounds a number to a fixed decimal precision while avoiding -0 and IEEE-754 creep.
 */
export function roundToDecimals(num: number, decimals: number = SATOSHI_DECIMALS): number {
  if (Math.abs(num) < EPSILON) return 0;
  const factor = 10 ** decimals;
  const rounded = Math.round((num + Number.EPSILON) * factor) / factor;
  return Object.is(rounded, -0) ? 0 : rounded;
}

/**
 * Compares two decimal quantities within a strict epsilon.
 */
export function areAmountsEqual(a: number, b: number, tolerance: number = EPSILON): boolean {
  return Math.abs(a - b) <= tolerance;
}
