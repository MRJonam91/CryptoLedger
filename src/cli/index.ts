#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 Manoj Rollo <fbxmano@gmail.com> (https://github.com/MRJonam91)

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as process from 'node:process';
import { parseCsvToTransactions } from '../core/csv.ts';
import { ReconciliationEngine } from '../core/reconciler.ts';
import { formatTerminalReport, formatMarkdownReport } from '../core/reporter.ts';
import { exportToReconciledCsv } from '../export/csv_export.ts';
import { exportToHtmlReport } from '../export/html_export.ts';
import type { RawTransaction } from '../core/types.ts';

const SPONSOR_LINE = '💡 Support open source crypto tooling: github.com/sponsors/MRJonam91 | ko-fi.com/mrjonam | paypal.me/manorollo';

function printHelp(): void {
  console.log(`
CryptoLedger — Local-first cryptocurrency movements reconciler (Beta v0.3.0)

USAGE:
  cryptoledger <file1.csv> <file2.csv> [options]
  npx cryptoledger data/samples/exchange_alpha.csv data/samples/wallet_ledger.csv

FILTERING & VALUATION OPTIONS:
  --asset <symbol>        Filter movements for a specific asset (e.g. BTC, ETH)
  --account <name>        Filter movements involving a specific account/wallet
  --since <date>          Include events on or after YYYY-MM-DD
  --until <date>          Include events on or before YYYY-MM-DD
  --method <method>       Inventory lot valuation: fifo, lifo, or hifo (default: fifo)

MATCHING & AUDIT OPTIONS:
  --window <min>          Reconciliation time window in minutes (default: 180)
  --tolerance <pct>       Network fee matching tolerance ratio (default: 0.05)
  --strict                Fail with exit code 1 if critical anomalies or unresolved reviews exist

EXPORT OPTIONS:
  --export-csv <file>     Export reconciled movements to a clean, universal CSV ledger
  --html <file>           Generate interactive standalone HTML report with dashboard
  --json                  Output raw JSON report (machine-readable)
  --markdown              Output Markdown table report
  --output <file>         Write standard report to file instead of stdout
  -v, --version           Show version
  -h, --help              Show this help message

SPONSORSHIP:
  ${SPONSOR_LINE}
  (Set NO_SPONSOR=1 to suppress notice)
`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('-h') || args.includes('--help')) {
    printHelp();
    return;
  }

  if (args.includes('-v') || args.includes('--version')) {
    console.log('cryptoledger v0.3.0-beta');
    return;
  }

  const files: string[] = [];
  let timeWindowMinutes = 180;
  let feeToleranceRatio = 0.05;
  let isJson = false;
  let isMarkdown = false;
  let isStrict = false;
  let outputPath: string | null = null;
  let exportCsvPath: string | null = null;
  let htmlPath: string | null = null;
  let assetFilter: string | undefined = undefined;
  let accountFilter: string | undefined = undefined;
  let sinceDate: Date | undefined = undefined;
  let untilDate: Date | undefined = undefined;
  let inventoryMethod: 'FIFO' | 'LIFO' | 'HIFO' = 'FIFO';

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg) continue;
    if (arg === '--json') {
      isJson = true;
    } else if (arg === '--markdown') {
      isMarkdown = true;
    } else if (arg === '--strict') {
      isStrict = true;
    } else if (arg === '--window' && args[i + 1]) {
      timeWindowMinutes = parseInt(args[++i] || '180', 10);
    } else if (arg === '--tolerance' && args[i + 1]) {
      feeToleranceRatio = parseFloat(args[++i] || '0.05');
    } else if (arg === '--asset' && args[i + 1]) {
      assetFilter = args[++i];
    } else if (arg === '--account' && args[i + 1]) {
      accountFilter = args[++i];
    } else if (arg === '--since' && args[i + 1]) {
      sinceDate = new Date(args[++i] || '');
    } else if (arg === '--until' && args[i + 1]) {
      untilDate = new Date(args[++i] || '');
    } else if (arg === '--method' && args[i + 1]) {
      const m = (args[++i] || '').toUpperCase();
      if (m === 'LIFO') inventoryMethod = 'LIFO';
      else if (m === 'HIFO') inventoryMethod = 'HIFO';
    } else if (arg === '--export-csv' && args[i + 1]) {
      exportCsvPath = args[++i] || null;
    } else if (arg === '--html' && args[i + 1]) {
      htmlPath = args[++i] || null;
    } else if (arg === '--output' && args[i + 1]) {
      outputPath = args[++i] || null;
    } else if (!arg.startsWith('-')) {
      files.push(arg);
    }
  }

  if (files.length === 0) {
    console.error('Error: Please provide at least one CSV file to analyze.');
    printHelp();
    process.exit(1);
  }

  const allTransactions: RawTransaction[] = [];
  const processedFiles: string[] = [];

  for (const filePath of files) {
    const resolved = path.resolve(process.cwd(), filePath);
    if (!fs.existsSync(resolved)) {
      console.error(`Error: File not found: ${filePath}`);
      process.exit(1);
    }

    const content = fs.readFileSync(resolved, 'utf-8');
    const defaultAccountName = path.basename(filePath, path.extname(filePath));
    const { detectedFormat, transactions } = parseCsvToTransactions(content, defaultAccountName);
    processedFiles.push(`${path.basename(filePath)} (${detectedFormat})`);
    allTransactions.push(...transactions);
  }

  const engine = new ReconciliationEngine({
    timeWindowMinutes,
    feeToleranceRatio,
    assetFilter,
    accountFilter,
    since: sinceDate,
    until: untilDate,
    inventoryMethod
  });

  const report = engine.reconcile(allTransactions, processedFiles);

  // Handle Export options
  if (exportCsvPath) {
    const csvContent = exportToReconciledCsv(report);
    const resolvedCsv = path.resolve(process.cwd(), exportCsvPath);
    fs.writeFileSync(resolvedCsv, csvContent, 'utf-8');
    console.log(`Reconciled CSV ledger successfully written to ${resolvedCsv}`);
  }

  if (htmlPath) {
    const htmlContent = exportToHtmlReport(report);
    const resolvedHtml = path.resolve(process.cwd(), htmlPath);
    fs.writeFileSync(resolvedHtml, htmlContent, 'utf-8');
    console.log(`Interactive HTML report successfully written to ${resolvedHtml}`);
  }

  let outputText = '';
  if (isJson) {
    outputText = JSON.stringify(report, null, 2);
  } else if (isMarkdown) {
    outputText = formatMarkdownReport(report);
  } else {
    outputText = formatTerminalReport(report);
  }

  if (outputPath) {
    const outResolved = path.resolve(process.cwd(), outputPath);
    fs.writeFileSync(outResolved, outputText, 'utf-8');
    console.log(`Report successfully written to ${outResolved}`);
  } else if (!exportCsvPath && !htmlPath) {
    console.log(outputText);
  }

  // Discrete sponsor notice when stdout is a TTY and not suppressed
  const isCI = process.env.CI || process.env.CONTINUOUS_INTEGRATION;
  const noSponsor = process.env.NO_SPONSOR === '1';
  if (!isJson && !isCI && !noSponsor && process.stdout.isTTY) {
    console.log(`\n${SPONSOR_LINE}\n`);
  }

  // Strict check
  if (isStrict) {
    const criticalAnomalies = report.anomalies.filter((a) => a.severity === 'critical');
    if (criticalAnomalies.length > 0 || report.requiresReviewCount > 0) {
      console.error(`\n❌ Strict check failed: ${criticalAnomalies.length} critical anomalies, ${report.requiresReviewCount} unresolved reviews.`);
      process.exit(1);
    }
  }
}

main().catch((err) => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
