# Changelog — CryptoLedger

All notable changes to this project will be documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
