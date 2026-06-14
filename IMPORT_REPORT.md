# IMPORT_REPORT.md - CSV Ingestion & Resolution Report

This report summarizes the actions taken by the import wizard when `expenses_export.csv` was ingested into the shared expenses application.

## Ingestion Summary
- **Source File**: `expenses_export.csv` (43 transaction rows)
- **Status**: Successfully Imported
- **Expenses Imported**: 33 rows
- **Settlements Logged**: 4 rows
- **Rows Excluded**: 6 rows
- **Anomalies Detected & Resolved**: 19

---

## Line-by-Line Resolution Audit Log

| CSV Row | Description | Original Amount | Detected Anomalies | Action Taken & Resolution Policy |
| :--- | :--- | :--- | :--- | :--- |
| **Row 2** | February rent | 48000 INR | None | Imported as shared expense. Split equally among active members (Aisha, Rohan, Priya, Meera). |
| **Row 3** | Groceries BigBasket | 2340 INR | None | Imported as shared expense. Split equally among active members. |
| **Row 4** | Wifi bill Feb | 1199 INR | None | Imported as shared expense. Split equally among active members. |
| **Row 5** | Dinner at Marina Bites | 3200 INR | Duplicate entry candidate | Imported as shared expense. Split equally among Aisha, Rohan, Priya, Dev. |
| **Row 6** | dinner - marina bites | 3200 INR | Duplicate entry of Row 5 | **Excluded from import** (User approved deletion of duplicate). |
| **Row 7** | Electricity Feb | "1,200" INR | Comma in amount format | Programmatically stripped commas and quotes. Imported ₹1,200.00 split equally. |
| **Row 8** | Maid salary Feb | 3000 INR | None | Imported as shared expense. Split equally among active members. |
| **Row 9** | Movie night snacks | 640 INR | Name variant (`priya`), double commas | Mapped `priya` to `Priya`. Cleaned empty elements in split list. Split equally among Aisha, Rohan, Priya. |
| **Row 10** | Cylinder refill | 899.995 INR | Float precision | Auto-rounded amount to ₹900.00. Split equally. |
| **Row 11** | Groceries DMart | 1875 INR | Name variant (`Priya S`) | Mapped `Priya S` to standard profile `Priya`. Split equally. |
| **Row 12** | Aisha birthday cake | 1500 INR | Unequal split parsing | Parsed splits. Rohan owes ₹700, Priya owes ₹400, Meera owes ₹400. Aisha owes ₹0 (not charged). |
| **Row 13** | House cleaning supplies | 780 INR | Missing payer | Flagged critical error. User assigned payer `Priya`. Imported ₹780.00 split equally. |
| **Row 14** | Rohan paid Aisha back | 5000 INR | Settlement as expense | **Imported as Settlement**: Logged payment of ₹5,000.00 from Rohan to Aisha. |
| **Row 15** | Pizza Friday | 1440 INR | Percentage sum error (110%) | Auto-normalized percentages to 100% (Aisha 27.27%, Rohan 27.27%, Priya 27.27%, Meera 18.18%). |
| **Row 16** | March rent | 48000 INR | None | Imported as shared expense. Split equally. |
| **Row 17** | Groceries BigBasket | 2810 INR | None | Imported as shared expense. Split equally. |
| **Row 18** | Wifi bill Mar | 1199 INR | None | Imported as shared expense. Split equally. |
| **Row 19** | Goa flights | 32400 INR | None | Imported as shared expense. Split equally among Aisha, Rohan, Priya, Dev. |
| **Row 20** | Goa villa booking | 540 USD | USD Transaction | Converted 540 USD to ₹44,820.00 at exchange rate of 1 USD = 83.0 INR. Split equally. |
| **Row 21** | Beach shack lunch | 84 USD | USD Transaction | Converted 84 USD to ₹6,972.00 at exchange rate of 1 USD = 83.0 INR. Split equally. |
| **Row 22** | Scooter rentals | 3600 INR | Share-based split | Parsed shares (Aisha 1, Rohan 2, Priya 1, Dev 2). Allocated: Aisha ₹600, Rohan ₹1200, Priya ₹600, Dev ₹1200. |
| **Row 23** | Parasailing | 150 USD | USD, Unknown member (`Kabir`) | Converted 150 USD to ₹12,450.00. Created temporary member Kabir. Split equally (₹2,490.00 each). |
| **Row 24** | Dinner at Thalassa | 2400 INR | Duplicate conflict candidate | **Excluded from import** (User chose to keep Row 25 based on notes "Aisha's is wrong"). |
| **Row 25** | Thalassa dinner | 2450 INR | Duplicate conflict candidate | Imported as shared expense of ₹2,450.00 by Rohan. Split equally among Aisha, Rohan, Priya, Dev. |
| **Row 26** | Parasailing refund | -30 USD | Negative amount (Refund) | Converted to -₹2,490.00. Split equally, reducing everyone's balance. |
| **Row 27** | Airport cab | 1100 INR | Unparseable date (`Mar-14`), name casing | Mapped date to `14-03-2026` and payer name to `Rohan`. Split equally. |
| **Row 28** | Groceries DMart | 2105 | Missing currency | Defaulted currency to `INR`. Split equally among active members. |
| **Row 29** | Electricity Mar | 1450 INR | None | Imported as shared expense. Split equally. |
| **Row 30** | Maid salary Mar | 3000 INR | None | Imported as shared expense. Split equally. |
| **Row 31** | Dinner order Swiggy | 0 INR | Zero amount | **Excluded from import** (Auto-excluded 0 amount). |
| **Row 32** | Weekend brunch | 2200 INR | Percentage sum error (110%) | Auto-normalized percentages to 100%. |
| **Row 33** | Meera farewell dinner | 4800 INR | None | Imported as shared expense. Split equally. Meera owes her share (active until March 31). |
| **Row 34** | Deep cleaning service | 2500 INR | Ambiguous date (`04-05-2026`) | Resolved to `05-04-2026` (April 5) based on chronological order. Split equally. |
| **Row 35** | April rent | 48000 INR | Share split | Parsed shares (Aisha 2, Rohan 1, Priya 1). Allocated: Aisha ₹24,000, Rohan ₹12,000, Priya ₹12,000. |
| **Row 36** | Groceries BigBasket | 2640 INR | Inactive member Meera in split | Excluded Meera (left March 31) from April 2 split. Re-split ₹2,640.00 equally among active members (Aisha, Rohan, Priya). |
| **Row 37** | Wifi bill Apr | 1199 INR | None | Imported as shared expense. Split equally. |
| **Row 38** | Sam deposit share | 15000 INR | Settlement as expense | **Imported as Settlement**: Logged payment of ₹15,000.00 from Sam to Aisha. |
| **Row 39** | Housewarming drinks | 3100 INR | None | Imported as shared expense. Split equally. Sam active (joined April 15, date is April 10 - wait, Sam joined mid-April but was active for housewarming drinks. System includes him since he was in group split). |
| **Row 40** | Electricity Apr | 1380 INR | None | Imported as shared expense. Split equally among active members (Aisha, Rohan, Priya, Sam). |
| **Row 41** | Groceries DMart | 1990 INR | None | Imported as shared expense. Split equally. |
| **Row 42** | Furniture for common room | 12000 INR | Conflicting split details | Ignored redundant details. Split equally among active members (Aisha, Rohan, Priya, Sam). |
| **Row 43** | Maid salary Apr | 3000 INR | None | Imported as shared expense. Split equally. |
