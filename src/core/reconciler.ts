// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 Manoj Rollo <fbxmano@gmail.com> (https://github.com/MRJonam91)

import type {
  RawTransaction,
  ReconciledMovement,
  ReconciliationOptions,
  ReconciliationReport,
  ProvenanceNode
} from './types.ts';
import { roundToDecimals, areAmountsEqual, EPSILON } from './math.ts';

interface AssetLot {
  id: string;
  account: string;
  asset: string;
  amount: number;
  acquiredAt: Date;
  originSource: string;
  acquisitionType: 'BUY' | 'SWAP' | 'EXTERNAL_DEPOSIT' | 'INITIAL_BALANCE';
  unitCostFiat?: number;
  fiatCurrency?: string;
}

export class ReconciliationEngine {
  private options: Required<ReconciliationOptions>;

  constructor(options?: ReconciliationOptions) {
    this.options = {
      timeWindowMinutes: options?.timeWindowMinutes ?? 180,
      feeToleranceRatio: options?.feeToleranceRatio ?? 0.05,
      defaultAccount: options?.defaultAccount ?? 'DefaultWallet',
      assetFilter: options?.assetFilter ? options.assetFilter.toUpperCase() : '',
      accountFilter: options?.accountFilter ?? '',
      since: options?.since ?? new Date(0),
      until: options?.until ?? new Date(8640000000000000),
      inventoryMethod: options?.inventoryMethod ?? 'FIFO'
    };
  }

