# CryptoLedger — Execution Plan & Roadmap

## 1. Problem & Verified Initial Slice (v1.0.0 Completed)

- **Problem**: Movements between exchanges and self-custody wallets are notoriously hard to reconstruct, leading to misclassified internal transfers, lost acquisition provenance, and financial privacy leaks on third-party cloud services.
- **First Verifiable Slice (Achieved)**:
  - Multi-exchange local CSV ingestion (Binance, Kraken, Coinbase, Bitstamp, Ledger, Generic).
  - Deterministic internal transfer matching (custody moves net of fees).
  - Economic vs non-taxable classification (`ACQUISITION`, `DISPOSAL`, `SWAP`, `INTERNAL_MOVE`, `FEE_EXPENSE`).
  - Provenance lot tracking preserving acquisition origin timestamps and cost basis across multi-hop custody chains.
  - Interactive standalone HTML report, universal CSV ledger export, and terminal dashboard.
  - Audit engine detecting negative balances, duplicates, and fee ratio anomalies.

## 2. Boundaries & Invariants

- **Zero Third-Party Telemetry**: 100% offline, local-first execution.
- **Read-Only**: Zero wallet write access, zero private key interaction, zero blockchain execution.
- **Tax Boundaries**: Informational cost basis and lot calculation (FIFO/LIFO/HIFO); does not provide certified legal/tax advice.
- **Core Guard**: Core reconciler kept strictly under 1,500 LOC for maximum auditability.

## 3. Future Roadmap (v1.1+)

- [ ] On-chain transaction explorer integration via public RPC for automatic hash enrichment.
- [ ] Direct export to Form 8949 / Quadro RT tax templates.
- [ ] WebAssembly / Browser sandbox bundle for client-side local drag & drop.
- [ ] Extended DEX & LP liquidity pool token accounting (Uniswap v2/v3, Curve).
