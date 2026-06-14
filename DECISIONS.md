# DECISIONS.md - System Engineering Decision Log

This document logs the significant architectural decisions, options considered, and why we chose the final implementation.

---

## Decision 1: Tech Stack & Integration Architecture
- **Options Considered**:
  1. Next.js Monolith with Prisma and Server Actions.
  2. Django backend (with django-templates) and Vanilla JS.
  3. **Vite + React (Frontend SPA) and Django + Django REST Framework (Backend REST API) [CHOSEN]**.
- **Rationale**:
  - React SPA provides a highly responsive UI with glassmorphic cards and micro-animations, enabling a premium first-impression.
  - Django REST Framework provides a mature, robust engine to handle validation, authentication, and database transactions.
  - The decoupled architecture mirrors modern production environments and allows clean division between presentation logic and relational database calculations.

---

## Decision 2: Database Engine
- **Options Considered**:
  1. SQLite3 (local file database).
  2. **PostgreSQL (relational database engine) [CHOSEN]**.
- **Rationale**:
  - PostgreSQL is a production-grade relational database engine that supports concurrent connections and row-locking transactions.
  - Using PostgreSQL matches the candidate requirements for deployment and allows the use of `JSONB` fields (via Django's `JSONField` mapping) in our `ImportReport` model, which makes audit logs easily queryable.

---

## Decision 3: CSV Import Workflow
- **Options Considered**:
  1. **Two-Step Import (Parse & Scan API → User Audit/Edit UI → Confirm/Commit API) [CHOSEN]**.
  2. Single-Step Auto-import (backend auto-resolves all 19 anomalies silently and reports).
- **Rationale**:
  - Meera explicitly requested to *approve* anything the app changes or deletes. A single-step auto-import fails this requirement.
  - The two-step parse-and-confirm process surfaces all detected anomalies with flags (warning badges) in the UI, lets the user interactively change/fix values or exclude rows, and commits the finalized transactions in a single transaction block.

---

## Decision 4: Currency & Exchange Rate Policy
- **Options Considered**:
  1. Multi-currency balances (calculating separate USD and INR balances).
  2. **Dual-amount Storage with Single-Currency Net Settlement (INR) [CHOSEN]**.
- **Rationale**:
  - Priya complained that the spreadsheet "pretends a dollar is a rupee". We must apply an exchange rate.
  - Managing separate USD and INR balances is confusing for flatmates living together in India.
  - We store both the original currency/amount and the exchange rate used, but compute and settle everything in **INR**.
  - We default the Goa trip USD transactions to a historical exchange rate of **1 USD = 83.0 INR** (approximate rate in March 2026), but allow the user to adjust the rate in the import screen.

---

## Decision 5: Membership-Aware Group Splits
- **Options Considered**:
  1. Global split (always split equally among all members regardless of date).
  2. **Membership Date Boundary Enforcements [CHOSEN]**.
- **Rationale**:
  - Sam joined in mid-April and should not be charged for March electricity. Meera left on March 31 and should not owe for April groceries.
  - We implemented active date bounds (`joined_date` and `left_date`) on `GroupMembership`.
  - When calculating splits or importing, if an expense occurs outside a member's active membership range, they are **excluded from the split entirely** and the amount is divided among the remaining active members. This perfectly resolves Sam's, Meera's, and Priya's edge cases.

---

## Decision 6: Debt Minimization Algorithm
- **Options Considered**:
  1. Pairwise settlement (reproducing every debt directly, e.g., Rohan owes Priya, Meera owes Aisha, etc.).
  2. **Greedy Flow Directed Settlement Minimization (Simplify Debts) [CHOSEN]**.
- **Rationale**:
  - Aisha requested "one number per person. Who pays whom, how much, done".
  - We use a greedy matching algorithm: sort net balances, match the largest debtor with the largest creditor, settle, and recurse.
  - This minimizes the overall transaction count, transforming a messy network of debts into a clean, simple list of directed payments.
