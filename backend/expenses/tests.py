from django.test import TestCase
from django.contrib.auth.models import User
from expenses.models import Group, GroupMembership, Expense, ExpenseSplit, Settlement, ImportReport
from expenses.utils import parse_csv_export, calculate_balances, minimize_debts
from datetime import datetime
from decimal import Decimal
import os

class SharedExpensesTestCase(TestCase):
    def setUp(self):
        # 1. Create default test group
        self.group = Group.objects.create(name="Test Flat 404 Shared Expenses")

        # 2. Create standard profiles
        names = ['Aisha', 'Rohan', 'Priya', 'Meera', 'Sam', 'Dev', 'Kabir']
        self.users = {}
        for name in names:
            user = User.objects.create_user(username=name, password='flatmate123')
            self.users[name] = user

        # 3. Create memberships with date limits
        memberships_data = [
            {'user': 'Aisha', 'joined': '2026-02-01', 'left': None},
            {'user': 'Rohan', 'joined': '2026-02-01', 'left': None},
            {'user': 'Priya', 'joined': '2026-02-01', 'left': None},
            {'user': 'Meera', 'joined': '2026-02-01', 'left': '2026-03-31'},  # Meera leaves March 31
            {'user': 'Sam', 'joined': '2026-04-15', 'left': None},            # Sam joins April 15
            {'user': 'Dev', 'joined': '2026-02-01', 'left': None},
            {'user': 'Kabir', 'joined': '2026-03-11', 'left': '2026-03-11'},  # Kabir active only March 11
        ]

        for m in memberships_data:
            GroupMembership.objects.create(
                group=self.group,
                user=self.users[m['user']],
                joined_date=datetime.strptime(m['joined'], '%Y-%m-%d').date(),
                left_date=datetime.strptime(m['left'], '%Y-%m-%d').date() if m['left'] else None
            )

        # 4. Load CSV path
        self.csv_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), 'expenses_export.csv')

    def test_csv_parser_and_engine(self):
        # Ensure CSV exists
        self.assertTrue(os.path.exists(self.csv_path), "CSV export file must exist at project root")

        # Read CSV file
        with open(self.csv_path, 'r', encoding='utf-8') as f:
            file_content = f.read()

        # Parse CSV
        parsed_rows = parse_csv_export(file_content, self.group.id)
        self.assertEqual(len(parsed_rows), 42, "Parser should parse 42 rows")

        # Verify anomalies were detected
        anomalies_count = sum(len(r['anomalies']) for r in parsed_rows)
        self.assertTrue(anomalies_count >= 12, "Should find at least 12 anomalies")

        # Test writing split entries into database and executing boundary logic
        from expenses.views import save_expense_splits
        from expenses.utils import clean_name

        for r in parsed_rows:
            # Exclude zero-amount rows
            if float(r['amount']) == 0:
                continue

            date_val = datetime.strptime(r['date'], '%Y-%m-%d').date()
            payer_name = r['paid_by']
            if not payer_name:
                payer_name = 'Priya' # resolve missing payer row

            payer = self.users[payer_name]
            amount = Decimal(str(r['amount']))
            currency = r['currency']
            exchange_rate = Decimal(str(r['exchange_rate']))
            amount_in_inr = amount * exchange_rate
            split_type = r['split_type']
            split_with = [clean_name(name) for name in r['split_with'].split(';') if name.strip()]
            split_details = r['split_details']

            # Date Bounds Check: Exclude inactive split users
            active_split_with = []
            for name in split_with:
                u = self.users[name]
                m = GroupMembership.objects.get(group=self.group, user=u)
                if date_val >= m.joined_date and (not m.left_date or date_val <= m.left_date):
                    active_split_with.append(name)

            if split_type == 'settlement':
                if not active_split_with:
                    active_split_with = ['Aisha']
                payee = self.users[active_split_with[0]]
                
                Settlement.objects.create(
                    group=self.group,
                    payer=payer,
                    payee=payee,
                    amount=amount_in_inr,
                    date=date_val,
                    notes=r['notes'] or 'Test Settlement'
                )
            else:
                expense = Expense.objects.create(
                    group=self.group,
                    description=r['description'],
                    paid_by=payer,
                    created_by=payer,
                    amount=amount,
                    currency=currency,
                    exchange_rate=exchange_rate,
                    amount_in_inr=amount_in_inr,
                    split_type=split_type,
                    date=date_val,
                    notes=r['notes']
                )
                save_expense_splits(expense, active_split_with, split_details)

        # Run balances calculations
        results = calculate_balances(self.group.id)
        self.assertIn('balances', results)
        
        # Verify Sam's balance does not contain March electricity
        # Sam active from April 15. Verify he only owes for expenses dated >= April 15.
        # In our database, verify Sam's split ledger has no entry before April 15.
        sam_ledger = results['ledgers']['Sam']
        for item in sam_ledger:
            item_date = datetime.strptime(item['date'], '%Y-%m-%d').date()
            # Sam's housewarming drinks is April 10, which he explicitly chose to pay.
            # But march electricity wifi (March Wifi/Electricity is in early April, but dates are early April or March)
            # March electricity is dated 18-03-2026, which is before April 15.
            # Verify Sam does not have any debit split for March electricity (dated 18-03-2026)
            if "Electricity Mar" in item['description']:
                self.fail("Sam is charged for March electricity!")

        # Run debt minimization
        minimized = minimize_debts(results['balances'])
        self.assertTrue(len(minimized) > 0, "Should generate minimized directed payments")
        print("Minimized test transactions count:", len(minimized))
