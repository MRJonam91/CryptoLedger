# CryptoLedger — Local-First Cryptocurrency Movement Reconciler

[Italiano](README.it.md) • [English](README.md) • [Licensing](LICENSING.md) • [Contributing](CONTRIBUTING.md)

[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
[![CI](https://github.com/MRJonam91/CryptoLedger/actions/workflows/ci.yml/badge.svg)](https://github.com/MRJonam91/CryptoLedger/actions/workflows/ci.yml)
[![Node](https://img.shields.io/badge/node-%3E%3D22.18-brightgreen)](package.json)
[![Zero Dependencies](https://img.shields.io/badge/dependencies-zero-success)](package.json)
[![GitHub Sponsors](https://img.shields.io/badge/Sponsor-MRJonam91-ea4aaa?logo=githubsponsors)](https://github.com/sponsors/MRJonam91)

CryptoLedger reconstructs cryptocurrency movements across centralized exchanges and self-custody wallets locally on your machine. It correlates internal custody transfers, preserves end-to-end asset acquisition provenance, isolates taxable economic transactions, and flags unmatched operations requiring human decisions — with zero cloud leakage and zero API key exposure.

---

## 💥 The Problem

Tracking cryptocurrency transactions across multiple exchanges (Binance, Kraken, Coinbase) and on-chain wallets (Ledger, Trezor, MetaMask) is notoriously fragmented and privacy-invasive:
- **Cloud Tax Portals Expose Balances**: Uploading raw CSVs or API keys to third-party cloud services compromises your financial privacy.
- **Misclassified Internal Transfers**: Naive spreadsheets or aggregators often flag transfers between your own exchange account and hardware wallet as taxable sales or disposals.
- **Broken Provenance & Lot Trails**: When assets are moved across accounts and fees are subtracted, origin timestamps and cost lots get lost.
- **Hidden Network Fees & Slippage**: Network gas and withdrawal fees skew account balances if not reconciled net of transfers.

---

## 🛡️ The Solution: CryptoLedger

CryptoLedger runs completely locally and deterministically with **zero third-party dependencies**:

1. **Automatic Format Autodetection**: Ingests CSV exports from Binance, Kraken, Ledger/Trezor, and generic tabular logs.
2. **Deterministic Internal Transfer Matching**: Pairs outbound withdrawals with inbound deposits within configurable time windows (or exact tx hashes) while accounting for network fees.
3. **Strict Economic Classification**:
   - `ACQUISITION`: Fiat purchases or inbound gifts.
   - `DISPOSAL`: Sales for fiat or outbound payments.
   - `INTERNAL_MOVE`: Transfers between accounts belonging to you (non-taxable custody moves).
   - `FEE_EXPENSE`: Standalone network or exchange trading fees.
4. **Acquisition Provenance Tracking**: Preserves acquisition origins and dates through transfer chains using lot reconciliation.
5. **Human Review Gate**: Automatically isolates unmatched deposits, unmonitored recipient addresses, or ambiguous timestamps for explicit human verification.

---

## 🚀 Quick Start

### Run the bundled demo (Zero configuration)
```bash
git clone https://github.com/MRJonam91/CryptoLedger.git
cd CryptoLedger
npm install
npm run demo
```

### Analyze your own CSV files
```bash
# Terminal formatted overview
node src/cli/index.ts exchange_binance.csv wallet_ledger.csv

# Generate an interactive standalone HTML report
node src/cli/index.ts file1.csv file2.csv --html report.html

# Export a clean universal CSV ledger
node src/cli/index.ts file1.csv file2.csv --export-csv reconciled.csv

# Output structured JSON for downstream tax or audit tools
node src/cli/index.ts file1.csv file2.csv --json

# Run in strict mode with HIFO lot valuation
node src/cli/index.ts file1.csv file2.csv --method hifo --strict
```

---

## 📊 Sample Output

```text
═════════════════════════════════════════════════════════════════
  CryptoLedger — Reconciliation & Provenance Report
═════════════════════════════════════════════════════════════════
  Generated: 2026-11-06T16:11:17.760Z
  Sources:   exchange_alpha.csv (binance), wallet_ledger.csv (ledger_wallet)
─────────────────────────────────────────────────────────────────

📊 SUMMARY
  • Raw Events Processed:        6
  • Reconciled Movements:        5
  • Internal Transfers Matched:  1 (non-economic custody moves)
  • Economic Trades (Buy/Sell):  3
  • Pending Human Reviews:       1

💰 ACCOUNT BALANCES
  [ExchangeAlpha]
    • BTC      0.05000000
    • ETH      1.50000000
  [wallet_ledger]
    • BTC      0.14950000

🌐 CONSOLIDATED PORTFOLIO BALANCES
    • BTC      0.19950000
    • ETH      1.50000000

🔄 RECONCILED MOVEMENTS (Sample & Chronology)
   1. 2026-01-10 09:00:00 [ACQUISITION]    0.25 BTC (EXTERNAL -> ExchangeAlpha)
      ↳ Provenance: ExchangeAlpha on 2026-01-10
   2. 2026-01-10 09:05:00 [ACQUISITION]    2.5 ETH (EXTERNAL -> ExchangeAlpha)
      ↳ Provenance: ExchangeAlpha on 2026-01-10
   3. 2026-01-15 13:30:00 [INTERNAL MOVE]  0.1995 BTC (ExchangeAlpha -> wallet_ledger)
      ↳ Provenance: ExchangeAlpha on 2026-01-10
   4. 2026-01-20 08:00:00 [DISPOSAL]       1 ETH (ExchangeAlpha -> EXTERNAL)
      ↳ Provenance: ExchangeAlpha on 2026-01-10
   5. 2026-02-01 10:20:00 [UNRESOLVED]     0.05 BTC (wallet_ledger -> EXTERNAL)
      ⚠️ REVIEW: Withdrawal of 0.05 BTC from wallet_ledger not matched with any internal deposit.

⚠️  ACTION REQUIRED: HUMAN REVIEW
  [1] Account: wallet_ledger | 0.05 BTC at 2026-02-01T10:20:00.000Z
      Reason: Withdrawal of 0.05 BTC not matched with any internal deposit.
─────────────────────────────────────────────────────────────────
```

---

## 🛠️ CLI Options

| Flag | Description | Default |
|---|---|---|
| `--asset <symbol>` | Filter movements for a specific asset (e.g. `BTC`, `ETH`) | all |
| `--account <name>` | Filter movements involving a specific account or wallet | all |
| `--since <date>` | Include events on or after `YYYY-MM-DD` | all |
| `--until <date>` | Include events on or before `YYYY-MM-DD` | all |
| `--method <method>` | Inventory lot valuation method: `fifo`, `lifo`, or `hifo` | `fifo` |
| `--window <minutes>` | Reconciliation time window tolerance | `180` minutes |
| `--tolerance <pct>` | Network fee discrepancy ratio tolerance | `0.05` (5%) |
| `--export-csv <file>` | Export reconciled movements to unified CSV ledger | — |
| `--html <file>` | Generate standalone interactive HTML report | — |
| `--strict` | Exit with error code 1 if critical anomalies or unresolved reviews occur | `false` |
| `--json` | Print structured JSON report | `false` |
| `--markdown` | Format report as GitHub-flavored Markdown | `false` |
| `--output <file>` | Write report directly to file | `stdout` |
| `--version` | Display version information | — |
| `--help` | Display command usage and flags | — |

---

## 🏗️ Architecture & Boundaries

- **Core Codebase Guard**: The reconciliation engine in `src/core/` is kept strictly under 1,500 lines of code to remain easily auditable.
- **Boundaries**: CryptoLedger does not write to the blockchain, does not execute transactions, and does not replace official certified tax advice.

---

## ☕ Support & Donations

If this project helps protect your financial privacy and clarifies your crypto records, please consider supporting development:

[![GitHub Sponsors](https://img.shields.io/badge/Sponsor-MRJonam91-ea4aaa?logo=githubsponsors)](https://github.com/sponsors/MRJonam91)
[![Ko-fi](https://img.shields.io/badge/Ko--fi-mrjonam-ff5e5b?logo=kofi&logoColor=white)](https://ko-fi.com/mrjonam)
[![Buy Me a Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-mrjonam-ffdd00?logo=buymeacoffee&logoColor=black)](https://buymeacoffee.com/mrjonam)
[![PayPal](https://img.shields.io/badge/PayPal-manorollo-00457c?logo=paypal&logoColor=white)](https://paypal.me/manorollo)

---

## 📜 License

Code: **Apache-2.0** — see [LICENSE](LICENSE) and [NOTICE](NOTICE).  
Documentation: **CC BY-SA 4.0**.  
Sample Fixtures: **CC0 1.0 Universal**.  
Contributions follow the **DCO** (`git commit -s`).

© 2026 Manoj Rollo (MRJonam91)
