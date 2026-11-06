// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 Manoj Rollo <fbxmano@gmail.com> (https://github.com/MRJonam91)

import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCryptoNumber, roundToDecimals, areAmountsEqual, parseCryptoDate } from '../src/core/math.ts';

test('parseCryptoNumber correctly handles various currency formats', () => {
  assert.equal(parseCryptoNumber('1250.50'), 1250.5);
  assert.equal(parseCryptoNumber('1.250,50'), 1250.5);
  assert.equal(parseCryptoNumber('0,00054321'), 0.00054321);
  assert.equal(parseCryptoNumber('€ 450,20'), 450.2);
  assert.equal(parseCryptoNumber('$1,500.00'), 1500);
  assert.equal(parseCryptoNumber(null), 0);
  assert.equal(parseCryptoNumber(undefined), 0);
  assert.equal(parseCryptoNumber('invalid'), 0);
});

test('roundToDecimals and areAmountsEqual eliminate floating point inaccuracies', () => {
  const sum = 0.1 + 0.2;
  assert.notEqual(sum, 0.3); // raw JS float problem
  assert.equal(roundToDecimals(sum, 8), 0.3);
  assert.ok(areAmountsEqual(sum, 0.3));
});

test('parseCryptoDate handles ISO, European, Unix timestamps, and nulls', () => {
  const iso = parseCryptoDate('2026-01-15T14:30:00Z');
  assert.ok(iso);
  assert.equal(iso.getUTCFullYear(), 2026);
  assert.equal(iso.getUTCMonth(), 0); // January

  const euSlash = parseCryptoDate('15/01/2026 14:30:00');
  assert.ok(euSlash);
  assert.equal(euSlash.getFullYear(), 2026);

  const euDot = parseCryptoDate('15.01.2026');
  assert.ok(euDot);
  assert.equal(euDot.getFullYear(), 2026);

  const unixSeconds = parseCryptoDate('1768487400');
  assert.ok(unixSeconds);
  assert.equal(unixSeconds.getUTCFullYear(), 2026);

  assert.equal(parseCryptoDate(null), null);
  assert.equal(parseCryptoDate(''), null);
  assert.equal(parseCryptoDate('invalid-date-xyz'), null);
});
