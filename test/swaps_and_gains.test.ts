// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 Manoj Rollo <fbxmano@gmail.com> (https://github.com/MRJonam91)

import test from 'node:test';
import assert from 'node:assert/strict';
import { ReconciliationEngine } from '../src/core/reconciler.ts';
import type { RawTransaction } from '../src/core/types.ts';

test('ReconciliationEngine tracks provenance and calculates realized gains across internal moves', () => {
  // Scenario:
  // 1. Buy 1.0 BTC on Exchange Alpha for 30,000 EUR
  // 2. Transfer 1.0 BTC from Exchange Alpha to Ledger Wallet (network fee: 0.001 BTC -> 0.999 BTC arrives)
  // 3. Transfer 0.5 BTC from Ledger Wallet to Exchange Beta (network fee: 0.0005 BTC -> 0.4995 BTC arrives)
  // 4. Sell 0.4995 BTC on Exchange Beta for 25,000 EUR (spot: 50,050 EUR/BTC)
  const transactions: RawTransaction[] = [
    {
      id: 'buy-1',
      sourceAccount: 'ExchangeAlpha',
      timestamp: new Date('2026-01-01T10:00:00Z'),
      rawType: 'Buy',
      normalizedType: 'BUY',
      asset: 'BTC',
      amount: 1.0,
      totalFiat: 30000,
      spotPrice: 30000,
      rawRow: {}
    },
    {
      id: 'w-alpha',
      sourceAccount: 'ExchangeAlpha',
      timestamp: new Date('2026-01-10T12:00:00Z'),
      rawType: 'Withdraw',
      normalizedType: 'WITHDRAWAL',
      asset: 'BTC',
      amount: 1.0,
      rawRow: {}
    },
    {
      id: 'd-ledger',
      sourceAccount: 'LedgerWallet',
      timestamp: new Date('2026-01-10T12:20:00Z'),
      rawType: 'Deposit',
      normalizedType: 'DEPOSIT',
      asset: 'BTC',
      amount: 0.999,
      rawRow: {}
    },
    {
      id: 'w-ledger',
      sourceAccount: 'LedgerWallet',
      timestamp: new Date('2026-02-01T09:00:00Z'),
      rawType: 'Withdraw',
      normalizedType: 'WITHDRAWAL',
      asset: 'BTC',
      amount: 0.5,
      rawRow: {}
    },
    {
      id: 'd-beta',
      sourceAccount: 'ExchangeBeta',
      timestamp: new Date('2026-02-01T09:30:00Z'),
      rawType: 'Deposit',
      normalizedType: 'DEPOSIT',
      asset: 'BTC',
      amount: 0.4995,
      rawRow: {}
    },
    {
      id: 'sell-beta',
      sourceAccount: 'ExchangeBeta',
      timestamp: new Date('2026-02-15T16:00:00Z'),
      rawType: 'Sell',
      normalizedType: 'SELL',
      asset: 'BTC',
      amount: 0.4995,
      totalFiat: 25000,
      spotPrice: 50050.05,
      rawRow: {}
    }
  ];

  const engine = new ReconciliationEngine();
  const report = engine.reconcile(transactions, ['multi-hop-test']);

  assert.equal(report.internalTransfersCount, 2, 'Must match both internal hops');
  assert.equal(report.economicTransactionsCount, 2, 'Must have 1 buy and 1 sell');
  assert.equal(report.requiresReviewCount, 0, 'No unlinked transactions');

  // Verify that the sell on ExchangeBeta inherited the original acquisition cost from ExchangeAlpha!
  const sellMove = report.movements.find((m) => m.classification === 'DISPOSAL');
  assert.ok(sellMove);
  assert.equal(sellMove.provenance.length, 1);
  assert.equal(sellMove.provenance[0]?.originSource, 'ExchangeAlpha', 'Origin must trace back to ExchangeAlpha');

  // Unit cost was 30,000 EUR/BTC -> 0.4995 BTC cost basis is approx 14,985 EUR
  assert.ok(sellMove.costBasisFiat !== undefined);
  assert.equal(Math.round(sellMove.costBasisFiat), 14985);

  // Proceeds: 25,000 EUR -> Gain should be approx +10,015 EUR
  assert.ok(sellMove.gainLossFiat !== undefined);
  assert.equal(Math.round(sellMove.gainLossFiat), 10015);
  assert.ok(report.realizedGainLoss.hasEstimatedGains);
  assert.equal(Math.round(report.realizedGainLoss.totalFiat), 10015);
});

test('ReconciliationEngine processes crypto-to-crypto swaps', () => {
  const transactions: RawTransaction[] = [
    {
      id: 'swap-1',
      sourceAccount: 'Uniswap',
      timestamp: new Date('2026-03-01T10:00:00Z'),
      rawType: 'Swap',
      normalizedType: 'SWAP',
      asset: 'ETH',
      amount: 2.0,
      counterAsset: 'USDC',
      counterAmount: 6000,
      rawRow: {}
    }
  ];

  const engine = new ReconciliationEngine();
  const report = engine.reconcile(transactions);

  assert.equal(report.swapsCount, 1);
  assert.equal(report.balances.byAccount['Uniswap']?.['ETH'], -2);
  assert.equal(report.balances.byAccount['Uniswap']?.['USDC'], 6000);
});
