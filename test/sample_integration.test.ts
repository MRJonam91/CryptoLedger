// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 Manoj Rollo <fbxmano@gmail.com> (https://github.com/MRJonam91)

import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { parseCsvToTransactions } from '../src/core/csv.ts';
import { ReconciliationEngine } from '../src/core/reconciler.ts';
import { formatTerminalReport, formatMarkdownReport } from '../src/core/reporter.ts';

test('Integration: full reconciliation on fictional sample datasets', () => {
  const alphaCsv = fs.readFileSync(path.resolve('data/samples/exchange_alpha.csv'), 'utf-8');
  const walletCsv = fs.readFileSync(path.resolve('data/samples/wallet_ledger.csv'), 'utf-8');

  const { transactions: alphaTxs } = parseCsvToTransactions(alphaCsv, 'ExchangeAlpha');
  const { transactions: walletTxs } = parseCsvToTransactions(walletCsv, 'HardwareWallet');

  const engine = new ReconciliationEngine();
  const report = engine.reconcile([...alphaTxs, ...walletTxs], ['exchange_alpha.csv', 'wallet_ledger.csv']);

  assert.ok(report.totalRawEvents >= 6);
  assert.equal(report.internalTransfersCount, 1, 'Transfer from ExchangeAlpha to HardwareWallet must be reconciled');
  assert.equal(report.economicTransactionsCount, 3, '2 Buys and 1 Sell');
  assert.equal(report.requiresReviewCount, 1, 'The 0.05 BTC transfer to unknown third party must be flagged for review');

  const termReport = formatTerminalReport(report);
  assert.ok(termReport.includes('CryptoLedger — Reconciliation & Provenance Report'));

  const mdReport = formatMarkdownReport(report);
  assert.ok(mdReport.includes('# CryptoLedger — Reconciliation & Provenance Report'));
});
