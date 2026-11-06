// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 Manoj Rollo <fbxmano@gmail.com> (https://github.com/MRJonam91)

import type { RawTransaction, RawTransactionType } from './types.ts';

export interface CsvParseResult {
  detectedFormat: 'binance' | 'kraken' | 'ledger_wallet' | 'generic';
  transactions: RawTransaction[];
}

/**
 * Robust zero-dependency CSV line parser that handles quotes and delimiters.
 */
export function parseCsvRows(content: string): string[][] {
  const lines = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
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
  let format: 'binance' | 'kraken' | 'ledger_wallet' | 'generic' = 'generic';
  if (headers.includes('operation') && headers.includes('coin') && headers.includes('change')) {
    format = 'binance';
  } else if (headers.includes('txid') && headers.includes('time') && headers.includes('balance')) {
    format = 'kraken';
  } else if (headers.includes('txhash') && headers.includes('from') && headers.includes('to')) {
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

  for (const alias of aliases) {
    const cleanAlias = alias.toLowerCase().replace(/[^a-z0-9]/g, '');
    const found = normalizedKeys.find((k) => k.cleaned === cleanAlias || k.cleaned.includes(cleanAlias));
    if (found && row[found.original]) {
      return row[found.original]!;
    }
  }
  return '';
}

function normalizeTypeHint(typeStr: string): RawTransactionType {
  const upper = typeStr.toUpperCase().trim();
  if (['BUY', 'PURCHASE', 'BUY_CRYPTO'].includes(upper)) return 'BUY';
  if (['SELL', 'SALE', 'DISPOSE'].includes(upper)) return 'SELL';
  if (['SWAP', 'TRADE', 'EXCHANGE'].includes(upper)) return 'SWAP';
  if (['DEPOSIT', 'TRANSFER_IN', 'RECEIVE', 'IN'].includes(upper)) return 'DEPOSIT';
  if (['WITHDRAW', 'WITHDRAWAL', 'TRANSFER_OUT', 'SEND', 'OUT'].includes(upper)) return 'WITHDRAWAL';
  if (['FEE', 'COMMISSION', 'NETWORK_FEE'].includes(upper)) return 'FEE';
  return 'UNKNOWN';
}

function parseBinanceRow(row: Record<string, string>, idx: number, fallbackAccount: string): RawTransaction | null {
  const timeStr = getField(row, 'utc_time', 'utctime', 'date_utc', 'dateutc', 'time', 'date');
  const timestamp = new Date(timeStr);
  if (isNaN(timestamp.getTime())) return null;

  const operation = getField(row, 'operation', 'type').toLowerCase();
  const coin = getField(row, 'coin', 'asset').toUpperCase();
  const changeVal = parseFloat(getField(row, 'change', 'amount') || '0');
  const account = getField(row, 'account') || fallbackAccount || 'Binance';

  let normType: RawTransactionType = 'UNKNOWN';
  if (operation.includes('deposit')) normType = 'DEPOSIT';
  else if (operation.includes('withdraw')) normType = 'WITHDRAWAL';
  else if (operation.includes('buy') || (operation.includes('trade') && changeVal > 0)) normType = 'BUY';
  else if (operation.includes('sell') || (operation.includes('trade') && changeVal < 0)) normType = 'SELL';
  else if (operation.includes('fee')) normType = 'FEE';

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
  const timestamp = new Date(timeStr);
  if (isNaN(timestamp.getTime())) return null;

  const type = getField(row, 'type').toLowerCase();
  let asset = getField(row, 'asset', 'coin').toUpperCase();
  if (asset.startsWith('X') && asset.length === 4) asset = asset.substring(1);
  if (asset.startsWith('Z') && asset.length === 4) asset = asset.substring(1);
  if (asset === 'XBT') asset = 'BTC';

  const amount = Math.abs(parseFloat(getField(row, 'amount') || '0'));
  const fee = parseFloat(getField(row, 'fee') || '0');
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

function parseLedgerWalletRow(row: Record<string, string>, idx: number, fallbackAccount: string): RawTransaction | null {
  const timeStr = getField(row, 'date', 'time', 'timestamp');
  const timestamp = new Date(timeStr);
  if (isNaN(timestamp.getTime())) return null;

  const rawType = getField(row, 'type', 'operation').toLowerCase();
  let normType: RawTransactionType = 'UNKNOWN';
  if (rawType.includes('receive') || rawType.includes('in')) normType = 'DEPOSIT';
  else if (rawType.includes('send') || rawType.includes('out')) normType = 'WITHDRAWAL';
  else if (rawType.includes('fee')) normType = 'FEE';

  const asset = getField(row, 'asset', 'coin', 'currency').toUpperCase();
  const amount = Math.abs(parseFloat(getField(row, 'amount') || '0'));
  const fee = parseFloat(getField(row, 'fee') || '0');
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
  const timestamp = new Date(row[timeKey] || '');
  if (isNaN(timestamp.getTime())) return null;

  const typeKey = Object.keys(row).find((k) => k.includes('type') || k.includes('op'));
  const rawType = typeKey ? row[typeKey] || '' : '';
  const normType = normalizeTypeHint(rawType);

  const assetKey = Object.keys(row).find((k) => k.includes('asset') || k.includes('coin') || k.includes('currency') || k.includes('symbol'));
  const asset = assetKey ? (row[assetKey] || '').toUpperCase() : 'UNKNOWN';

  const amountKey = Object.keys(row).find((k) => k.includes('amount') || k.includes('qty') || k.includes('change') || k.includes('value'));
  const amount = amountKey ? Math.abs(parseFloat(row[amountKey] || '0')) : 0;

  const feeKey = Object.keys(row).find((k) => k.includes('fee'));
  const feeAmount = feeKey ? parseFloat(row[feeKey] || '0') : undefined;

  const accountKey = Object.keys(row).find((k) => k.includes('account') || k.includes('source') || k.includes('wallet') || k.includes('exchange'));
  const sourceAccount = (accountKey && row[accountKey]) ? row[accountKey]! : fallbackAccount;

  const hashKey = Object.keys(row).find((k) => k.includes('hash') || k.includes('txid'));
  const txHash = hashKey ? row[hashKey] : undefined;

  return {
    id: `generic-${idx}-${timestamp.getTime()}`,
    sourceAccount,
    timestamp,
    rawType,
    normalizedType: normType,
    asset,
    amount,
    feeAmount: (feeAmount && !isNaN(feeAmount) && feeAmount > 0) ? feeAmount : undefined,
    feeAsset: (feeAmount && feeAmount > 0) ? asset : undefined,
    txHash,
    rawRow: row
  };
}
