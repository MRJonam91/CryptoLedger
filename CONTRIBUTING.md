# Contributing to CryptoLedger / Contribuire a CryptoLedger

## 🇮🇹 Come contribuire

1. **DCO**: firma i tuoi commit con `git commit -s` (Developer Certificate of Origin).
2. **Core compatto**: il core in `src/core/` deve rimanere rigorosamente sotto le 1.500 righe di codice (verificato in CI).
3. **SPDX Header**: inserisci `// SPDX-License-Identifier: Apache-2.0` in cima a ogni file sorgente TypeScript.
4. **Zero runtime dependencies**: preserviamo il design a zero dipendenze esterne a runtime per massima sicurezza locale.
5. **Test**: scrivi unit test in `test/` usando il runner nativo Node (`node --test`).
6. **Typecheck**: verifica i tipi con `npm run typecheck`.

## 🇬🇧 How to contribute

1. **DCO**: sign your commits using `git commit -s` (Developer Certificate of Origin).
2. **Compact core**: the core engine under `src/core/` must strictly stay below 1,500 lines of code (enforced by CI).
3. **SPDX Header**: include `// SPDX-License-Identifier: Apache-2.0` at the top of each TypeScript source file.
4. **Zero runtime dependencies**: maintain zero third-party runtime dependencies for local security.
5. **Tests**: include tests under `test/` using Node's native test runner (`node --test`).
6. **Typecheck**: confirm clean compilation with `npm run typecheck`.
