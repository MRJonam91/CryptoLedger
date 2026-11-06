// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 Manoj Rollo <fbxmano@gmail.com> (https://github.com/MRJonam91)

import type { ReconciliationReport } from './types.ts';

export function formatTerminalReport(report: ReconciliationReport): string {
  const lines: string[] = [];
  const divider = '─'.repeat(70);

  lines.push('\n' + '═'.repeat(70));
  lines.push('  CryptoLedger — Reconciliation & Provenance Report (Beta)');
  lines.push('═'.repeat(70));
  lines.push(`  Generated: ${report.generatedAt}`);
  if (report.sourceFiles.length > 0) {
    lines.push(`  Sources:   ${report.sourceFiles.join(', ')}`);
  }
  lines.push(divider);

  lines.push('\n📊 SUMMARY');
  lines.push(`  • Raw Events Processed:        ${report.totalRawEvents}`);
  lines.push(`  • Reconciled Movements:        ${report.totalReconciledMovements}`);
  lines.push(`  • Internal Transfers Matched:  ${report.internalTransfersCount} (custody moves, non-taxable)`);
  lines.push(`  • Economic Trades (Buy/Sell):  ${report.economicTransactionsCount}`);
  lines.push(`  • Crypto Swaps / Conversions:  ${report.swapsCount}`);
  lines.push(`  • Detected Anomalies:          ${report.anomalies.length}`);
  lines.push(`  • Pending Human Reviews:       ${report.requiresReviewCount}`);

  if (report.realizedGainLoss.hasEstimatedGains) {
    const glSign = report.realizedGainLoss.totalFiat >= 0 ? '+' : '';
    lines.push('\n📈 ESTIMATED REALIZED GAIN / LOSS (Informational)');
    lines.push(`  • Total Estimated P&L:         ${glSign}${report.realizedGainLoss.totalFiat.toFixed(2)} ${report.realizedGainLoss.fiatCurrency}`);
    lines.push('  ↳ Note: Informational estimate based on lot method. Not a certified tax statement.');
  }

  lines.push('\n💰 ACCOUNT BALANCES');
  for (const [account, assets] of Object.entries(report.balances.byAccount)) {
    lines.push(`  [${account}]`);
    for (const [asset, bal] of Object.entries(assets)) {
      if (bal !== 0) {
        lines.push(`    • ${asset.padEnd(8)} ${bal.toFixed(8)}`);
      }
    }
  }

  lines.push('\n🌐 CONSOLIDATED PORTFOLIO BALANCES');
  for (const [asset, bal] of Object.entries(report.balances.aggregated)) {
    if (bal !== 0) {
      lines.push(`    • ${asset.padEnd(8)} ${bal.toFixed(8)}`);
    }
  }

  lines.push('\n🔄 RECONCILED MOVEMENTS (Chronological Trail)');
  report.movements.forEach((m, idx) => {
    const timeStr = m.timestamp.toISOString().replace('T', ' ').substring(0, 19);
    const tag = m.isInternal ? '[INTERNAL MOVE]' : `[${m.classification}]`;
    const fromStr = m.fromAccount ?? 'EXTERNAL';
    const toStr = m.toAccount ?? 'EXTERNAL';
    let detail = `${m.amount} ${m.asset}`;
    if (m.classification === 'SWAP' && m.counterAsset) {
      detail += ` -> ${m.counterAmount} ${m.counterAsset}`;
    }
    lines.push(`  ${(idx + 1).toString().padStart(2)}. ${timeStr} ${tag.padEnd(16)} ${detail} (${fromStr} -> ${toStr})`);

    if (m.costBasisFiat !== undefined && m.gainLossFiat !== undefined) {
      const gl = m.gainLossFiat >= 0 ? `+${m.gainLossFiat.toFixed(2)}` : m.gainLossFiat.toFixed(2);
      lines.push(`      ↳ Cost Basis: ${m.costBasisFiat.toFixed(2)} EUR | Realized P&L: ${gl} EUR`);
    }
    if (m.provenance.length > 0) {
      const origins = m.provenance.map((p) => {
        const costStr = p.costBasisFiat ? ` (${p.costBasisFiat} EUR)` : '';
        return `${p.originSource} on ${p.acquiredAt.toISOString().substring(0, 10)}${costStr}`;
      }).join(', ');
      lines.push(`      ↳ Provenance: ${origins}`);
    }
    if (m.requiresHumanReview) {
      lines.push(`      ⚠️ REVIEW: ${m.reviewReason}`);
    }
  });

  if (report.anomalies.length > 0) {
    lines.push('\n🔍 AUDIT & ANOMALY DIAGNOSTICS');
    report.anomalies.forEach((a, idx) => {
      const icon = a.severity === 'critical' ? '🚨 CRITICAL' : a.severity === 'warning' ? '⚠️  WARNING' : 'ℹ️  INFO';
      lines.push(`  [${idx + 1}] ${icon}: [${a.type}] ${a.message}`);
    });
  }

  if (report.unresolvedIssues.length > 0) {
    lines.push('\n⚠️  ACTION REQUIRED: HUMAN REVIEW');
    report.unresolvedIssues.forEach((issue, idx) => {
      lines.push(`  [${idx + 1}] Account: ${issue.account} | ${issue.amount} ${issue.asset} at ${issue.timestamp}`);
      lines.push(`      Reason: ${issue.reason}`);
    });
  } else if (report.anomalies.length === 0) {
    lines.push('\n✅ All transfers matched and verified with zero detected anomalies.');
  }

  lines.push('\n' + divider);
  return lines.join('\n');
}

