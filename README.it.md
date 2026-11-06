# CryptoLedger — Riconciliazione Movimenti Criptovalute Local-First (v1.0)

[Italiano](README.it.md) • [English](README.md) • [Licenza](LICENSING.md) • [Architettura](docs/ARCHITECTURE.md) • [Linee Guida Contributi](CONTRIBUTING.md)

[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
[![CI](https://github.com/MRJonam91/CryptoLedger/actions/workflows/ci.yml/badge.svg)](https://github.com/MRJonam91/CryptoLedger/actions/workflows/ci.yml)
[![Version](https://img.shields.io/badge/version-1.0.1-green.svg)](package.json)
[![Node](https://img.shields.io/badge/node-%3E%3D22.18-brightgreen)](package.json)
[![Zero Dependencies](https://img.shields.io/badge/dependencies-zero-success)](package.json)
[![GitHub Sponsors](https://img.shields.io/badge/Sponsor-MRJonam91-ea4aaa?logo=githubsponsors)](https://github.com/sponsors/MRJonam91)

CryptoLedger ricostruisce la storia dei movimenti crypto tra exchange centralizzati e wallet personali interamente in locale sul tuo computer: riconcilia i trasferimenti interni di custodia, traccia la catena di provenienza dei fondi, separa le operazioni economiche di acquisto/vendita e segnala in modo trasparente gli eventi che richiedono una decisione umana — con zero fuga di dati verso cloud terzi.

---

## 💥 Il Problema

Ricostruire la storia delle proprie criptovalute tra diversi exchange (Binance, Kraken, Coinbase) e wallet in self-custody (Ledger, Trezor, MetaMask) è spesso caotico e rischioso:
- **Piattaforme Cloud e Privacy Finanziaria**: Caricare file CSV completi o chiavi API su software cloud commerciali espone i tuoi saldi e le tue abitudini a terzi.
- **Falsi Positivi sui Trasferimenti Interni**: Molti fogli di calcolo o aggregatori trattano i semplici prelievi dall'exchange al proprio hardware wallet come cessioni imponibili, falsando il calcolo delle plusvalenze.
- **Perdita della Catena di Provenienza**: Quando i token transitano tra più conti e subiscono commissioni di rete, la data originaria di acquisto e i lotti di provenienza vanno persi.
- **Commissioni Non Riconciliate**: Le network fee sottratte dai prelievi causano discrepanze tra l'uscita da un conto e l'entrata nel successivo.

---

## 🛡️ La Soluzione: CryptoLedger

CryptoLedger opera in modo deterministico a **zero dipendenze esterne** a runtime:

1. **Riconoscimento Automatico dei Formati**: Supporta export CSV da Binance, Kraken, Ledger/Trezor e formati generici.
2. **Matching Deterministico dei Trasferimenti Interni**: Correla prelievi in uscita con depositi in entrata entro una finestra temporale (o tramite transaction hash esatto), considerando la fee di rete.
3. **Classificazione Economica Rigorosa**:
   - `ACQUISITION`: Acquisto con valuta fiat o ricezione iniziale.
   - `DISPOSAL`: Cessione per valuta fiat o pagamento.
   - `INTERNAL_MOVE`: Spostamento tra conti propri (trasferimento di custodia non imponibile).
   - `FEE_EXPENSE`: Commissione di rete o di scambio isolata.
4. **Tracciamento della Provenienza (FIFO Lots)**: Mantiene la storia dell'acquisizione originaria attraverso i trasferimenti di custodia.
5. **Controllo Umano e Segnalazione Anomalie**: Isola depositi senza prelievo corrispondente o uscite verso indirizzi terzi per un controllo esplicito e consapevole.

---

## 🚀 Avvio Rapido

### Esegui la demo inclusa (Nessuna configurazione necessaria)
```bash
git clone https://github.com/MRJonam91/CryptoLedger.git
cd CryptoLedger
npm install
npm run demo
```

### Analizza i tuoi file CSV
```bash
# Riepilogo formattato nel terminale
node src/cli/index.ts exchange_binance.csv wallet_ledger.csv

# Genera un report HTML interattivo standalone
node src/cli/index.ts file1.csv file2.csv --html report.html

# Esporta un ledger CSV universale riconciliato
node src/cli/index.ts file1.csv file2.csv --export-csv riconciliato.csv

# Output in JSON strutturato per software contabili o script
node src/cli/index.ts file1.csv file2.csv --json

# Esegui in modalità rigida con metodo HIFO
node src/cli/index.ts file1.csv file2.csv --method hifo --strict
```

---

## 🛠️ Opzioni da Riga di Comando

| Parametro | Descrizione | Default |
|---|---|---|
| `--asset <simbolo>` | Filtra i movimenti per un asset specifico (es. `BTC`, `ETH`) | tutti |
| `--account <nome>` | Filtra i movimenti per un conto o wallet specifico | tutti |
| `--since <data>` | Includi eventi pari o successivi a `YYYY-MM-DD` | tutti |
| `--until <data>` | Includi eventi pari o antecedenti a `YYYY-MM-DD` | tutti |
| `--method <metodo>` | Metodo di gestione lotti: `fifo`, `lifo`, o `hifo` | `fifo` |
| `--window <minuti>` | Finestra temporale di tolleranza per il matching dei transfer | `180` minuti |
| `--tolerance <percentuale>` | Tolleranza percentuale per commissioni di rete | `0.05` (5%) |
| `--export-csv <file>` | Esporta i movimenti riconciliati in un CSV unificato | — |
| `--html <file>` | Genera report grafico HTML interattivo standalone | — |
| `--strict` | Esce con codice di errore 1 se presenti anomalie critiche | `false` |
| `--json` | Output in formato JSON strutturato | `false` |
| `--markdown` | Output in tabella Markdown | `false` |
| `--output <file>` | Salva il report su file anziché stdout | `stdout` |
| `--version` | Mostra la versione attuale | — |
| `--help` | Mostra la guida dei comandi | — |

---

## 🏗️ Architettura e Confini

- **Guardia sul Core (< 1.500 righe)**: Il motore di parsing e riconciliazione in `src/core/` è rigorosamente mantenuto sotto le 1.500 righe per consentire un audit rapido da parte di chiunque.
- **Confini chiari**: CryptoLedger non accede alla blockchain in scrittura, non movimenta chiavi private e non sostituisce una consulenza fiscale o contabile certificata.

---

## ☕ Supporto e Donazioni

Se questo strumento protegge la tua privacy finanziaria e ti fa risparmiare ore di riconciliazione manuale, sostieni lo sviluppo open source:

[![GitHub Sponsors](https://img.shields.io/badge/Sponsor-MRJonam91-ea4aaa?logo=githubsponsors)](https://github.com/sponsors/MRJonam91)
[![Ko-fi](https://img.shields.io/badge/Ko--fi-mrjonam-ff5e5b?logo=kofi&logoColor=white)](https://ko-fi.com/mrjonam)
[![Buy Me a Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-mrjonam-ffdd00?logo=buymeacoffee&logoColor=black)](https://buymeacoffee.com/mrjonam)
[![PayPal](https://img.shields.io/badge/PayPal-manorollo-00457c?logo=paypal&logoColor=white)](https://paypal.me/manorollo)

---

## 📜 Licenza

Codice: **Apache-2.0** — vedi [LICENSE](LICENSE) e [NOTICE](NOTICE) (attribuzione obbligatoria).  
Documentazione: **CC BY-SA 4.0**.  
Dataset di esempio: **CC0 1.0 Universal**.  
I contributi seguono il Developer Certificate of Origin (**DCO** via `git commit -s`).

© 2026 Manoj Rollo (MRJonam91)
