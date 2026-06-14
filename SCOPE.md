# SCOPE.md - Data Anomalies Log & Database Schema

This document details:
1. Every data anomaly detected in `expenses_export.csv` and our system's resolution policy.
2. The database schema in PostgreSQL.

---

## 1. CSV Data Anomalies & Handling Policies

The importer scanned `expenses_export.csv` and detected the following **19 anomalies**. Our policies balance automation (sane defaults) and user-control (approval via import wizard).

| Anomaly Type | Occurrences in CSV | Description | System Detection & Resolution Policy | User Approval Option |
| :--- | :--- | :--- | :--- | :--- |
| **Duplicate Entries** | Row 5 & 6 (Marina Bites), Row 24 & 25 (Thalassa) | Same date, description context, and similar/identical amounts. | Flagged as duplicate. Warns that Meera wants to approve deletions. Auto-flags the second entry. | User decides which row to keep, merge, or exclude. |
| **Commas in Amount** | Row 7 (Electricity Feb: `"1,200"`) | Quotes and commas inside amount column string. | Programmatically strips quotes and commas. Casts clean string to Decimal type. | None (Auto-cleaned during parse). |
| **Float Precision (Micro-cents)** | Row 10 (Cylinder refill: `899.995`) | Three decimal places in currency value. | Rounds to 2 decimal places using standard accounting rounding (`900.00`). | Editable in the wizard form if user wishes to adjust. |
| **Name Spelling Variants** | Row 11 (`Priya S`), Row 9 (`priya`), Row 27 (`rohan `) | Mismatched casing or extra letters (spelling variants). | Normalizes names programmatically by cleaning trailing spaces, casing, and aliases (`Priya S` -> `Priya`). | Shown in the wizard for confirmation. |
| **Unequal Split Parsing** | Row 12 (Aisha Birthday Cake: `Rohan 700; Priya 400; Meera 400`) | Custom splits written as strings. | Custom parser splits string by semicolons, maps names, and converts values to Decimal to create splits. | Editable in the split details input. |
| **Missing Payer** | Row 13 (House cleaning supplies: payee empty) | Blank `paid_by` cell. | Flagged as critical error. Blocks import until resolved. | User must select a valid payer from dropdown before importing. |
| **Settlement Logged as Expense** | Row 14 (Rohan paid Aisha back: 5000 INR), Row 38 (Sam deposit: 15000 INR) | Payer paid payee directly (split_type empty or single person). | Detects keyword "paid ... back" or empty split types. Flags as Settlement transaction instead of group expense. | User selects to import into Settlements table or excludes. |
| **Percentage Split Error** | Row 15 & 32 (Pizza Friday & Weekend Brunch: sum is 110%) | Percentage splits sum to > 100%. | Flags that percentage sums to 110%. normalizes it to 100% by dividing each share by 1.1. | User click 'Apply Fix' to auto-normalize, or adjusts values manually. |
| **USD Transactions** | Row 20, 21, 23, 26 | Trip expenses paid in USD. | Detects currency `USD`. Auto-proposes default exchange rate of `83.0` INR/USD. | User can edit exchange rate in input box before importing. |
| **Unknown/Temporary Member** | Row 23 (Parasailing: includes `Dev's friend Kabir`) | Kabir is not a permanent flatmate. | Detects that Kabir is not a group member. Prompts user for resolution policy. | Policy: Kabir's share is auto-allocated or Kabir is created as temporary member. |
| **Negative Amount (Refund)** | Row 26 (Parasailing refund: `-30`) | Negative cell values. | Detects negative number, flags as refund, splits using negative shares (reduces owed balances). | None (Imported as negative splits). |
| **Unparseable Date Format** | Row 27 (Airport cab: `Mar-14`) | Date missing year, format is `MMM-DD`. | Tries custom regex formats. Maps `Mar-14` to `14-03-2026` (year of Goa trip). | Editable in date input field. |
| **Missing Currency** | Row 28 (Groceries DMart: currency empty) | Blank currency column. | Detects empty field, defaults to `INR` and flags. | User can select currency from dropdown. |
| **Zero Amount Entry** | Row 31 (Swiggy order: amount 0) | Zero amount expense. | Flags zero amount, sets row to 'Exclude' by default. | User can toggle to include or ignore. |
| **Ambiguous Date** | Row 34 (Deep cleaning: `04-05-2026`) | interpretations as May 4 (DD-MM) or April 5 (MM-DD). | Checks chronological context (between March 28 and April 1). Resolves to April 5, 2026. | User confirms date in date input field. |
| **Share-based splits** | Row 35 (April Rent: `Aisha 2; Rohan 1; Priya 1`) | Split type is `share`. | Parses shares, sums them (4), and allocates amounts proportionally (Aisha 2/4, Rohan 1/4, Priya 1/4). | Editable in split details field. |
| **Inactive Member Split** | Row 36 (Groceries: includes Meera on April 2) | Meera in split after moving out (March 31). | Boundary check: detects Meera inactive on date. Proposes removing her and re-splitting among active members. | User clicks 'Apply Fix' to re-split, or overrides. |
| **Conflicting Split Details** | Row 42 (Furniture: split_type equal, but has details) | Redundant details for equal splits. | Flags redundant split details. Normalizes split type to equal. | User confirms equal split type. |
| **Double commas in split_with** | Row 9 (Movie night snacks: `Aisha;Rohan;Priya;;`) | Duplicate separators or empty splits. | Cleans split list, removes empty strings and duplicate usernames. | Shown in the splits input field. |

