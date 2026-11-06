// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 Manoj Rollo <fbxmano@gmail.com> (https://github.com/MRJonam91)

import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCsvToTransactions } from '../src/core/csv.ts';

test('parseCsvToTransactions parses Coinbase format with spot price and fiat totals', () => {
  const coinbaseCsv = `Timestamp,Transaction Type,Asset,Quantity Transacted,Spot Price at Transaction,Subtotal,Total (inclusive of fees),Fees,Notes
2026-02-10T12:00:00Z,Buy,BTC,0.1,50000.00,5000.00,5010.00,10.00,Bought on Coinbase Pro
2026-02-15T15:30:00Z,Convert,BTC,0.05,52000.00,2600.00,2600.00,0.00,Converted BTC to ETH`;

  const result = parseCsvToTransactions(coinbaseCsv, 'CoinbaseAccount');
  assert.equal(result.detectedFormat, 'coinbase');
  assert.equal(result.transactions.length, 2);

  const buyTx = result.transactions[0]!;
  assert.equal(buyTx.normalizedType, 'BUY');
  assert.equal(buyTx.asset, 'BTC');
  assert.equal(buyTx.amount, 0.1);
  assert.equal(buyTx.spotPrice, 50000);
  assert.equal(buyTx.totalFiat, 5010);
  assert.equal(buyTx.feeAmount, 10);

  const swapTx = result.transactions[1]!;
  assert.equal(swapTx.normalizedType, 'SWAP');
  assert.equal(swapTx.amount, 0.05);
});

test('parseCsvToTransactions parses Bitstamp format with european rates', () => {
  const bitstampCsv = `Type,Datetime,Account,Amount,Value,Rate,Fee
Buy,2026-03-01 14:00:00,BitstampMain,"0,50000000","25.000,00 €","50.000,00 €","15,00 €"`;

  const result = parseCsvToTransactions(bitstampCsv, 'Bitstamp');
  assert.equal(result.detectedFormat, 'bitstamp');
  assert.equal(result.transactions.length, 1);

  const tx = result.transactions[0]!;
  assert.equal(tx.normalizedType, 'BUY');
  assert.equal(tx.amount, 0.5);
  assert.equal(tx.totalFiat, 25000);
  assert.equal(tx.spotPrice, 50000);
  assert.equal(tx.feeAmount, 15);
});
