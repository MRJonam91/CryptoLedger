# Changelog — CryptoLedger

All notable changes to this project will be documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.0-beta] - 2026-11-06

### Added
- **Diagnostic Anomaly Engine**: Automatic real-time audit flagging:
  - Critical **Negative Balances** (untracked outflows exceeding known deposits).
  - **Duplicate Transaction Hashes & Signatures** preventing double counting from re-imports.
  - **High Fee Ratio Warnings** (>50% transfer fee anomaly detection).
- **HIFO Inventory Valuation**: Added Highest-In, First-Out (`--method hifo`) lot matching to minimize taxable gains alongside FIFO and LIFO.
- **Universal Reconciled CSV Export (`--export-csv <file>`)**: Clean tabular ledger with custody classification, normalized amounts, fee netting, and provenance.
- **Standalone Interactive HTML Dashboard (`--html <file>`)**: Local-only, zero-dependency visual report with account balance grids, color-coded status badges, and expandable audit rows.
- **Strict Pipeline Mode (`--strict`)**: Non-zero exit code for CI/CD or automated verification scripts if critical anomalies or unresolved reviews exist.
- **Expanded Test Suite**: 15 comprehensive unit and integration tests passing natively.

## [0.2.0-alpha] - 2026-11-06

### Added
- **Coinbase & Bitstamp Parsers**: Built-in autodetect and ingestion for Coinbase Pro and Bitstamp exports, with automatic currency sign scrubbing and european rate formatting (`1.250,50 €`).
- **Precision Decimal Engine (`math.ts`)**: Safe arithmetic eliminating IEEE-754 floating-point creep on micro-amounts (satoshi/wei).
- **Crypto-to-Crypto Swaps**: Direct support for asset swaps with automatic counter-asset balance tracking.
- **Cost Basis & Provenance Preservation**: Cost basis tracking across multiple internal custody hops (Exchange A -> Ledger Wallet -> Exchange B), enabling informational realized P&L estimation without compromising tax boundaries.
- **Advanced CLI Filters**: Added `--asset`, `--account`, `--since`, `--until`, and `--method <fifo|lifo>`.
- **Extended Test Suite**: 12 unit and integration tests covering multi-hop custody transfer, exchange dialect matching, and precision edge cases.

## [0.1.0] - 2026-11-06

### Added
- Initial MVP release of CryptoLedger.
- Local CSV parsing with autodetect for exchange exports (Binance, Kraken, generic tabular).
- Reconciliation engine matching internal withdrawals and deposits across accounts.
- Distinguishes internal transfers (non-taxable custody moves) from economic events (buys, sells, swaps).
- Provenance lot tracking calculating running balances and asset origin chains.
- Human review flag system highlighting ambiguous timestamps or unmatched deposits.
- Interactive CLI with formatted terminal output, JSON schema, and Markdown exports.
- Sample verifiable test fixtures (`exchange_alpha.csv` and `wallet_ledger.csv`).
- Full bilingual documentation (IT/EN) and GitHub CI automation.
