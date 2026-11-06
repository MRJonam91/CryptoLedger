// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 Manoj Rollo <fbxmano@gmail.com> (https://github.com/MRJonam91)

import test from 'node:test';
import assert from 'node:assert/strict';
import { ReconciliationEngine } from '../src/core/reconciler.ts';
import type { RawTransaction } from '../src/core/types.ts';

test('ReconciliationEngine respects asset, account and date filters', () => {
  const transactions: RawTransaction[] = [
    {
      id: 'tx-btc',
      sourceAccount: 'Account1',
      timestamp: new Date('2026-01-10T10:00:00Z'),
      rawType: 'Buy',
      normalizedType: 'BUY',
      asset: 'BTC',
      amount: 1.0,
      rawRow: {}
    },
    {
      id: 'tx-eth',
      sourceAccount: 'Account2',
      timestamp: new Date('2026-02-15T10:00:00Z'),
      rawType: 'Buy',
      normalizedType: 'BUY',
      asset: 'ETH',
      amount: 10.0,
      rawRow: {}
    },
    {
      id: 'tx-sol',
      sourceAccount: 'Account1',
      timestamp: new Date('2026-03-20T10:00:00Z'),
      rawType: 'Buy',
      normalizedType: 'BUY',
      asset: 'SOL',
      amount: 50.0,
      rawRow: {}
    }
  ];

  // Filter by asset BTC
  const engineBtc = new ReconciliationEngine({ assetFilter: 'BTC' });
  const reportBtc = engineBtc.reconcile(transactions);
  assert.equal(reportBtc.totalReconciledMovements, 1);
  assert.equal(reportBtc.movements[0]?.asset, 'BTC');

  // Filter by account Account2
  const engineAcc2 = new ReconciliationEngine({ accountFilter: 'Account2' });
  const reportAcc2 = engineAcc2.reconcile(transactions);
  assert.equal(reportAcc2.totalReconciledMovements, 1);
  assert.equal(reportAcc2.movements[0]?.asset, 'ETH');

  // Filter by date range (February only)
  const engineFeb = new ReconciliationEngine({
    since: new Date('2026-02-01T00:00:00Z'),
    until: new Date('2026-02-28T23:59:59Z')
  });
  const reportFeb = engineFeb.reconcile(transactions);
  assert.equal(reportFeb.totalReconciledMovements, 1);
  assert.equal(reportFeb.movements[0]?.asset, 'ETH');
});
