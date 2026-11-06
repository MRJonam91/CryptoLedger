// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 Manoj Rollo <fbxmano@gmail.com> (https://github.com/MRJonam91)

import type { RawTransaction, RawTransactionType } from './types.ts';
import { parseCryptoNumber, parseCryptoDate } from './math.ts';

export type DetectedFormat = 'binance' | 'kraken' | 'coinbase' | 'bitstamp' | 'ledger_wallet' | 'generic';

export interface CsvParseResult {
  detectedFormat: DetectedFormat;
  transactions: RawTransaction[];
}

/**
 * Robust zero-dependency CSV line parser handling quotes, escaped quotes, delimiters, and BOM.
 */
export function parseCsvRows(content: string): string[][] {
  const cleaned = content.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = cleaned.split('\n');
  const rows: string[][] = [];

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const rawLine = lines[lineIndex];
    if (!rawLine || rawLine.trim() === '') continue;

    const row: string[] = [];
    let insideQuote = false;
    let currentCell = '';
    const delimiter = rawLine.includes(';') && !rawLine.includes(',') ? ';' : ',';

    for (let i = 0; i < rawLine.length; i++) {
      const char = rawLine[i];
      if (char === '"') {
        if (insideQuote && rawLine[i + 1] === '"') {
          currentCell += '"';
          i++; // skip escaped quote
        } else {
          insideQuote = !insideQuote;
        }
      } else if (char === delimiter && !insideQuote) {
        row.push(currentCell.trim());
        currentCell = '';
      } else {
        currentCell += char;
      }
    }
    row.push(currentCell.trim());
    rows.push(row);
  }

  return rows;
}

export function parseCsvToTransactions(csvContent: string, defaultAccountName = 'DefaultAccount'): CsvParseResult {
  const rows = parseCsvRows(csvContent);
  if (rows.length < 2) {
    return { detectedFormat: 'generic', transactions: [] };
  }

  const rawHeaders = rows[0] ?? [];
  const headers = rawHeaders.map((h) => h.toLowerCase().replace(/[^a-z0-9_]/g, ''));
  const dataRows = rows.slice(1);

  // Detect format
  let format: DetectedFormat = 'generic';
  if (headers.includes('operation') && headers.includes('coin') && headers.includes('change')) {
    format = 'binance';
  } else if (headers.includes('txid') && headers.includes('time') && headers.includes('balance')) {
    format = 'kraken';
  } else if (headers.includes('transactiontype') || (headers.includes('quantitytransacted') && headers.includes('asset'))) {
    format = 'coinbase';
  } else if (headers.includes('datetime') && headers.includes('rate') && headers.includes('value')) {
    format = 'bitstamp';
  } else if (headers.includes('txhash') && (headers.includes('from') || headers.includes('to'))) {
    format = 'ledger_wallet';
  }

  const transactions: RawTransaction[] = [];

  dataRows.forEach((row, idx) => {
    if (row.length === 0 || (row.length === 1 && !row[0])) return;
    const rowMap: Record<string, string> = {};
    headers.forEach((h, hIdx) => {
      rowMap[h] = row[hIdx] ?? '';
    });

    let rawTx: RawTransaction | null = null;
    switch (format) {
      case 'binance':
        rawTx = parseBinanceRow(rowMap, idx, defaultAccountName);
        break;
      case 'kraken':
        rawTx = parseKrakenRow(rowMap, idx, defaultAccountName);
        break;
      case 'coinbase':
        rawTx = parseCoinbaseRow(rowMap, idx, defaultAccountName);
        break;
      case 'bitstamp':
        rawTx = parseBitstampRow(rowMap, idx, defaultAccountName);
        break;
      case 'ledger_wallet':
        rawTx = parseLedgerWalletRow(rowMap, idx, defaultAccountName);
        break;
      case 'generic':
      default:
        rawTx = parseGenericRow(rowMap, idx, defaultAccountName);
        break;
    }

    if (rawTx) {
      transactions.push(rawTx);
    }
  });

  return { detectedFormat: format, transactions };
}

