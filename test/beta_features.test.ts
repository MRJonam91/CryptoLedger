// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 Manoj Rollo <fbxmano@gmail.com> (https://github.com/MRJonam91)

import test from 'node:test';
import assert from 'node:assert/strict';
import { ReconciliationEngine } from '../src/core/reconciler.ts';
import { exportToReconciledCsv } from '../src/export/csv_export.ts';
import { exportToHtmlReport } from '../src/export/html_export.ts';
import type { RawTransaction } from '../src/core/types.ts';

test('ReconciliationEngine detects negative balances, duplicate transactions, and high fees', () => {
  const transactions: RawTransaction[] = [
    {
      id: 'tx-dup-1',
      sourceAccount: 'Binance',
      timestamp: new Date('2026-01-01T10:00:00Z'),
      rawType: 'Buy',
      normalizedType: 'BUY',
      asset: 'BTC',
      amount: 1.0,
      txHash: '0xabc123456789deadbeef',
      rawRow: {}
    },
    {
      id: 'tx-dup-2',
      sourceAccount: 'Binance',
      timestamp: new Date('2026-01-01T10:00:00Z'),
      rawType: 'Buy',
      normalizedType: 'BUY',
      asset: 'BTC',
      amount: 1.0,
      txHash: '0xabc123456789deadbeef', // DUPLICATE HASH
      rawRow: {}
    },
    {
      id: 'tx-neg',
      sourceAccount: 'LedgerEmpty',
      timestamp: new Date('2026-01-02T12:00:00Z'),
      rawType: 'Withdraw',
      normalizedType: 'WITHDRAWAL',
      asset: 'ETH',
      amount: 5.0, // Spends 5 ETH with 0 prior balance
      rawRow: {}
    },
    {
      id: 'tx-high-fee',
      sourceAccount: 'Binance',
      timestamp: new Date('2026-01-03T15:00:00Z'),
      rawType: 'Withdraw',
      normalizedType: 'WITHDRAWAL',
      asset: 'SOL',
      amount: 0.1,
      feeAsset: 'SOL',
      feeAmount: 0.08, // 80% fee
      rawRow: {}
    }
  ];

  const engine = new ReconciliationEngine();
  const report = engine.reconcile(transactions);

  assert.ok(report.anomalies.length >= 3);

  const dupAnomaly = report.anomalies.find((a) => a.type === 'DUPLICATE_TX');
  assert.ok(dupAnomaly, 'Must flag duplicate tx hash');

  const negAnomaly = report.anomalies.find((a) => a.type === 'NEGATIVE_BALANCE');
  assert.ok(negAnomaly, 'Must flag negative balance on LedgerEmpty');
  assert.equal(negAnomaly.account, 'LedgerEmpty');

  const feeAnomaly = report.anomalies.find((a) => a.type === 'HIGH_FEE_RATIO');
  assert.ok(feeAnomaly, 'Must flag high fee ratio');
});

test('ReconciliationEngine HIFO method consumes highest cost lot first', () => {
  // Buy Lot 1: 1.0 BTC @ 20,000 EUR
  // Buy Lot 2: 1.0 BTC @ 60,000 EUR
  // Sell: 1.0 BTC @ 50,000 EUR
  // Under FIFO: consumes Lot 1 (cost 20,000) -> gain = 30,000 EUR
  // Under HIFO: consumes Lot 2 (cost 60,000) -> gain = -10,000 EUR (loss)
  const transactions: RawTransaction[] = [
    {
      id: 'buy-low',
      sourceAccount: 'Exchange1',
      timestamp: new Date('2026-01-01T10:00:00Z'),
      rawType: 'Buy',
      normalizedType: 'BUY',
      asset: 'BTC',
      amount: 1.0,
      totalFiat: 20000,
      spotPrice: 20000,
      rawRow: {}
    },
    {
      id: 'buy-high',
      sourceAccount: 'Exchange1',
      timestamp: new Date('2026-01-05T10:00:00Z'),
      rawType: 'Buy',
      normalizedType: 'BUY',
      asset: 'BTC',
      amount: 1.0,
      totalFiat: 60000,
      spotPrice: 60000,
      rawRow: {}
    },
    {
      id: 'sell-1',
      sourceAccount: 'Exchange1',
      timestamp: new Date('2026-01-10T10:00:00Z'),
      rawType: 'Sell',
      normalizedType: 'SELL',
      asset: 'BTC',
      amount: 1.0,
      totalFiat: 50000,
      spotPrice: 50000,
      rawRow: {}
    }
  ];

  // Test FIFO
  const engineFifo = new ReconciliationEngine({ inventoryMethod: 'FIFO' });
  const reportFifo = engineFifo.reconcile(transactions);
  const sellFifo = reportFifo.movements.find((m) => m.classification === 'DISPOSAL')!;
  assert.equal(sellFifo.costBasisFiat, 20000);
  assert.equal(sellFifo.gainLossFiat, 30000);

  // Test HIFO
  const engineHifo = new ReconciliationEngine({ inventoryMethod: 'HIFO' });
  const reportHifo = engineHifo.reconcile(transactions);
  const sellHifo = reportHifo.movements.find((m) => m.classification === 'DISPOSAL')!;
  assert.equal(sellHifo.costBasisFiat, 60000);
  assert.equal(sellHifo.gainLossFiat, -10000);
});

test('exportToReconciledCsv and exportToHtmlReport produce valid formatted ledger files', () => {
  const transactions: RawTransaction[] = [
    {
      id: 'buy-btc',
      sourceAccount: 'Kraken',
      timestamp: new Date('2026-01-01T10:00:00Z'),
      rawType: 'Buy',
      normalizedType: 'BUY',
      asset: 'BTC',
      amount: 0.5,
      totalFiat: 25000,
      spotPrice: 50000,
      rawRow: {}
    }
  ];

  const engine = new ReconciliationEngine();
  const report = engine.reconcile(transactions, ['kraken.csv']);

  const csv = exportToReconciledCsv(report);
  assert.ok(csv.startsWith('Timestamp,Classification,Is_Internal_Custody'));
  assert.ok(csv.includes('ACQUISITION'));
  assert.ok(csv.includes('Kraken'));

  const html = exportToHtmlReport(report);
  assert.ok(html.includes('<!DOCTYPE html>'));
  assert.ok(html.includes('CryptoLedger — Reconciliation & Provenance Report'));
  assert.ok(html.includes('0.5'));
  assert.ok(html.includes('Kraken'));
});
