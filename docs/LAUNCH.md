# Launch Checklist & Promotion — CryptoLedger (v1.0.0)

## Pre-Launch Verification

- [x] Full test suite passes (`npm test`) — 15/15 unit and integration tests
- [x] Typecheck clean (`npm run typecheck`)
- [x] Build passes (`npm run build`)
- [x] Core size guard strictly under 1,500 non-empty LOC
- [x] Sample datasets included with verifiable outputs (`npm run demo`)
- [x] Dual-language documentation (`README.md`, `README.it.md`)
- [x] License and attribution: Apache-2.0 (`LICENSE`, `NOTICE`, `LICENSING.md`)
- [x] Funding and sponsorships configured (`.github/FUNDING.yml`)
- [x] CI action configured (`.github/workflows/ci.yml`)

## Launch Drafts

### Show HN
**Title:** Show HN: CryptoLedger – Local-first crypto transaction reconciler (zero cloud leakage)

**Body:**
> Hey HN, I built CryptoLedger because reconstructing cryptocurrency movements between centralized exchanges (Binance, Kraken, Coinbase) and hardware wallets (Ledger, Trezor) is notoriously painful. Most commercial tools require uploading your private CSVs or API keys to cloud servers, leaking your portfolio balances.
>
> CryptoLedger is a zero-dependency, local-first CLI engine that:
> 1. Ingests CSVs from multiple exchanges and self-custody wallets with auto-dialect detection.
> 2. Reconciles internal custody transfers net of network fees, so moves to cold storage aren't misclassified as taxable disposals.
> 3. Preserves asset acquisition provenance and cost basis across multi-hop hops.
> 4. Generates an interactive standalone HTML dashboard, clean unified CSV ledger, or JSON.
> 5. Audits for negative balances, duplicate transactions, and high fees.
>
> Code: https://github.com/MRJonam91/CryptoLedger
> Written in modern TypeScript, zero runtime dependencies. Feedback welcome!

### Reddit (r/cryptocurrency, r/selfhosted, r/commandline)
**Title:** I built an open-source, local-first tool to reconstruct & reconcile crypto movements between exchanges and cold wallets

**Body:**
> If you have funds spread across Binance, Coinbase, Kraken, and cold storage, tracking transfers without paying subscription fees or uploading sensitive data to the cloud is tedious.
>
> CryptoLedger runs 100% offline on your machine:
> - Auto-detects exchange formats
> - Matches withdrawals with incoming deposits within time windows
> - Distinguishes internal moves from taxable trades
> - Retains acquisition origins (FIFO, LIFO, HIFO)
> - Exports clean CSVs and an interactive local HTML report
>
> GitHub: https://github.com/MRJonam91/CryptoLedger
