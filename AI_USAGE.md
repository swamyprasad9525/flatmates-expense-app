# AI_USAGE.md - AI Collaboration Log

This log documents the AI tools used, key prompts, and three concrete cases where the AI collaborator produced incorrect code/commands, how they were caught, and how they were resolved.

---

## 1. AI Tools & Key Prompts
- **AI Tool**: Antigravity IDE (powered by Gemini 3.5 Flash Medium).
- **Role**: Software developer and product manager partner.
- **Key Prompts**:
  - *"Analyze this folder and list files to check the setup."*
  - *"Initialize a git repository and structure commit stages."*
  - *"Update implementation plan for PostgreSQL, add the 9 missing anomaly policies, and write out membership date boundary check rules."*

---

## 2. Three Concrete Cases of AI Errors & Corrections

### Case 1: Media Queries in Inline React Styles (Dashboard.jsx)
- **What the AI did wrong**: 
  In `Dashboard.jsx`, the AI generated an inline `style` object with a nested CSS media query:
  ```jsx
  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', @media (max-width: 1024px): { gridTemplateColumns: '1fr' } }}>
  ```
- **How it was caught**: 
  The Vite bundler failed during `npm run build` and threw a compilation syntax error:
  `Build failed with 1 error: [builtin:vite-transform] Unexpected token` on line 380.
- **What was changed**: 
  Removed the inline styled div media query, replaced it with a class name (`className="transaction-history-grid"`), and added the clean responsive styles to `index.css`:
  ```css
  .transaction-history-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 24px;
  }
  @media (max-width: 1024px) {
    .transaction-history-grid {
      grid-template-columns: 1fr;
    }
  }
  ```

---

### Case 2: Multi-line Command string Escaping in PowerShell
- **What the AI did wrong**: 
  Proposed executing a multi-line python command directly in the shell using backslashes to execute SQL commands like `ALTER USER postgres PASSWORD 'student';` and `CREATE DATABASE flatmates_expense;`.
- **How it was caught**: 
  The terminal shell threw a syntax error:
  `SyntaxError: EOL while scanning string literal. The term '\) ...' is not recognized as the name of a cmdlet...`
- **What was changed**: 
  Refactored the database initialization logic into a static python file (`setup_db.py` and `restore_hba.py`) using the `write_to_file` tool, and then ran the script cleanly using the python interpreter `venv\Scripts\python setup_db.py`.

---

### Case 3: Missing PostgreSQL Database Driver (`psycopg2`)
- **What the AI did wrong**: 
  Configured Django settings (`settings.py`) to use `django.db.backends.postgresql` database backend, but did not check if the Postgres driver was installed in the python virtualenv.
- **How it was caught**: 
  Attempting to run database check or migrations threw a Django configuration error:
  `django.core.exceptions.ImproperlyConfigured: Error loading psycopg2 module: No module named 'psycopg2'`.
- **What was changed**: 
  Installed the Postgres driver programmatically by running `venv\Scripts\python -m pip install psycopg2-binary` before running migrations, resolving the dependency error.

---

### Case 4: Float and Decimal Subtraction TypeError in Duplicate Scanner (utils.py)
- **What the AI did wrong**: 
  Subtracted `amount_decimal` (Decimal type) from `prev_row['amount']` (float type) directly in `utils.py` during duplicate transaction checks, causing python to crash with a TypeError.
- **How it was caught**: 
  Running the manual validation script `test_import.py` threw a traceback:
  `TypeError: unsupported operand type(s) for -: 'float' and 'decimal.Decimal'`.
- **What was changed**: 
  Cast the Decimal value `amount_decimal` to `float` before running the subtraction:
  `abs(prev_row['amount'] - float(amount_decimal)) < 1.0`.

---

### Case 5: Missing Regex Library Import in Views (views.py)
- **What the AI did wrong**: 
  Utilized the Python regular expressions matching module `re.match` inside the `save_expense_splits` view helper function in `views.py` without importing `re` at the top of the file.
- **How it was caught**: 
  Simulating CSV confirm transaction imports triggered a traceback:
  `NameError: name 're' is not defined`.
- **What was changed**: 
  Added `import re` along with the standard datetime/decimal imports at the top of `backend/expenses/views.py`.

---

### Case 6: Incorrect REST Framework HTTP Status Code Typo in Views (views.py)
- **What the AI did wrong**: 
  Returned `status.HTTP_44_NOT_FOUND` in `GroupSettlementsView.delete` for a non-existent settlement instead of `status.HTTP_404_NOT_FOUND`.
- **How it was caught**: 
  Code review and static scanning of HTTP status codes in `views.py` revealed that `HTTP_44_NOT_FOUND` is not a valid Django REST Framework status code constant, which would raise an `AttributeError` at runtime.
- **What was changed**: 
  Replaced `status.HTTP_44_NOT_FOUND` with `status.HTTP_404_NOT_FOUND` and ran the Django check/test suite to verify functionality.

---

### Case 7: Missing `rest_framework.authtoken` in `INSTALLED_APPS` (settings.py)
- **What the AI did wrong**: 
  Used Token authentication via DRF's `Token` model without adding `'rest_framework.authtoken'` to `INSTALLED_APPS` in `settings.py`.
- **How it was caught**: 
  Attempting to authenticate/login returned a `500 Internal Server Error` due to `AttributeError: type object 'Token' has no attribute 'objects'` (since Django doesn't load model managers for unlisted apps).
- **What was changed**: 
  Added `'rest_framework.authtoken'` to `INSTALLED_APPS` in `settings.py` and ran `python manage.py migrate` to create the auth token database tables.


