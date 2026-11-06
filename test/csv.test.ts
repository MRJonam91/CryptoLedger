// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 Manoj Rollo <fbxmano@gmail.com> (https://github.com/MRJonam91)

import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCsvRows, parseCsvToTransactions } from '../src/core/csv.ts';

test('parseCsvRows parses comma and semicolon separated rows with quotes', () => {
  const input = `Date,Type,Notes\n2026-01-01,Buy,"Bought BTC, with EUR"\n2026-01-02,Sell,Plain`;
  const rows = parseCsvRows(input);
  assert.equal(rows.length, 3);
  assert.deepEqual(rows[0], ['Date', 'Type', 'Notes']);
  assert.equal(rows[1]?.[2], 'Bought BTC, with EUR');
});

test('parseCsvToTransactions autodetects Binance and Ledger formats', () => {
  const binanceCsv = `UTC_Time,Account,Operation,Coin,Change,Remark\n2026-01-10 10:00:00,Binance,Buy,BTC,0.25,Bought BTC`;
  const resultBinance = parseCsvToTransactions(binanceCsv, 'Binance');
  assert.equal(resultBinance.detectedFormat, 'binance');
  assert.equal(resultBinance.transactions.length, 1);
  assert.equal(resultBinance.transactions[0]?.normalizedType, 'BUY');
  assert.equal(resultBinance.transactions[0]?.amount, 0.25);
  assert.equal(resultBinance.transactions[0]?.asset, 'BTC');

  const ledgerCsv = `Date,Type,Asset,Amount,Fee,TxHash,From,To\n2026-01-15 15:00:00,Receive,BTC,0.1995,0.0005,0xabc,FromEx,ToWall`;
  const resultLedger = parseCsvToTransactions(ledgerCsv, 'Ledger');
  assert.equal(resultLedger.detectedFormat, 'ledger_wallet');
  assert.equal(resultLedger.transactions.length, 1);
  assert.equal(resultLedger.transactions[0]?.normalizedType, 'DEPOSIT');
  assert.equal(resultLedger.transactions[0]?.amount, 0.1995);
});
