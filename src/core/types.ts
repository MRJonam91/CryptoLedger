// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 Manoj Rollo <fbxmano@gmail.com> (https://github.com/MRJonam91)

export type RawTransactionType =
  | 'BUY'
  | 'SELL'
  | 'SWAP'
  | 'DEPOSIT'
  | 'WITHDRAWAL'
  | 'TRANSFER_IN'
  | 'TRANSFER_OUT'
  | 'FEE'
  | 'UNKNOWN';

export interface RawTransaction {
  id: string;
  sourceAccount: string;
  timestamp: Date;
  rawType: string;
  normalizedType: RawTransactionType;
  asset: string;
  amount: number;
  feeAsset?: string;
  feeAmount?: number;
  counterAsset?: string;
  counterAmount?: number;
  txHash?: string;
  address?: string;
  notes?: string;
  rawRow: Record<string, string>;
}

export type EconomicClassification =
  | 'ACQUISITION'    // Purchase or received payment
  | 'DISPOSAL'       // Sold for fiat or swapped away
  | 'INTERNAL_MOVE'  // Transfer between own accounts (non-taxable custody move)
  | 'FEE_EXPENSE'    // Network or exchange fee
  | 'UNRESOLVED';    // Requires human decision

export interface ProvenanceNode {
  originSource: string;
  acquiredAt: Date;
  asset: string;
  amount: number;
  acquisitionType: 'BUY' | 'EXTERNAL_DEPOSIT' | 'INITIAL_BALANCE';
}

export interface ReconciledMovement {
  id: string;
  timestamp: Date;
  fromAccount?: string;
  toAccount?: string;
  asset: string;
  amount: number;
  feeAsset?: string;
  feeAmount?: number;
  classification: EconomicClassification;
  isInternal: boolean;
  sourceEventIds: string[];
  txHash?: string;
  notes?: string;
  provenance: ProvenanceNode[];
  requiresHumanReview: boolean;
  reviewReason?: string;
}

export interface AccountBalance {
  account: string;
  asset: string;
  balance: number;
}

export interface ReconciliationOptions {
  /** Time window tolerance in minutes to match withdrawals and deposits (default: 120 min) */
  timeWindowMinutes?: number;
  /** Acceptable fee discrepancy tolerance percentage (default: 0.05 = 5%) */
  feeToleranceRatio?: number;
  /** Default account name if not specified in CSV */
  defaultAccount?: string;
}

export interface ReconciliationReport {
  generatedAt: string;
  sourceFiles: string[];
  totalRawEvents: number;
  totalReconciledMovements: number;
  internalTransfersCount: number;
  economicTransactionsCount: number;
  requiresReviewCount: number;
  balances: {
    byAccount: Record<string, Record<string, number>>;
    aggregated: Record<string, number>;
  };
  unresolvedIssues: Array<{
    eventId: string;
    account: string;
    timestamp: string;
    asset: string;
    amount: number;
    reason: string;
    severity: 'warning' | 'info';
  }>;
  movements: ReconciledMovement[];
}
