# Shared Expenses App - Flat 404 Shared Ledger

A premium, glassmorphic React and Django web application to manage shared expenses for Aisha, Rohan, Priya, Meera, and Sam, with full historical date-boundary membership splits, greedy transaction debt minimization, and a comprehensive CSV Import Wizard that scans and resolves 19+ data anomalies.

## Tech Stack
- **Frontend**: React 19, Vite, Vanilla CSS (with custom HSL gradients & glassmorphism variables), Lucide Icons.
- **Backend**: Django 3.2, Django REST Framework, CORS Headers, Python 3.7.
- **Database**: PostgreSQL (using driver `psycopg2-binary`).
- **AI Agent Collaborator**: Google DeepMind's Antigravity coding assistant.

---

## Installation & Setup Instructions

### Prerequisites
- **Python 3.7+**
- **Node.js (v18+)**
- **PostgreSQL 18** service running on port `5432` with username `postgres`, password `student` (configured for local development).

---

### 1. Backend Setup

Navigate to the `backend` directory:
```bash
cd backend
```

Configure/activate virtual environment:
```bash
# Activate virtual environment
venv\Scripts\activate
```

Install PostgreSQL database driver (already done during development):
```bash
pip install psycopg2-binary
```

Generate database migrations and apply them to PostgreSQL:
```bash
python manage.py makemigrations
python manage.py migrate
```

Seed initial flatmates, default group, and membership dates (Aisha, Rohan, Priya, Meera, Sam, Dev, Kabir):
```bash
python manage.py seed_data
```

Start the Django REST API server:
```bash
python manage.py runserver
```
The backend server will run on `http://127.0.0.1:8000/`.

---

### 2. Frontend Setup

Navigate to the `frontend/my-app` directory:
```bash
cd ../frontend/my-app
```

Install the dependencies:
```bash
npm install
```

Start the React development server:
```bash
npm run dev
```
The frontend application will run on `http://localhost:5173/`.

---

## How to Test the App

1. Open `http://localhost:5173/` in your browser.
2. Select any flatmate (e.g. **Rohan**) in the Quick Profile Selector on the login card to log in instantly. The default password is `flatmate123` for all seeded profiles.
3. Click the **Import CSV** button on the header.
4. Drag and drop the `expenses_export.csv` file from your desktop.
5. In Step 2 of the wizard:
   - View all **19+ anomalies** marked with warnings.
   - You can review and resolve them (e.g. select which duplicate Thalassa dinner to exclude, adjust exchange rates, apply automatic re-splits for Meera's April 2 grocery expense, assign payer to the missing row, change deposit/repayments to settlement logs).
6. Click **Commit Resolved Data**. The system will save the ledger and return a complete audit log of resolutions.
7. Inspect the balances on the dashboard:
   - **Aisha's View**: Net balance display and minimized dirigido payments ("Who pays whom, how much").
   - **Rohan's View**: Click on any flatmate's card to view a line-by-line itemized ledger breakdown of the exact expenses that form their balance.
   - **Sam's View**: Check Sam's balance to confirm he is not charged for March's electricity/bills because his membership began on April 15.
   - **Meera's View**: View Meera's card to confirm no expenses post-March 31 are split to her, and she has a clean farewell settlement.
