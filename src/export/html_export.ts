// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 Manoj Rollo <fbxmano@gmail.com> (https://github.com/MRJonam91)

import type { ReconciliationReport } from '../core/types.ts';

export function exportToHtmlReport(report: ReconciliationReport): string {
  const glSign = report.realizedGainLoss.totalFiat >= 0 ? '+' : '';
  const glColor = report.realizedGainLoss.totalFiat >= 0 ? '#10b981' : '#ef4444';

  const rowsHtml = report.movements
    .map((m, idx) => {
      const timeStr = m.timestamp.toISOString().replace('T', ' ').substring(0, 19);
      const tagClass = m.isInternal ? 'badge-internal' : `badge-${m.classification.toLowerCase()}`;
      const provStr = m.provenance.map((p) => `${p.originSource} (${p.amount} ${p.asset})`).join(', ') || '-';
      const reviewBadge = m.requiresHumanReview
        ? `<span class="badge-review" title="${m.reviewReason || ''}">⚠️ Action Required</span>`
        : '<span class="badge-ok">✓ Reconciled</span>';

      return `<tr data-asset="${m.asset}" data-type="${m.classification}">
        <td>${idx + 1}</td>
        <td><code>${timeStr}</code></td>
        <td><span class="badge ${tagClass}">${m.isInternal ? 'INTERNAL MOVE' : m.classification}</span></td>
        <td><strong>${m.amount}</strong> ${m.asset}</td>
        <td>${m.fromAccount || '<span class="text-muted">EXTERNAL</span>'}</td>
        <td>${m.toAccount || '<span class="text-muted">EXTERNAL</span>'}</td>
        <td class="text-small">${provStr}</td>
        <td>${reviewBadge}</td>
      </tr>`;
    })
    .join('\n');

  const balancesHtml = Object.entries(report.balances.byAccount)
    .map(([acc, assets]) => {
      const assetList = Object.entries(assets)
        .filter(([, bal]) => bal !== 0)
        .map(([asset, bal]) => `<li><code>${asset}</code>: <strong>${bal.toFixed(8)}</strong></li>`)
        .join('');
      return `<div class="balance-card"><h3>${acc}</h3><ul>${assetList || '<li>No active balances</li>'}</ul></div>`;
    })
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CryptoLedger — Reconciliation & Provenance Report</title>
  <style>
    :root {
      --bg: #0f172a;
      --card-bg: #1e293b;
      --text: #f8fafc;
      --text-muted: #94a3b8;
      --border: #334155;
      --primary: #38bdf8;
      --green: #10b981;
      --red: #ef4444;
      --yellow: #f59e0b;
      --purple: #a855f7;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: var(--bg);
      color: var(--text);
      margin: 0;
      padding: 2rem;
    }
    .header {
      border-bottom: 1px solid var(--border);
      padding-bottom: 1rem;
      margin-bottom: 2rem;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      flex-wrap: wrap;
      gap: 1rem;
    }
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 1rem;
      margin-bottom: 2rem;
    }
    .stat-card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 1.25rem;
    }
    .stat-num {
      font-size: 1.75rem;
      font-weight: 700;
      color: var(--primary);
    }
    .search-bar {
      margin-bottom: 1rem;
      display: flex;
      gap: 1rem;
    }
    .search-input {
      flex: 1;
      padding: 0.75rem 1rem;
      background: var(--card-bg);
      border: 1px solid var(--border);
      color: var(--text);
      border-radius: 6px;
      font-size: 0.95rem;
    }
    .search-input:focus {
      outline: 2px solid var(--primary);
    }
    .badge {
      display: inline-block;
      padding: 0.25rem 0.6rem;
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 600;
    }
    .badge-internal { background: rgba(56, 189, 248, 0.2); color: var(--primary); }
    .badge-acquisition { background: rgba(16, 185, 129, 0.2); color: var(--green); }
    .badge-disposal { background: rgba(239, 68, 68, 0.2); color: var(--red); }
    .badge-swap { background: rgba(168, 85, 247, 0.2); color: var(--purple); }
    .badge-review { background: rgba(245, 158, 11, 0.2); color: var(--yellow); }
    .badge-ok { background: rgba(16, 185, 129, 0.15); color: var(--green); }
    table {
      width: 100%;
      border-collapse: collapse;
      background: var(--card-bg);
      border-radius: 8px;
      overflow: hidden;
      margin-bottom: 2rem;
    }
    th, td {
      padding: 0.85rem 1rem;
      text-align: left;
      border-bottom: 1px solid var(--border);
    }
    th { background: #131c2e; font-weight: 600; color: var(--text-muted); }
    .text-muted { color: var(--text-muted); }
    .text-small { font-size: 0.85rem; color: var(--text-muted); }
    .balance-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 1rem;
      margin-bottom: 2rem;
    }
    .balance-card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 1rem;
    }
    .balance-card h3 { margin-top: 0; font-size: 1.1rem; color: var(--primary); }
    .balance-card ul { padding-left: 1.25rem; margin-bottom: 0; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>🛡️ CryptoLedger — Reconciliation & Provenance Report</h1>
      <p class="text-muted">Generated: ${report.generatedAt} | Sources: ${report.sourceFiles.join(', ')}</p>
    </div>
  </div>

  <div class="summary-grid">
    <div class="stat-card">
      <div class="text-muted">Raw Events</div>
      <div class="stat-num">${report.totalRawEvents}</div>
    </div>
    <div class="stat-card">
      <div class="text-muted">Internal Moves</div>
      <div class="stat-num">${report.internalTransfersCount}</div>
    </div>
    <div class="stat-card">
      <div class="text-muted">Economic Trades</div>
      <div class="stat-num">${report.economicTransactionsCount}</div>
    </div>
    <div class="stat-card">
      <div class="text-muted">Swaps / Converts</div>
      <div class="stat-num">${report.swapsCount}</div>
    </div>
    <div class="stat-card">
      <div class="text-muted">Human Reviews</div>
      <div class="stat-num" style="color: ${report.requiresReviewCount > 0 ? 'var(--yellow)' : 'var(--green)'};">${report.requiresReviewCount}</div>
    </div>
    <div class="stat-card">
      <div class="text-muted">Estimated P&L (FIFO)</div>
      <div class="stat-num" style="color: ${glColor};">${glSign}${report.realizedGainLoss.totalFiat.toFixed(2)} ${report.realizedGainLoss.fiatCurrency}</div>
    </div>
  </div>

  <h2>💰 Balances by Account</h2>
  <div class="balance-grid">
    ${balancesHtml}
  </div>

  <h2>🔄 Reconciled Chronological Movements</h2>
  <div class="search-bar">
    <input type="text" id="searchInput" class="search-input" placeholder="🔍 Instant search movements (filter by asset, account, type, or date)..." onkeyup="filterMovements()">
  </div>

  <table id="movementsTable">
    <thead>
      <tr>
        <th>#</th>
        <th>Timestamp</th>
        <th>Type</th>
        <th>Amount</th>
        <th>From Account</th>
        <th>To Account</th>
        <th>Provenance Trail</th>
        <th>Audit Status</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
    </tbody>
  </table>

  <footer class="text-muted text-small">
    CryptoLedger Local-First Reconciler • Apache-2.0 • Zero third-party telemetry or cloud leaks.
  </footer>

  <script>
    function filterMovements() {
      const input = document.getElementById('searchInput');
      const filter = input.value.toLowerCase();
      const rows = document.querySelectorAll('#movementsTable tbody tr');

      rows.forEach(row => {
        const text = row.innerText.toLowerCase();
        row.style.display = text.includes(filter) ? '' : 'none';
      });
    }
  </script>
</body>
</html>`;
}