export function formatMarkdownReport(report: ReconciliationReport): string {
  const lines: string[] = [];

  lines.push('# CryptoLedger — Reconciliation & Provenance Report (Beta)');
  lines.push('');
  lines.push(`- **Generated at:** ${report.generatedAt}`);
  lines.push(`- **Sources:** ${report.sourceFiles.map((s) => `\`${s}\``).join(', ')}`);
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push('| Metric | Value |');
  lines.push('|---|---|');
  lines.push(`| Raw Events Processed | ${report.totalRawEvents} |`);
  lines.push(`| Reconciled Movements | ${report.totalReconciledMovements} |`);
  lines.push(`| Internal Custody Moves | ${report.internalTransfersCount} |`);
  lines.push(`| Economic Trades | ${report.economicTransactionsCount} |`);
  lines.push(`| Swaps / Conversions | ${report.swapsCount} |`);
  lines.push(`| Detected Anomalies | ${report.anomalies.length} |`);
  lines.push(`| Pending Reviews | ${report.requiresReviewCount} |`);
  if (report.realizedGainLoss.hasEstimatedGains) {
    const glSign = report.realizedGainLoss.totalFiat >= 0 ? '+' : '';
    lines.push(`| Estimated Realized P&L | ${glSign}${report.realizedGainLoss.totalFiat.toFixed(2)} ${report.realizedGainLoss.fiatCurrency} |`);
  }
  lines.push('');

  if (report.anomalies.length > 0) {
    lines.push('## Diagnostic Anomalies');
    lines.push('');
    lines.push('| Severity | Type | Message | Account | Timestamp |');
    lines.push('|---|---|---|---|---|');
    report.anomalies.forEach((a) => {
      lines.push(`| ${a.severity.toUpperCase()} | ${a.type} | ${a.message} | ${a.account || '-'} | ${a.timestamp || '-'} |`);
    });
    lines.push('');
  }

  lines.push('## Account Balances');
  lines.push('');
  lines.push('| Account | Asset | Balance |');
  lines.push('|---|---|---|');
  for (const [account, assets] of Object.entries(report.balances.byAccount)) {
    for (const [asset, bal] of Object.entries(assets)) {
      if (bal !== 0) {
        lines.push(`| ${account} | ${asset} | ${bal.toFixed(8)} |`);
      }
    }
  }
  lines.push('');

  lines.push('## Reconciled Movements');
  lines.push('');
  lines.push('| # | Timestamp | Classification | Asset | Amount | From | To | Provenance | Review |');
  lines.push('|---|---|---|---|---|---|---|---|---|');
  report.movements.forEach((m, idx) => {
    const timeStr = m.timestamp.toISOString().replace('T', ' ').substring(0, 19);
    const provStr = m.provenance.map((p) => `${p.originSource} (${p.amount})`).join('; ') || 'N/A';
    const revStr = m.requiresHumanReview ? `⚠️ ${m.reviewReason}` : 'OK';
    lines.push(`| ${idx + 1} | ${timeStr} | ${m.classification} | ${m.asset} | ${m.amount} | ${m.fromAccount || '-'} | ${m.toAccount || '-'} | ${provStr} | ${revStr} |`);
  });
  lines.push('');

  return lines.join('\n');
}
