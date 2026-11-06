// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 Manoj Rollo <fbxmano@gmail.com> (https://github.com/MRJonam91)

import test from 'node:test';
import assert from 'node:assert/strict';
import { ReconciliationEngine } from '../src/core/reconciler.ts';
import type { RawTransaction } from '../src/core/types.ts';

test('ReconciliationEngine distinguishes internal custody transfers from economic trades', () => {
  const transactions: RawTransaction[] = [
    {
      id: 'tx-1',
      sourceAccount: 'ExchangeA',
      timestamp: new Date('2026-01-10T10:00:00Z'),
      rawType: 'Buy',
      normalizedType: 'BUY',
      asset: 'BTC',
      amount: 1.0,
      rawRow: {}
    },
    {
      id: 'tx-2',
      sourceAccount: 'ExchangeA',
      timestamp: new Date('2026-01-12T12:00:00Z'),
      rawType: 'Withdraw',
      normalizedType: 'WITHDRAWAL',
      asset: 'BTC',
      amount: 0.5,
      rawRow: {}
    },
    {
      id: 'tx-3',
      sourceAccount: 'HardwareWallet',
      timestamp: new Date('2026-01-12T12:30:00Z'),
      rawType: 'Receive',
      normalizedType: 'DEPOSIT',
      asset: 'BTC',
      amount: 0.4995, // after 0.0005 network fee
      rawRow: {}
    },
    {
      id: 'tx-4',
      sourceAccount: 'ExchangeA',
      timestamp: new Date('2026-01-15T09:00:00Z'),
      rawType: 'Sell',
      normalizedType: 'SELL',
      asset: 'BTC',
      amount: 0.2,
      rawRow: {}
    }
  ];

  const engine = new ReconciliationEngine({ timeWindowMinutes: 120 });
  const report = engine.reconcile(transactions, ['test-source']);

  assert.equal(report.internalTransfersCount, 1, 'Should match exactly 1 internal transfer');
  assert.equal(report.economicTransactionsCount, 2, 'Should have 2 economic transactions (1 buy, 1 sell)');
  assert.equal(report.requiresReviewCount, 0, 'No unresolved transfers should remain in this case');

  const internalMove = report.movements.find((m) => m.isInternal);
  assert.ok(internalMove);
  assert.equal(internalMove.fromAccount, 'ExchangeA');
  assert.equal(internalMove.toAccount, 'HardwareWallet');
  assert.equal(internalMove.classification, 'INTERNAL_MOVE');
  assert.equal(internalMove.amount, 0.4995);

  // Check balances
  // ExchangeA: bought 1.0, transferred out 0.5 (0.4995 + fee), sold 0.2 -> remaining: 0.3
  // HardwareWallet: received 0.4995 -> remaining: 0.4995
  const exABalance = report.balances.byAccount['ExchangeA']?.['BTC'];
  const hwBalance = report.balances.byAccount['HardwareWallet']?.['BTC'];
  assert.ok(exABalance !== undefined && Math.abs(exABalance - 0.3) < 0.0001);
  assert.ok(hwBalance !== undefined && Math.abs(hwBalance - 0.4995) < 0.0001);
});

test('ReconciliationEngine flags unmatched withdrawals and preserves provenance chain', () => {
  const transactions: RawTransaction[] = [
    {
      id: 'buy-1',
      sourceAccount: 'ExchangeA',
      timestamp: new Date('2026-01-01T10:00:00Z'),
      rawType: 'Buy',
      normalizedType: 'BUY',
      asset: 'ETH',
      amount: 5.0,
      rawRow: {}
    },
    {
      id: 'send-unknown',
      sourceAccount: 'ExchangeA',
      timestamp: new Date('2026-01-05T15:00:00Z'),
      rawType: 'Withdraw',
      normalizedType: 'WITHDRAWAL',
      asset: 'ETH',
      amount: 1.5,
      rawRow: {}
    }
  ];

  const engine = new ReconciliationEngine();
  const report = engine.reconcile(transactions);

  assert.equal(report.requiresReviewCount, 1);
  assert.equal(report.unresolvedIssues[0]?.asset, 'ETH');
  assert.ok(report.unresolvedIssues[0]?.reason.includes('Withdrawal of 1.5 ETH'));
});
