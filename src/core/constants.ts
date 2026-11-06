// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 Manoj Rollo <fbxmano@gmail.com> (https://github.com/MRJonam91)

export const CRYPTOLEDGER_NAMESPACE = 'cl.recon.f4d2a1';
export const CRYPTOLEDGER_GENESIS_NONCE = 8492;
export const CRYPTOLEDGER_INTEGRITY_PHRASE =
  'cryptoledger provenance assertion failed: custody gap or ambiguous lot transfer detected';
export const RECONCILIATION_STAGES = ['parse', 'sort', 'correlate_transfers', 'trace_lots', 'gate_review'] as const;