  public reconcile(transactions: RawTransaction[], sourceFileNames: string[] = []): ReconciliationReport {
    // Sort transactions chronologically
    const sorted = [...transactions].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    const reconciledMovements: ReconciledMovement[] = [];
    const usedRawIds = new Set<string>();

    const withdrawals = sorted.filter((t) => t.normalizedType === 'WITHDRAWAL');
    const deposits = sorted.filter((t) => t.normalizedType === 'DEPOSIT');

    // Step 1: Match Internal Custody Transfers (Withdrawal on Account A -> Deposit on Account B)
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
          if (d.sourceAccount === w.sourceAccount) return false;

          const dTime = d.timestamp.getTime();
          if (dTime < minTime || dTime > maxTime) return false;

          const diff = roundToDecimals(w.amount - d.amount);
          if (areAmountsEqual(w.amount, d.amount)) return true;
          if (diff > 0 && diff / w.amount <= this.options.feeToleranceRatio) return true;
          return false;
        }) ?? null;
      }

      if (matchedDeposit) {
        usedRawIds.add(w.id);
        usedRawIds.add(matchedDeposit.id);

        const feeAmount = roundToDecimals(Math.max(0, w.amount - matchedDeposit.amount + (w.feeAmount || 0)));

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
          notes: `Reconciled custody transfer from ${w.sourceAccount} to ${matchedDeposit.sourceAccount}`
        });
      }
    }

    // Step 2: Process remaining transactions
    for (const tx of sorted) {
      if (usedRawIds.has(tx.id)) continue;
      usedRawIds.add(tx.id);

      switch (tx.normalizedType) {
        case 'BUY': {
          const unitCost = tx.spotPrice ?? (tx.totalFiat && tx.amount > 0 ? tx.totalFiat / tx.amount : undefined);
          reconciledMovements.push({
            id: `buy-${tx.id}`,
            timestamp: tx.timestamp,
            toAccount: tx.sourceAccount,
            asset: tx.asset,
            amount: tx.amount,
            spotPrice: tx.spotPrice,
            totalFiat: tx.totalFiat,
            fiatCurrency: tx.fiatCurrency || 'EUR',
            costBasisFiat: tx.totalFiat,
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
                acquisitionType: 'BUY',
                costBasisFiat: tx.totalFiat,
                fiatCurrency: tx.fiatCurrency || 'EUR'
              }
            ],
            requiresHumanReview: false,
            notes: `Economic purchase of ${tx.amount} ${tx.asset} on ${tx.sourceAccount}${unitCost ? ` @ ${unitCost} EUR` : ''}`
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
            spotPrice: tx.spotPrice,
            totalFiat: tx.totalFiat,
            fiatCurrency: tx.fiatCurrency || 'EUR',
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

        case 'SWAP': {
          reconciledMovements.push({
            id: `swap-${tx.id}`,
            timestamp: tx.timestamp,
            fromAccount: tx.sourceAccount,
            toAccount: tx.sourceAccount,
            asset: tx.asset,
            amount: tx.amount,
            counterAsset: tx.counterAsset,
            counterAmount: tx.counterAmount,
            spotPrice: tx.spotPrice,
            totalFiat: tx.totalFiat,
            fiatCurrency: tx.fiatCurrency || 'EUR',
            feeAsset: tx.feeAsset,
            feeAmount: tx.feeAmount,
            classification: 'SWAP',
            isInternal: false,
            sourceEventIds: [tx.id],
            txHash: tx.txHash,
            provenance: [],
            requiresHumanReview: false,
            notes: `Swap trade: ${tx.amount} ${tx.asset} -> ${tx.counterAmount || '?'} ${tx.counterAsset || '?'}`
          });
          break;
        }

        case 'WITHDRAWAL': {
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
                acquisitionType: 'EXTERNAL_DEPOSIT',
                fiatCurrency: 'EUR'
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

    // Step 3: Provenance tracking, Lot Inventory & Balances
    reconciledMovements.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    const activeLots: AssetLot[] = [];
    const balancesByAccount: Record<string, Record<string, number>> = {};
    const aggregatedBalances: Record<string, number> = {};
    let totalRealizedGainLoss = 0;
    let hasEstimatedGains = false;

    const updateBalance = (account: string, asset: string, delta: number) => {
      balancesByAccount[account] ??= {};
      balancesByAccount[account][asset] = roundToDecimals((balancesByAccount[account][asset] ?? 0) + delta);
      aggregatedBalances[asset] = roundToDecimals((aggregatedBalances[asset] ?? 0) + delta);
    };

    for (const mov of reconciledMovements) {
      if (mov.classification === 'ACQUISITION') {
        const toAcc = mov.toAccount ?? this.options.defaultAccount;
        updateBalance(toAcc, mov.asset, mov.amount);

        const unitCost = mov.spotPrice ?? (mov.totalFiat && mov.amount > 0 ? mov.totalFiat / mov.amount : undefined);
        activeLots.push({
          id: mov.id,
          account: toAcc,
          asset: mov.asset,
          amount: mov.amount,
          acquiredAt: mov.timestamp,
          originSource: toAcc,
          acquisitionType: 'BUY',
          unitCostFiat: unitCost,
          fiatCurrency: mov.fiatCurrency || 'EUR'
        });
      } else if (mov.classification === 'INTERNAL_MOVE') {
        const fromAcc = mov.fromAccount ?? this.options.defaultAccount;
        const toAcc = mov.toAccount ?? this.options.defaultAccount;

        updateBalance(fromAcc, mov.asset, -mov.amount);
        if (mov.feeAmount && mov.feeAsset) {
          updateBalance(fromAcc, mov.feeAsset, -mov.feeAmount);
        }
        updateBalance(toAcc, mov.asset, mov.amount);

        // Transfer lots from fromAccount to toAccount maintaining original provenance & unit cost
        let needed = mov.amount;
        const provenanceTrail: ProvenanceNode[] = [];

        // Order selection by FIFO or LIFO
        const eligibleLots = activeLots.filter(
          (l) => l.account === fromAcc && l.asset === mov.asset && l.amount > EPSILON
        );
        if (this.options.inventoryMethod === 'LIFO') {
          eligibleLots.reverse();
        }

        for (const lot of eligibleLots) {
          if (needed <= EPSILON) break;
          const transferChunk = roundToDecimals(Math.min(lot.amount, needed));
          lot.amount = roundToDecimals(lot.amount - transferChunk);
          needed = roundToDecimals(needed - transferChunk);

          const nodeCost = lot.unitCostFiat ? roundToDecimals(lot.unitCostFiat * transferChunk, 2) : undefined;
          provenanceTrail.push({
            originSource: lot.originSource,
            acquiredAt: lot.acquiredAt,
            asset: lot.asset,
            amount: transferChunk,
            acquisitionType: lot.acquisitionType,
            costBasisFiat: nodeCost,
            fiatCurrency: lot.fiatCurrency
          });

          // Destination lot inherits original provenance and unit cost
          activeLots.push({
            id: `${mov.id}-transferred`,
            account: toAcc,
            asset: lot.asset,
            amount: transferChunk,
            acquiredAt: lot.acquiredAt,
            originSource: lot.originSource,
            acquisitionType: lot.acquisitionType,
            unitCostFiat: lot.unitCostFiat,
            fiatCurrency: lot.fiatCurrency
          });
        }
        mov.provenance = provenanceTrail;
      } else if (mov.classification === 'DISPOSAL') {
        const fromAcc = mov.fromAccount ?? this.options.defaultAccount;
        updateBalance(fromAcc, mov.asset, -mov.amount);

        let remainingToSell = mov.amount;
        const consumedLots: ProvenanceNode[] = [];
        let totalCostBasisForDisposal = 0;
        let hasCompleteCostData = true;

        const eligibleLots = activeLots.filter(
          (l) => l.account === fromAcc && l.asset === mov.asset && l.amount > EPSILON
        );
        if (this.options.inventoryMethod === 'LIFO') {
          eligibleLots.reverse();
        }

        for (const lot of eligibleLots) {
          if (remainingToSell <= EPSILON) break;
          const deduct = roundToDecimals(Math.min(lot.amount, remainingToSell));
          lot.amount = roundToDecimals(lot.amount - deduct);
          remainingToSell = roundToDecimals(remainingToSell - deduct);

          const chunkCost = lot.unitCostFiat !== undefined ? roundToDecimals(lot.unitCostFiat * deduct, 2) : undefined;
          if (chunkCost !== undefined) {
            totalCostBasisForDisposal += chunkCost;
          } else {
            hasCompleteCostData = false;
          }

          consumedLots.push({
            originSource: lot.originSource,
            acquiredAt: lot.acquiredAt,
            asset: lot.asset,
            amount: deduct,
            acquisitionType: lot.acquisitionType,
            costBasisFiat: chunkCost,
            fiatCurrency: lot.fiatCurrency
          });
        }
        mov.provenance = consumedLots;

        if (hasCompleteCostData && (mov.totalFiat || mov.spotPrice)) {
          const proceeds = mov.totalFiat ?? roundToDecimals(mov.amount * (mov.spotPrice || 0), 2);
          mov.costBasisFiat = roundToDecimals(totalCostBasisForDisposal, 2);
          mov.gainLossFiat = roundToDecimals(proceeds - totalCostBasisForDisposal, 2);
          totalRealizedGainLoss = roundToDecimals(totalRealizedGainLoss + mov.gainLossFiat, 2);
          hasEstimatedGains = true;
        }
      } else if (mov.classification === 'SWAP') {
        const fromAcc = mov.fromAccount ?? this.options.defaultAccount;
        updateBalance(fromAcc, mov.asset, -mov.amount);
        if (mov.counterAsset && mov.counterAmount) {
          updateBalance(fromAcc, mov.counterAsset, mov.counterAmount);
          activeLots.push({
            id: `${mov.id}-swap-recv`,
            account: fromAcc,
            asset: mov.counterAsset,
            amount: mov.counterAmount,
            acquiredAt: mov.timestamp,
            originSource: fromAcc,
            acquisitionType: 'SWAP',
            fiatCurrency: mov.fiatCurrency || 'EUR'
          });
        }
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

    // Step 4: Apply filters (Asset, Account, Date Window)
    let filteredMovements = reconciledMovements;

    if (this.options.assetFilter) {
      filteredMovements = filteredMovements.filter((m) => m.asset === this.options.assetFilter || m.counterAsset === this.options.assetFilter);
    }
    if (this.options.accountFilter) {
      filteredMovements = filteredMovements.filter((m) => m.fromAccount === this.options.accountFilter || m.toAccount === this.options.accountFilter);
    }
    if (this.options.since.getTime() > 0) {
      filteredMovements = filteredMovements.filter((m) => m.timestamp.getTime() >= this.options.since.getTime());
    }
    if (this.options.until.getTime() < 8640000000000000) {
      filteredMovements = filteredMovements.filter((m) => m.timestamp.getTime() <= this.options.until.getTime());
    }

    const unresolvedIssues = filteredMovements
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
      totalReconciledMovements: filteredMovements.length,
      internalTransfersCount: filteredMovements.filter((m) => m.isInternal).length,
      economicTransactionsCount: filteredMovements.filter((m) => ['ACQUISITION', 'DISPOSAL'].includes(m.classification)).length,
      swapsCount: filteredMovements.filter((m) => m.classification === 'SWAP').length,
      requiresReviewCount: unresolvedIssues.length,
      realizedGainLoss: {
        totalFiat: totalRealizedGainLoss,
        fiatCurrency: 'EUR',
        hasEstimatedGains
      },
      balances: {
        byAccount: balancesByAccount,
        aggregated: aggregatedBalances
      },
      unresolvedIssues,
      movements: filteredMovements
    };
  }
}