function getField(row: Record<string, string>, ...aliases: string[]): string {
  const normalizedKeys = Object.keys(row).map((k) => ({
    original: k,
    cleaned: k.toLowerCase().replace(/[^a-z0-9]/g, '')
  }));

  // First pass: exact matches
  for (const alias of aliases) {
    const cleanAlias = alias.toLowerCase().replace(/[^a-z0-9]/g, '');
    const found = normalizedKeys.find((k) => k.cleaned === cleanAlias);
    if (found && row[found.original] !== undefined && row[found.original] !== '') {
      return row[found.original]!;
    }
  }

  // Second pass: prefix or suffix matches
  for (const alias of aliases) {
    const cleanAlias = alias.toLowerCase().replace(/[^a-z0-9]/g, '');
    const found = normalizedKeys.find((k) => k.cleaned.startsWith(cleanAlias) || k.cleaned.endsWith(cleanAlias));
    if (found && row[found.original] !== undefined && row[found.original] !== '') {
      return row[found.original]!;
    }
  }
  return '';
}

function normalizeTypeHint(typeStr: string): RawTransactionType {
  const upper = typeStr.toUpperCase().trim();
  if (['BUY', 'PURCHASE', 'BUY_CRYPTO'].includes(upper)) return 'BUY';
  if (['SELL', 'SALE', 'DISPOSE'].includes(upper)) return 'SELL';
  if (['SWAP', 'TRADE', 'CONVERT', 'EXCHANGE'].includes(upper)) return 'SWAP';
  if (['DEPOSIT', 'TRANSFER_IN', 'RECEIVE', 'IN'].includes(upper)) return 'DEPOSIT';
  if (['WITHDRAW', 'WITHDRAWAL', 'TRANSFER_OUT', 'SEND', 'OUT'].includes(upper)) return 'WITHDRAWAL';
  if (['FEE', 'COMMISSION', 'NETWORK_FEE'].includes(upper)) return 'FEE';
  return 'UNKNOWN';
}

function parseBinanceRow(row: Record<string, string>, idx: number, fallbackAccount: string): RawTransaction | null {
  const timeStr = getField(row, 'utc_time', 'utctime', 'date_utc', 'dateutc', 'time', 'date');
  const timestamp = parseCryptoDate(timeStr);
  if (!timestamp) return null;

  const operation = getField(row, 'operation', 'type').toLowerCase();
  const coin = getField(row, 'coin', 'asset').toUpperCase();
  const changeVal = parseCryptoNumber(getField(row, 'change', 'amount'));
  const account = getField(row, 'account') || fallbackAccount || 'Binance';

  let normType: RawTransactionType = 'UNKNOWN';
  if (operation.includes('deposit')) normType = 'DEPOSIT';
  else if (operation.includes('withdraw')) normType = 'WITHDRAWAL';
  else if (operation.includes('buy') || (operation.includes('trade') && changeVal > 0)) normType = 'BUY';
  else if (operation.includes('sell') || (operation.includes('trade') && changeVal < 0)) normType = 'SELL';
  else if (operation.includes('fee')) normType = 'FEE';
  else if (operation.includes('swap') || operation.includes('convert')) normType = 'SWAP';

  return {
    id: `binance-${idx}-${timestamp.getTime()}`,
    sourceAccount: account,
    timestamp,
    rawType: operation || 'Operation',
    normalizedType: normType,
    asset: coin,
    amount: Math.abs(changeVal),
    rawRow: row,
    notes: getField(row, 'remark', 'notes')
  };
}

function parseKrakenRow(row: Record<string, string>, idx: number, fallbackAccount: string): RawTransaction | null {
  const timeStr = getField(row, 'time', 'date');
  const timestamp = parseCryptoDate(timeStr);
  if (!timestamp) return null;

  const type = getField(row, 'type').toLowerCase();
  let asset = getField(row, 'asset', 'coin').toUpperCase();
  if (asset.startsWith('X') && asset.length === 4) asset = asset.substring(1);
  if (asset.startsWith('Z') && asset.length === 4) asset = asset.substring(1);
  if (asset === 'XBT') asset = 'BTC';

  const amount = Math.abs(parseCryptoNumber(getField(row, 'amount')));
  const fee = parseCryptoNumber(getField(row, 'fee'));
  const account = fallbackAccount || 'Kraken';

  let normType: RawTransactionType = 'UNKNOWN';
  if (type.includes('deposit')) normType = 'DEPOSIT';
  else if (type.includes('withdrawal')) normType = 'WITHDRAWAL';
  else if (type.includes('trade') || type.includes('buy')) normType = 'BUY';
  else if (type.includes('sell')) normType = 'SELL';

  return {
    id: getField(row, 'txid') || `kraken-${idx}-${timestamp.getTime()}`,
    sourceAccount: account,
    timestamp,
    rawType: type,
    normalizedType: normType,
    asset,
    amount,
    feeAsset: fee > 0 ? asset : undefined,
    feeAmount: fee > 0 ? fee : undefined,
    rawRow: row
  };
}