---

## 2. PostgreSQL Relational Database Schema

We use PostgreSQL for all relational storage. All balances are calculated dynamically from this schema.

### Profile Table
Stores display names linked to system auth users.
- `id` (serial, Primary Key)
- `user_id` (integer, ForeignKey to auth_user, Unique)
- `display_name` (varchar(100))

### Group Table
Represents flatmate expense groups.
- `id` (serial, Primary Key)
- `name` (varchar(100))
- `created_at` (timestamp)

### GroupMembership Table
Manages active member durations for date validation rules.
- `id` (serial, Primary Key)
- `group_id` (integer, ForeignKey to Group)
- `user_id` (integer, ForeignKey to auth_user)
- `joined_date` (date)
- `left_date` (date, nullable)
- **Constraints**: `unique_together(group_id, user_id)`

### Expense Table
Stores details of group expenses (supporting both INR and USD).
- `id` (serial, Primary Key)
- `group_id` (integer, ForeignKey to Group)
- `description` (varchar(255))
- `paid_by_id` (integer, ForeignKey to auth_user)
- `created_by_id` (integer, ForeignKey to auth_user, audit trail)
- `amount` (numeric(12,4)) - Amount in original currency
- `currency` (varchar(3)) - Currency code (e.g. INR, USD)
- `exchange_rate` (numeric(10,4)) - Exchange rate to INR (1.0 for INR)
- `amount_in_inr` (numeric(12,4)) - Converted amount in INR
- `split_type` (varchar(20)) - equal, unequal, percentage, share
- `date` (date)
- `notes` (text, nullable)
- `created_at` (timestamp)

### ExpenseSplit Table
Stores the calculated share each user owes for an expense.
- `id` (serial, Primary Key)
- `expense_id` (integer, ForeignKey to Expense)
- `user_id` (integer, ForeignKey to auth_user)
- `share_amount` (numeric(12,4)) - Owed share in original currency
- `share_amount_in_inr` (numeric(12,4)) - Owed share in INR
- `split_value` (varchar(50)) - Original raw split value ("30%", "2 shares")
- **Constraints**: `unique_together(expense_id, user_id)`

### Settlement Table
Logs direct payments made between flatmates.
- `id` (serial, Primary Key)
- `group_id` (integer, ForeignKey to Group)
- `payer_id` (integer, ForeignKey to auth_user) - person paying
- `payee_id` (integer, ForeignKey to auth_user) - person receiving
- `amount` (numeric(12,4)) - Amount in INR
- `date` (date)
- `notes` (text, nullable)
- `created_at` (timestamp)

### ImportReport Table
Logs the history of CSV imports and resolutions for auditing.
- `id` (serial, Primary Key)
- `group_id` (integer, ForeignKey to Group)
- `imported_at` (timestamp)
- `log_data` (jsonb) - Logs of parsed rows, anomalies, and resolutions
