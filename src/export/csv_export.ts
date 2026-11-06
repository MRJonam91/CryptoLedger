// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 Manoj Rollo <fbxmano@gmail.com> (https://github.com/MRJonam91)

import type { ReconciliationReport } from '../core/types.ts';

/**
 * Serializes reconciled movements into a clean, unified CSV ledger export.
 */
export function exportToReconciledCsv(report: ReconciliationReport): string {
  const headers = [
    'Timestamp',
    'Classification',
    'Is_Internal_Custody',
    'From_Account',
    'To_Account',
    'Asset',
    'Amount',
    'Counter_Asset',
    'Counter_Amount',
    'Fee_Asset',
    'Fee_Amount',
    'Spot_Price_EUR',
    'Total_Fiat_EUR',
    'Cost_Basis_EUR',
    'Realized_Gain_Loss_EUR',
    'Tx_Hash',
    'Requires_Human_Review',
    'Review_Reason',
    'Provenance_Origin'
  ];

  const rows: string[] = [headers.join(',')];

  for (const m of report.movements) {
    const provStr = m.provenance
      .map((p) => `${p.originSource} (${p.acquiredAt.toISOString().substring(0, 10)})`)
      .join('; ');

    const row = [
      m.timestamp.toISOString(),
      m.classification,
      m.isInternal ? 'TRUE' : 'FALSE',
      `"${m.fromAccount || ''}"`,
      `"${m.toAccount || ''}"`,
      m.asset,
      m.amount.toString(),
      m.counterAsset || '',
      m.counterAmount?.toString() || '',
      m.feeAsset || '',
      m.feeAmount?.toString() || '',
      m.spotPrice?.toString() || '',
      m.totalFiat?.toString() || '',
      m.costBasisFiat?.toString() || '',
      m.gainLossFiat?.toString() || '',
      m.txHash ? `"${m.txHash}"` : '',
      m.requiresHumanReview ? 'TRUE' : 'FALSE',
      `"${(m.reviewReason || '').replace(/"/g, '""')}"`,
      `"${provStr.replace(/"/g, '""')}"`
    ];

    rows.push(row.join(','));
  }

  return rows.join('\n');
}