function parseCoinbaseRow(row: Record<string, string>, idx: number, fallbackAccount: string): RawTransaction | null {
  const timeStr = getField(row, 'timestamp', 'time', 'date');
  const timestamp = parseCryptoDate(timeStr);
  if (!timestamp) return null;

  const type = getField(row, 'transactiontype', 'type').toLowerCase();
  const asset = getField(row, 'asset', 'currency').toUpperCase();
  const amount = Math.abs(parseCryptoNumber(getField(row, 'quantitytransacted', 'amount')));
  const spotPrice = parseCryptoNumber(getField(row, 'spotpriceattransaction', 'price'));
  const totalFiat = parseCryptoNumber(getField(row, 'totalinclusiveoffees', 'total', 'subtotal'));
  const fee = parseCryptoNumber(getField(row, 'fees', 'fee'));
  const account = fallbackAccount || 'Coinbase';

  let normType: RawTransactionType = 'UNKNOWN';
  if (type.includes('buy')) normType = 'BUY';
  else if (type.includes('sell')) normType = 'SELL';
  else if (type.includes('convert') || type.includes('swap')) normType = 'SWAP';
  else if (type.includes('send') || type.includes('withdrawal')) normType = 'WITHDRAWAL';
  else if (type.includes('receive') || type.includes('deposit')) normType = 'DEPOSIT';

  return {
    id: `coinbase-${idx}-${timestamp.getTime()}`,
    sourceAccount: account,
    timestamp,
    rawType: type,
    normalizedType: normType,
    asset,
    amount,
    spotPrice: spotPrice > 0 ? spotPrice : undefined,
    totalFiat: totalFiat > 0 ? totalFiat : undefined,
    fiatCurrency: 'EUR',
    feeAmount: fee > 0 ? fee : undefined,
    feeAsset: fee > 0 ? 'EUR' : undefined,
    notes: getField(row, 'notes'),
    rawRow: row
  };
}

function parseBitstampRow(row: Record<string, string>, idx: number, fallbackAccount: string): RawTransaction | null {
  const timeStr = getField(row, 'datetime', 'time', 'date');
  const timestamp = parseCryptoDate(timeStr);
  if (!timestamp) return null;

  const type = getField(row, 'type').toLowerCase();
  const account = getField(row, 'account') || fallbackAccount || 'Bitstamp';
  const amount = Math.abs(parseCryptoNumber(getField(row, 'amount')));
  const rate = parseCryptoNumber(getField(row, 'rate'));
  const value = parseCryptoNumber(getField(row, 'value'));
  const fee = parseCryptoNumber(getField(row, 'fee'));

  const asset = getField(row, 'asset') || 'BTC';

  let normType: RawTransactionType = 'UNKNOWN';
  if (type.includes('buy')) normType = 'BUY';
  else if (type.includes('sell')) normType = 'SELL';
  else if (type.includes('deposit')) normType = 'DEPOSIT';
  else if (type.includes('withdrawal')) normType = 'WITHDRAWAL';

  return {
    id: `bitstamp-${idx}-${timestamp.getTime()}`,
    sourceAccount: account,
    timestamp,
    rawType: type,
    normalizedType: normType,
    asset: asset.toUpperCase(),
    amount,
    spotPrice: rate > 0 ? rate : undefined,
    totalFiat: value > 0 ? value : undefined,
    fiatCurrency: 'EUR',
    feeAmount: fee > 0 ? fee : undefined,
    rawRow: row
  };
}

