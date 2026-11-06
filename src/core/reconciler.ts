// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 Manoj Rollo <fbxmano@gmail.com> (https://github.com/MRJonam91)

import type {
  RawTransaction,
  ReconciledMovement,
  ReconciliationOptions,
  ReconciliationReport,
  ProvenanceNode,
  EconomicClassification
} from './types.ts';

interface AssetLot {
  id: string;
  account: string;
  asset: string;
  amount: number;
  acquiredAt: Date;
  originSource: string;
  acquisitionType: 'BUY' | 'EXTERNAL_DEPOSIT' | 'INITIAL_BALANCE';
}

export class ReconciliationEngine {
  private options: Required<ReconciliationOptions>;

  constructor(options?: ReconciliationOptions) {
    this.options = {
      timeWindowMinutes: options?.timeWindowMinutes ?? 180, // 3 hours window
      feeToleranceRatio: options?.feeToleranceRatio ?? 0.05, // 5% fee tolerance
      defaultAccount: options?.defaultAccount ?? 'DefaultWallet'
    };
  }

  public reconcile(transactions: RawTransaction[], sourceFileNames: string[] = []): ReconciliationReport {
    // Sort transactions chronologically
    const sorted = [...transactions].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    const reconciledMovements: ReconciledMovement[] = [];
    const usedRawIds = new Set<string>();

    const withdrawals = sorted.filter((t) => t.normalizedType === 'WITHDRAWAL');
    const deposits = sorted.filter((t) => t.normalizedType === 'DEPOSIT');

    // Step 1: Match Internal Transfers (Withdrawal on Account A -> Deposit on Account B)
    for (const w of withdrawals) {
      if (usedRawIds.has(w.id)) continue;

      let matchedDeposit: RawTransaction | null = null;

      // 1.1 Match by transaction hash if available
      if (w.txHash) {
        matchedDeposit = deposits.find(
          (d) => !usedRawIds.has(d.id) && d.id !== w.id && d.asset === w.asset && d.txHash === w.txHash
        ) ?? null;
      }

      // 1.2 Match by time window and amounts if not matched by hash
      if (!matchedDeposit) {
        const wTime = w.timestamp.getTime();
        const maxTime = wTime + this.options.timeWindowMinutes * 60 * 1000;
        const minTime = wTime - 15 * 60 * 1000; // allow small clock drift

        matchedDeposit = deposits.find((d) => {
          if (usedRawIds.has(d.id) || d.id === w.id) return false;
          if (d.asset !== w.asset) return false;
          if (d.sourceAccount === w.sourceAccount) return false; // must be across different accounts

          const dTime = d.timestamp.getTime();
          if (dTime < minTime || dTime > maxTime) return false;

          // Amount matching: deposit amount can be equal to withdrawal amount or withdrawal minus fee
          const diff = w.amount - d.amount;
          if (Math.abs(diff) < 0.00000001) return true; // exact match
          if (diff > 0 && diff / w.amount <= this.options.feeToleranceRatio) return true; // net of network fee
          return false;
        }) ?? null;
      }

      if (matchedDeposit) {
        usedRawIds.add(w.id);
        usedRawIds.add(matchedDeposit.id);

        const feeAmount = Math.max(0, w.amount - matchedDeposit.amount + (w.feeAmount || 0));

        reconciledMovements.push({
          id: `transfer-${w.id}-${matchedDeposit.id}`,
          timestamp: w.timestamp,
          fromAccount: w.sourceAccount,
          toAccount: matchedDeposit.sourceAccount,
          asset: w.asset,
          amount: matchedDeposit.amount,
          feeAsset: feeAmount > 0 ? w.asset : undefined,
          feeAmount: feeAmount > 0 ? feeAmount : undefined,
          classification: 'INTERNAL_MOVE',
          isInternal: true,
          sourceEventIds: [w.id, matchedDeposit.id],
          txHash: w.txHash || matchedDeposit.txHash,
          provenance: [],
          requiresHumanReview: false,
          notes: `Reconciled internal movement from ${w.sourceAccount} to ${matchedDeposit.sourceAccount}`
        });
      }
    }

    // Step 2: Process remaining transactions (Buys, Sells, Fees, and Unmatched Transfers)
    for (const tx of sorted) {
      if (usedRawIds.has(tx.id)) continue;
      usedRawIds.add(tx.id);

      switch (tx.normalizedType) {
        case 'BUY': {
          reconciledMovements.push({
            id: `buy-${tx.id}`,
            timestamp: tx.timestamp,
            toAccount: tx.sourceAccount,
            asset: tx.asset,
            amount: tx.amount,
            feeAsset: tx.feeAsset,
            feeAmount: tx.feeAmount,
            classification: 'ACQUISITION',
            isInternal: false,
            sourceEventIds: [tx.id],
            txHash: tx.txHash,
            provenance: [
              {
                originSource: tx.sourceAccount,
                acquiredAt: tx.timestamp,
                asset: tx.asset,
                amount: tx.amount,
                acquisitionType: 'BUY'
              }
            ],
            requiresHumanReview: false,
            notes: `Economic purchase of ${tx.amount} ${tx.asset} on ${tx.sourceAccount}`
          });
          break;
        }

        case 'SELL': {
          reconciledMovements.push({
            id: `sell-${tx.id}`,
            timestamp: tx.timestamp,
            fromAccount: tx.sourceAccount,
            asset: tx.asset,
            amount: tx.amount,
            feeAsset: tx.feeAsset,
            feeAmount: tx.feeAmount,
            classification: 'DISPOSAL',
            isInternal: false,
            sourceEventIds: [tx.id],
            txHash: tx.txHash,
            provenance: [],
            requiresHumanReview: false,
            notes: `Economic disposal of ${tx.amount} ${tx.asset} on ${tx.sourceAccount}`
          });
          break;
        }

        case 'WITHDRAWAL': {
          // Unmatched withdrawal: potentially sent to an unmonitored external wallet or spent
          reconciledMovements.push({
            id: `unmatched-withdrawal-${tx.id}`,
            timestamp: tx.timestamp,
            fromAccount: tx.sourceAccount,
            asset: tx.asset,
            amount: tx.amount,
            feeAsset: tx.feeAsset,
            feeAmount: tx.feeAmount,
            classification: 'UNRESOLVED',
            isInternal: false,
            sourceEventIds: [tx.id],
            txHash: tx.txHash,
            provenance: [],
            requiresHumanReview: true,
            reviewReason: `Withdrawal of ${tx.amount} ${tx.asset} from ${tx.sourceAccount} not matched with any internal deposit. Requires manual tagging (external payment or third-party transfer).`,
            notes: 'Unmatched withdrawal'
          });
          break;
        }

        case 'DEPOSIT': {
          // Unmatched deposit: potential external income, fiat deposit, or unlinked transfer
          reconciledMovements.push({
            id: `unmatched-deposit-${tx.id}`,
            timestamp: tx.timestamp,
            toAccount: tx.sourceAccount,
            asset: tx.asset,
            amount: tx.amount,
            feeAsset: tx.feeAsset,
            feeAmount: tx.feeAmount,
            classification: 'UNRESOLVED',
            isInternal: false,
            sourceEventIds: [tx.id],
            txHash: tx.txHash,
            provenance: [
              {
                originSource: tx.sourceAccount,
                acquiredAt: tx.timestamp,
                asset: tx.asset,
                amount: tx.amount,
                acquisitionType: 'EXTERNAL_DEPOSIT'
              }
            ],
            requiresHumanReview: true,
            reviewReason: `Deposit of ${tx.amount} ${tx.asset} into ${tx.sourceAccount} has no matching internal withdrawal. Requires manual confirmation of origin.`,
            notes: 'Unmatched deposit'
          });
          break;
        }

        case 'FEE': {
          reconciledMovements.push({
            id: `fee-${tx.id}`,
            timestamp: tx.timestamp,
            fromAccount: tx.sourceAccount,
            asset: tx.asset,
            amount: tx.amount,
            classification: 'FEE_EXPENSE',
            isInternal: false,
            sourceEventIds: [tx.id],
            provenance: [],
            requiresHumanReview: false,
            notes: `Standalone network or exchange fee of ${tx.amount} ${tx.asset}`
          });
          break;
        }

        default: {
          reconciledMovements.push({
            id: `unclassified-${tx.id}`,
            timestamp: tx.timestamp,
            fromAccount: tx.sourceAccount,
            asset: tx.asset,
            amount: tx.amount,
            classification: 'UNRESOLVED',
            isInternal: false,
            sourceEventIds: [tx.id],
            provenance: [],
            requiresHumanReview: true,
            reviewReason: `Unclassified operation "${tx.rawType}" for ${tx.amount} ${tx.asset}`,
            notes: 'Unclassified transaction'
          });
        }
      }
    }

    // Step 3: Provenance tracking and Running Balances (Lot FIFO Queue)
    reconciledMovements.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    const activeLots: AssetLot[] = [];
    const balancesByAccount: Record<string, Record<string, number>> = {};
    const aggregatedBalances: Record<string, number> = {};

    const updateBalance = (account: string, asset: string, delta: number) => {
      balancesByAccount[account] ??= {};
      balancesByAccount[account][asset] = (balancesByAccount[account][asset] ?? 0) + delta;
      aggregatedBalances[asset] = (aggregatedBalances[asset] ?? 0) + delta;
    };

    for (const mov of reconciledMovements) {
      if (mov.classification === 'ACQUISITION') {
        const toAcc = mov.toAccount ?? this.options.defaultAccount;
        updateBalance(toAcc, mov.asset, mov.amount);

        activeLots.push({
          id: mov.id,
          account: toAcc,
          asset: mov.asset,
          amount: mov.amount,
          acquiredAt: mov.timestamp,
          originSource: toAcc,
          acquisitionType: 'BUY'
        });
      } else if (mov.classification === 'INTERNAL_MOVE') {
        const fromAcc = mov.fromAccount ?? this.options.defaultAccount;
        const toAcc = mov.toAccount ?? this.options.defaultAccount;

        updateBalance(fromAcc, mov.asset, -mov.amount);
        if (mov.feeAmount && mov.feeAsset) {
          updateBalance(fromAcc, mov.feeAsset, -mov.feeAmount);
        }
        updateBalance(toAcc, mov.asset, mov.amount);

        // Transfer lots from fromAccount to toAccount maintaining original provenance
        let needed = mov.amount;
        const provenanceTrail: ProvenanceNode[] = [];

        for (const lot of activeLots) {
          if (needed <= 0) break;
          if (lot.account === fromAcc && lot.asset === mov.asset && lot.amount > 0) {
            const transferChunk = Math.min(lot.amount, needed);
            lot.amount -= transferChunk;
            needed -= transferChunk;

            provenanceTrail.push({
              originSource: lot.originSource,
              acquiredAt: lot.acquiredAt,
              asset: lot.asset,
              amount: transferChunk,
              acquisitionType: lot.acquisitionType
            });

            // Create transferred lot at destination
            activeLots.push({
              id: `${mov.id}-transferred`,
              account: toAcc,
              asset: lot.asset,
              amount: transferChunk,
              acquiredAt: lot.acquiredAt,
              originSource: lot.originSource,
              acquisitionType: lot.acquisitionType
            });
          }
        }
        mov.provenance = provenanceTrail;
      } else if (mov.classification === 'DISPOSAL') {
        const fromAcc = mov.fromAccount ?? this.options.defaultAccount;
        updateBalance(fromAcc, mov.asset, -mov.amount);

        // Deduct from lots
        let remainingToSell = mov.amount;
        const consumedLots: ProvenanceNode[] = [];

        for (const lot of activeLots) {
          if (remainingToSell <= 0) break;
          if (lot.account === fromAcc && lot.asset === mov.asset && lot.amount > 0) {
            const deduct = Math.min(lot.amount, remainingToSell);
            lot.amount -= deduct;
            remainingToSell -= deduct;

            consumedLots.push({
              originSource: lot.originSource,
              acquiredAt: lot.acquiredAt,
              asset: lot.asset,
              amount: deduct,
              acquisitionType: lot.acquisitionType
            });
          }
        }
        mov.provenance = consumedLots;
      } else if (mov.classification === 'FEE_EXPENSE') {
        const fromAcc = mov.fromAccount ?? this.options.defaultAccount;
        updateBalance(fromAcc, mov.asset, -mov.amount);
      } else if (mov.requiresHumanReview) {
        if (mov.fromAccount) {
          updateBalance(mov.fromAccount, mov.asset, -mov.amount);
        } else if (mov.toAccount) {
          updateBalance(mov.toAccount, mov.asset, mov.amount);
        }
      }
    }

    // Clean zero-balances floating point errors
    for (const acc of Object.keys(balancesByAccount)) {
      const accBalances = balancesByAccount[acc];
      if (!accBalances) continue;
      for (const asset of Object.keys(accBalances)) {
        if (Math.abs(accBalances[asset] ?? 0) < 0.000000001) {
          accBalances[asset] = 0;
        }
      }
    }
    for (const asset of Object.keys(aggregatedBalances)) {
      if (Math.abs(aggregatedBalances[asset] ?? 0) < 0.000000001) {
        aggregatedBalances[asset] = 0;
      }
    }

    const unresolvedIssues = reconciledMovements
      .filter((m) => m.requiresHumanReview)
      .map((m) => ({
        eventId: m.id,
        account: m.fromAccount || m.toAccount || 'UnknownAccount',
        timestamp: m.timestamp.toISOString(),
        asset: m.asset,
        amount: m.amount,
        reason: m.reviewReason || 'Manual review required',
        severity: (m.classification === 'UNRESOLVED' ? 'warning' : 'info') as 'warning' | 'info'
      }));

    return {
      generatedAt: new Date().toISOString(),
      sourceFiles: sourceFileNames,
      totalRawEvents: transactions.length,
      totalReconciledMovements: reconciledMovements.length,
      internalTransfersCount: reconciledMovements.filter((m) => m.isInternal).length,
      economicTransactionsCount: reconciledMovements.filter((m) => ['ACQUISITION', 'DISPOSAL'].includes(m.classification)).length,
      requiresReviewCount: unresolvedIssues.length,
      balances: {
        byAccount: balancesByAccount,
        aggregated: aggregatedBalances
      },
      unresolvedIssues,
      movements: reconciledMovements
    };
  }
}
