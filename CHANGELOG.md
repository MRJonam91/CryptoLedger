# Changelog — CryptoLedger

All notable changes to this project will be documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