function parseLedgerWalletRow(row: Record<string, string>, idx: number, fallbackAccount: string): RawTransaction | null {
  const timeStr = getField(row, 'date', 'time', 'timestamp');
  const timestamp = parseCryptoDate(timeStr);
  if (!timestamp) return null;

  const rawType = getField(row, 'type', 'operation').toLowerCase();
  let normType: RawTransactionType = 'UNKNOWN';
  if (rawType.includes('receive') || rawType.includes('in')) normType = 'DEPOSIT';
  else if (rawType.includes('send') || rawType.includes('out')) normType = 'WITHDRAWAL';
  else if (rawType.includes('fee')) normType = 'FEE';

  const asset = getField(row, 'asset', 'coin', 'currency').toUpperCase();
  const amount = Math.abs(parseCryptoNumber(getField(row, 'amount')));
  const fee = parseCryptoNumber(getField(row, 'fee'));
  const account = fallbackAccount || 'SelfCustodyWallet';

  return {
    id: getField(row, 'txhash') || `ledger-${idx}-${timestamp.getTime()}`,
    sourceAccount: account,
    timestamp,
    rawType: rawType || 'Transfer',
    normalizedType: normType,
    asset,
    amount,
    feeAsset: fee > 0 ? asset : undefined,
    feeAmount: fee > 0 ? fee : undefined,
    txHash: getField(row, 'txhash') || undefined,
    address: getField(row, 'to', 'from') || undefined,
    rawRow: row
  };
}

function parseGenericRow(row: Record<string, string>, idx: number, fallbackAccount: string): RawTransaction | null {
  const timeKey = Object.keys(row).find((k) => k.includes('time') || k.includes('date'));
  if (!timeKey) return null;
  const timestamp = parseCryptoDate(row[timeKey]);
  if (!timestamp) return null;

  const typeKey = Object.keys(row).find((k) => k.includes('type') || k.includes('op'));
  const rawType = typeKey ? row[typeKey] || '' : '';
  const normType = normalizeTypeHint(rawType);

  const assetKey = Object.keys(row).find((k) => k.includes('asset') || k.includes('coin') || k.includes('currency') || k.includes('symbol'));
  const asset = assetKey ? (row[assetKey] || '').toUpperCase() : 'UNKNOWN';

  const amountKey = Object.keys(row).find((k) => k.includes('amount') || k.includes('qty') || k.includes('change') || k.includes('value'));
  const amount = amountKey ? Math.abs(parseCryptoNumber(row[amountKey])) : 0;

  const feeKey = Object.keys(row).find((k) => k.includes('fee'));
  const feeAmount = feeKey ? parseCryptoNumber(row[feeKey]) : undefined;

  const accountKey = Object.keys(row).find((k) => k.includes('account') || k.includes('source') || k.includes('wallet') || k.includes('exchange'));
  const sourceAccount = (accountKey && row[accountKey]) ? row[accountKey]! : fallbackAccount;

  const hashKey = Object.keys(row).find((k) => k.includes('hash') || k.includes('txid'));
  const txHash = hashKey ? row[hashKey] : undefined;

  const counterAssetKey = Object.keys(row).find((k) => k.includes('counterasset') || k.includes('targetcoin') || k.includes('to_asset'));
  const counterAmountKey = Object.keys(row).find((k) => k.includes('counteramount') || k.includes('targetamount') || k.includes('to_amount'));

  const spotPrice = parseCryptoNumber(getField(row, 'price', 'rate', 'spotprice'));
  const totalFiat = parseCryptoNumber(getField(row, 'fiat', 'eur', 'usd', 'total'));

  return {
    id: `generic-${idx}-${timestamp.getTime()}`,
    sourceAccount,
    timestamp,
    rawType,
    normalizedType: normType,
    asset,
    amount,
    counterAsset: counterAssetKey && row[counterAssetKey] ? row[counterAssetKey]!.toUpperCase() : undefined,
    counterAmount: counterAmountKey && row[counterAmountKey] ? Math.abs(parseCryptoNumber(row[counterAmountKey])) : undefined,
    spotPrice: spotPrice > 0 ? spotPrice : undefined,
    totalFiat: totalFiat > 0 ? totalFiat : undefined,
    feeAmount: (feeAmount && feeAmount > 0) ? feeAmount : undefined,
    feeAsset: (feeAmount && feeAmount > 0) ? asset : undefined,
    txHash,
    rawRow: row
  };
}
