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
  spotPrice?: number;
  totalFiat?: number;
  fiatCurrency?: string;
  txHash?: string;
  address?: string;
  notes?: string;
  rawRow: Record<string, string>;
}

export type EconomicClassification =
  | 'ACQUISITION'    // Purchase or received payment
  | 'DISPOSAL'       // Sold for fiat or external transfer out
  | 'SWAP'           // Crypto-to-crypto trade
  | 'INTERNAL_MOVE'  // Transfer between own accounts (non-taxable custody move)
  | 'FEE_EXPENSE'    // Network or exchange fee
  | 'UNRESOLVED';    // Requires human decision

export interface ProvenanceNode {
  originSource: string;
  acquiredAt: Date;
  asset: string;
  amount: number;
  acquisitionType: 'BUY' | 'SWAP' | 'EXTERNAL_DEPOSIT' | 'INITIAL_BALANCE';
  costBasisFiat?: number;
  fiatCurrency?: string;
}

export interface ReconciledMovement {
  id: string;
  timestamp: Date;
  fromAccount?: string;
  toAccount?: string;
  asset: string;
  amount: number;
  counterAsset?: string;
  counterAmount?: number;
  feeAsset?: string;
  feeAmount?: number;
  spotPrice?: number;
  totalFiat?: number;
  fiatCurrency?: string;
  classification: EconomicClassification;
  isInternal: boolean;
  sourceEventIds: string[];
  txHash?: string;
  notes?: string;
  provenance: ProvenanceNode[];
  costBasisFiat?: number;
  gainLossFiat?: number;
  requiresHumanReview: boolean;
  reviewReason?: string;
}

export interface AccountBalance {
  account: string;
  asset: string;
  balance: number;
}

export type AnomalyType =
  | 'NEGATIVE_BALANCE'
  | 'DUPLICATE_TX'
  | 'HIGH_FEE_RATIO'
  | 'CLOCK_SKEW'
  | 'CUSTODY_GAP';

export interface LedgerAnomaly {
  type: AnomalyType;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  account?: string;
  asset?: string;
  timestamp?: string;
  relatedEventIds?: string[];
}

export interface ReconciliationOptions {
  /** Time window tolerance in minutes to match withdrawals and deposits (default: 180 min) */
  timeWindowMinutes?: number;
  /** Acceptable fee discrepancy tolerance percentage (default: 0.05 = 5%) */
  feeToleranceRatio?: number;
  /** Default account name if not specified in CSV */
  defaultAccount?: string;
  /** Filter results by asset symbol (e.g. BTC) */
  assetFilter?: string;
  /** Filter results by account/wallet name */
  accountFilter?: string;
  /** Filter movements occurring on or after this date */
  since?: Date;
  /** Filter movements occurring on or before this date */
  until?: Date;
  /** Inventory valuation method for cost basis and provenance (default: FIFO) */
  inventoryMethod?: 'FIFO' | 'LIFO' | 'HIFO';
}

export interface ReconciliationReport {
  generatedAt: string;
  sourceFiles: string[];
  totalRawEvents: number;
  totalReconciledMovements: number;
  internalTransfersCount: number;
  economicTransactionsCount: number;
  swapsCount: number;
  requiresReviewCount: number;
  realizedGainLoss: {
    totalFiat: number;
    fiatCurrency: string;
    hasEstimatedGains: boolean;
  };
  balances: {
    byAccount: Record<string, Record<string, number>>;
    aggregated: Record<string, number>;
  };
  anomalies: LedgerAnomaly[];
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
