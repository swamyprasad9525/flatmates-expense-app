from django.shortcuts import render
from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from django.db import transaction
from rest_framework import status, viewsets
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.authtoken.models import Token
from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP
import re

from expenses.models import Group, GroupMembership, Expense, ExpenseSplit, Settlement, ImportReport, Profile
from expenses.serializers import (
    UserSerializer, GroupSerializer, GroupMembershipSerializer,
    ExpenseSerializer, SettlementSerializer, ImportReportSerializer
)
from expenses.utils import parse_csv_export, calculate_balances, minimize_debts, clean_name

# Helper function to compute and save splits for an expense
def save_expense_splits(expense, split_with_usernames, split_details_str=None):
    amount_inr = expense.amount_in_inr
    amount_orig = expense.amount
    split_type = expense.split_type
    
    # 1. Clean split usernames and match with database Users
    users_in_split = []
    for uname in split_with_usernames:
        cleaned_uname = clean_name(uname)
        try:
            u = User.objects.get(username=cleaned_uname)
            users_in_split.append(u)
        except User.DoesNotExist:
            # If user does not exist, check if we can create a profile for them
            # E.g. Dev's friend Kabir during import
            u = User.objects.create(username=cleaned_uname, first_name=cleaned_uname)
            u.set_password('flatmate123')
            u.save()
            users_in_split.append(u)

    if not users_in_split:
        raise ValueError("No valid split users provided")

    splits_data = []

    # 2. Compute shares based on split_type
    if split_type == 'equal':
        num_users = len(users_in_split)
        share_amount = amount_orig / num_users
        share_amount_inr = amount_inr / num_users
        
        # Round to 4 decimal places
        share_amount = share_amount.quantize(Decimal('0.0001'), rounding=ROUND_HALF_UP)
        share_amount_inr = share_amount_inr.quantize(Decimal('0.0001'), rounding=ROUND_HALF_UP)
        
        for u in users_in_split:
            splits_data.append({
                'user': u,
                'share_amount': share_amount,
                'share_amount_inr': share_amount_inr,
                'split_value': 'Equal'
            })

    elif split_type == 'share':
        # Parse details: e.g. "Aisha 2; Rohan 1; Priya 1"
        shares = {}
        total_shares = Decimal('0.0000')
        
        if split_details_str:
            # Matches "Aisha 2" or "Aisha 1.5" etc.
            pairs = [p.strip() for p in split_details_str.split(';') if p.strip()]
            for p in pairs:
                parts = p.split()
                if len(parts) >= 2:
                    name = clean_name(parts[0])
                    val = Decimal(parts[1])
                    shares[name] = val
                    total_shares += val
        
        # Default to 1 share for anyone missing
        for u in users_in_split:
            if u.username not in shares:
                shares[u.username] = Decimal('1.0000')
                total_shares += Decimal('1.0000')

        for u in users_in_split:
            user_share = shares.get(u.username, Decimal('1.0000'))
            pct = user_share / total_shares
            
            share_amount = (amount_orig * pct).quantize(Decimal('0.0001'), rounding=ROUND_HALF_UP)
            share_amount_inr = (amount_inr * pct).quantize(Decimal('0.0001'), rounding=ROUND_HALF_UP)
            
            splits_data.append({
                'user': u,
                'share_amount': share_amount,
                'share_amount_inr': share_amount_inr,
                'split_value': f"{user_share} shares"
            })

    elif split_type == 'percentage':
        # Parse details: e.g. "Aisha 30%; Rohan 30%; Priya 30%; Meera 20%" (110%)
        percentages = {}
        total_pct = Decimal('0.0000')
        
        if split_details_str:
            pairs = [p.strip() for p in split_details_str.split(';') if p.strip()]
            for p in pairs:
                # Matches "Aisha 30%" or "Aisha 30"
                match = re.match(r'([a-zA-Z\s]+)\s*(\d+(?:\.\d+)?)%?', p)
                if match:
                    name = clean_name(match.group(1))
                    val = Decimal(match.group(2))
                    percentages[name] = val
                    total_pct += val

        # If percentages sum is off, normalize to 100%
        # Let's say it sums to 110: divide each by 110 and multiply by 100
        for u in users_in_split:
            user_pct = percentages.get(u.username, Decimal('0.0000'))
            if total_pct > 0:
                normalized_pct = (user_pct / total_pct) * 100
            else:
                normalized_pct = Decimal('100.0000') / len(users_in_split)
                
            share_amount = (amount_orig * (normalized_pct / 100)).quantize(Decimal('0.0001'), rounding=ROUND_HALF_UP)
            share_amount_inr = (amount_inr * (normalized_pct / 100)).quantize(Decimal('0.0001'), rounding=ROUND_HALF_UP)
            
            splits_data.append({
                'user': u,
                'share_amount': share_amount,
                'share_amount_inr': share_amount_inr,
                'split_value': f"{round(normalized_pct, 2)}%"
            })

    elif split_type == 'unequal':
        # Parse details: e.g. "Rohan 700; Priya 400; Meera 400"
        amounts = {}
        total_unequal = Decimal('0.0000')
        
        if split_details_str:
            pairs = [p.strip() for p in split_details_str.split(';') if p.strip()]
            for p in pairs:
                parts = p.split()
                if len(parts) >= 2:
                    name = clean_name(parts[0])
                    val = Decimal(parts[1])
                    amounts[name] = val
                    total_unequal += val

        # Validate total matches amount. If not, scale it proportionally or error
        # In parser resolution, we verify and adjust
        for u in users_in_split:
            user_amount = amounts.get(u.username, Decimal('0.0000'))
            
            # If total doesn't match original amount, normalize to match original amount
            if total_unequal > 0 and total_unequal != amount_orig:
                pct = user_amount / total_unequal
                share_amount = (amount_orig * pct).quantize(Decimal('0.0001'), rounding=ROUND_HALF_UP)
                share_amount_inr = (amount_inr * pct).quantize(Decimal('0.0001'), rounding=ROUND_HALF_UP)
            else:
                share_amount = user_amount.quantize(Decimal('0.0001'), rounding=ROUND_HALF_UP)
                share_amount_inr = (user_amount * expense.exchange_rate).quantize(Decimal('0.0001'), rounding=ROUND_HALF_UP)
                
            splits_data.append({
                'user': u,
                'share_amount': share_amount,
                'share_amount_inr': share_amount_inr,
                'split_value': f"₹{float(share_amount_inr)}"
            })

    # Save to Database
    ExpenseSplit.objects.filter(expense=expense).delete()
    for s in splits_data:
        ExpenseSplit.objects.create(
            expense=expense,
            user=s['user'],
            share_amount=s['share_amount'],
            share_amount_in_inr=s['share_amount_inr'],
            split_value=s['split_value']
        )

# Authentication Views
class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        username = request.data.get('username')
        password = request.data.get('password')
        if not username or not password:
            return Response({'error': 'Please provide username and password'}, status=status.HTTP_400_BAD_REQUEST)
        
        user = authenticate(username=username, password=password)
        if not user:
            return Response({'error': 'Invalid credentials'}, status=status.HTTP_401_UNAUTHORIZED)
            
        token, created = Token.objects.get_or_create(user=user)
        return Response({
            'token': token.key,
            'user': UserSerializer(user).data
        })

class AuthStatusView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response({
            'user': UserSerializer(request.user).data
        })

# Groups ViewSet
class GroupViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = GroupSerializer
    queryset = Group.objects.all().order_by('-created_at')

    def perform_create(self, serializer):
        group = serializer.save()
        # Add creator as a group member
        GroupMembership.objects.create(
            group=group,
            user=self.request.user,
            joined_date=datetime.now().date()
        )

# Group Memberships Views
class MembershipView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, group_id):
        memberships = GroupMembership.objects.filter(group_id=group_id)
        serializer = GroupMembershipSerializer(memberships, many=True)
        return Response(serializer.data)

    def post(self, request, group_id):
        username = request.data.get('username')
        joined_date_str = request.data.get('joined_date')
        left_date_str = request.data.get('left_date')

        if not username or not joined_date_str:
            return Response({'error': 'Username and joined_date are required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            user = User.objects.get(username=username)
        except User.DoesNotExist:
            # Auto-create user if not exist (password = flatmate123)
            user = User.objects.create(username=username, first_name=username)
            user.set_password('flatmate123')
            user.save()

        joined_date = datetime.strptime(joined_date_str, '%Y-%m-%d').date()
        left_date = datetime.strptime(left_date_str, '%Y-%m-%d').date() if left_date_str else None

        group = Group.objects.get(id=group_id)
        membership, created = GroupMembership.objects.update_or_create(
            group=group,
            user=user,
            defaults={
                'joined_date': joined_date,
                'left_date': left_date
            }
        )

        return Response(GroupMembershipSerializer(membership).data, status=status.HTTP_201_CREATED)

# Expenses View
class GroupExpensesView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, group_id):
        expenses = Expense.objects.filter(group_id=group_id).order_by('-date', '-id')
        serializer = ExpenseSerializer(expenses, many=True)
        return Response(serializer.data)

    def post(self, request, group_id):
        data = request.data
        try:
            group = Group.objects.get(id=group_id)
            payer_uname = data.get('paid_by_username')
            if payer_uname:
                paid_by = User.objects.get(username=payer_uname)
            else:
                paid_by = User.objects.get(id=data.get('paid_by'))

            amount = Decimal(str(data.get('amount')))
            currency = data.get('currency', 'INR')
            exchange_rate = Decimal(str(data.get('exchange_rate', 1.0)))
            amount_in_inr = amount * exchange_rate

            date = datetime.strptime(str(data.get('date')), '%Y-%m-%d').date()
            split_type = data.get('split_type', 'equal')
            split_with = data.get('split_with', []) # list of usernames
            split_details = data.get('split_details', '')

            # Create GroupMembership boundary check validation
            # For each member in split, verify that they are active on the expense date
            for uname in split_with:
                cleaned_uname = clean_name(uname)
                try:
                    u = User.objects.get(username=cleaned_uname)
                    membership = GroupMembership.objects.get(group=group, user=u)
                    
                    if date < membership.joined_date or (membership.left_date and date > membership.left_date):
                        return Response({
                            'error': f"Member {cleaned_uname} is inactive in the group on {date} (joined {membership.joined_date}, left {membership.left_date or 'present'})"
                        }, status=status.HTTP_400_BAD_REQUEST)
                except (User.DoesNotExist, GroupMembership.DoesNotExist):
                    pass

            with transaction.atomic():
                expense = Expense.objects.create(
                    group=group,
                    description=data.get('description'),
                    paid_by=paid_by,
                    created_by=request.user,
                    amount=amount,
                    currency=currency,
                    exchange_rate=exchange_rate,
                    amount_in_inr=amount_in_inr,
                    split_type=split_type,
                    date=date,
                    notes=data.get('notes', '')
                )
                save_expense_splits(expense, split_with, split_details)

            return Response(ExpenseSerializer(expense).data, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, group_id, pk):
        try:
            expense = Expense.objects.get(group_id=group_id, id=pk)
            expense.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        except Expense.DoesNotExist:
            return Response({'error': 'Expense not found'}, status=status.HTTP_404_NOT_FOUND)

# Settlements View
class GroupSettlementsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, group_id):
        settlements = Settlement.objects.filter(group_id=group_id).order_by('-date', '-id')
        serializer = SettlementSerializer(settlements, many=True)
        return Response(serializer.data)

    def post(self, request, group_id):
        data = request.data
        try:
            group = Group.objects.get(id=group_id)
            payer_uname = data.get('payer_username')
            if payer_uname:
                payer = User.objects.get(username=payer_uname)
            else:
                payer = User.objects.get(id=data.get('payer'))

            payee_uname = data.get('payee_username')
            if payee_uname:
                payee = User.objects.get(username=payee_uname)
            else:
                payee = User.objects.get(id=data.get('payee'))

            amount = Decimal(str(data.get('amount')))
            date = datetime.strptime(str(data.get('date')), '%Y-%m-%d').date()

            settlement = Settlement.objects.create(
                group=group,
                payer=payer,
                payee=payee,
                amount=amount,
                date=date,
                notes=data.get('notes', '')
            )
            return Response(SettlementSerializer(settlement).data, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, group_id, pk):
        try:
            settlement = Settlement.objects.get(group_id=group_id, id=pk)
            settlement.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        except Settlement.DoesNotExist:
            return Response({'error': 'Settlement not found'}, status=status.HTTP_44_NOT_FOUND)

# Balances & Minimization View
class GroupBalancesView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, group_id):
        try:
            analysis = calculate_balances(group_id)
            minimized = minimize_debts(analysis['balances'])
            return Response({
                'balances': analysis['balances'],
                'ledgers': analysis['ledgers'],
                'minimized_debts': minimized
            })
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

# CSV Import Views
class ImportParseView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, group_id):
        csv_file = request.FILES.get('file')
        if not csv_file:
            return Response({'error': 'No file uploaded'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            file_content = csv_file.read().decode('utf-8')
            parsed_rows = parse_csv_export(file_content, group_id)
            return Response({'rows': parsed_rows})
        except Exception as e:
            return Response({'error': f"Failed to parse CSV: {str(e)}"}, status=status.HTTP_400_BAD_REQUEST)

class ImportConfirmView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, group_id):
        rows = request.data.get('rows', [])
        if not rows:
            return Response({'error': 'No data to import'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            group = Group.objects.get(id=group_id)
            import_logs = []
            expenses_imported = 0
            settlements_imported = 0

            with transaction.atomic():
                for r in rows:
                    if r.get('exclude', False):
                        import_logs.append({
                            'csv_row': r.get('csv_row_number'),
                            'description': r.get('description'),
                            'action': 'Excluded from import by user request'
                        })
                        continue

                    # Determine splits and dates
                    date_val = datetime.strptime(r.get('date'), '%Y-%m-%d').date()
                    paid_by = User.objects.get(username=r.get('paid_by'))
                    amount = Decimal(str(r.get('amount')))
                    currency = r.get('currency', 'INR')
                    exchange_rate = Decimal(str(r.get('exchange_rate', 1.0)))
                    amount_in_inr = amount * exchange_rate
                    split_type = r.get('split_type', 'equal')
                    split_with_raw = r.get('split_with', '').split(';')
                    split_with = [clean_name(name) for name in split_with_raw if name.strip()]
                    split_details = r.get('split_details', '')

                    # Core Boundary Check: Exclude inactive split members from splits programmatically
                    # Row 36: Meera was in list, but she was inactive.
                    # We filter out anyone who was inactive in GroupMembership on the date.
                    active_split_with = []
                    for name in split_with:
                        try:
                            user_obj = User.objects.get(username=name)
                            m = GroupMembership.objects.get(group=group, user=user_obj)
                            if date_val >= m.joined_date and (not m.left_date or date_val <= m.left_date):
                                active_split_with.append(name)
                            else:
                                import_logs.append({
                                    'csv_row': r.get('csv_row_number'),
                                    'description': r.get('description'),
                                    'action': f"Excluded inactive member {name} from split list due to membership bounds on {date_val}"
                                })
                        except (User.DoesNotExist, GroupMembership.DoesNotExist):
                            # Kabir, for example, is imported or created
                            active_split_with.append(name)

                    if split_type == 'settlement':
                        # This is a payment / transfer between two people.
                        # Split with contains the payee
                        if not active_split_with:
                            raise ValueError(f"Settlement at row {r.get('csv_row_number')} has no payee")
                        
                        payee_uname = active_split_with[0]
                        payee = User.objects.get(username=payee_uname)
                        
                        settlement = Settlement.objects.create(
                            group=group,
                            payer=paid_by,
                            payee=payee,
                            amount=amount_in_inr, # Settlements are stored in INR
                            date=date_val,
                            notes=r.get('notes', 'Imported from CSV settlement')
                        )
                        settlements_imported += 1
                        import_logs.append({
                            'csv_row': r.get('csv_row_number'),
                            'description': r.get('description'),
                            'action': f"Imported as Settlement: {paid_by.username} paid {payee.username} ₹{float(amount_in_inr)}"
                        })
                    else:
                        # Shared expense
                        expense = Expense.objects.create(
                            group=group,
                            description=r.get('description'),
                            paid_by=paid_by,
                            created_by=request.user,
                            amount=amount,
                            currency=currency,
                            exchange_rate=exchange_rate,
                            amount_in_inr=amount_in_inr,
                            split_type=split_type,
                            date=date_val,
                            notes=r.get('notes', '')
                        )
                        save_expense_splits(expense, active_split_with, split_details)
                        expenses_imported += 1
                        
                        import_logs.append({
                            'csv_row': r.get('csv_row_number'),
                            'description': r.get('description'),
                            'action': f"Imported as shared expense. Split among {', '.join(active_split_with)} (type: {split_type})"
                        })

                # Create the final ImportReport
                report = ImportReport.objects.create(
                    group=group,
                    log_data={
                        'expenses_count': expenses_imported,
                        'settlements_count': settlements_imported,
                        'logs': import_logs
                    }
                )

            return Response({
                'report': ImportReportSerializer(report).data,
                'summary': {
                    'expenses_count': expenses_imported,
                    'settlements_count': settlements_imported,
                    'total_items': expenses_imported + settlements_imported
                }
            })
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

from django.http import JsonResponse

def api_root_view(request):
    return JsonResponse({
        'message': 'Welcome to the Flat 404 Shared Expenses API Backend!',
        'status': 'healthy',
        'frontend_url': 'http://localhost:5173/',
        'api_endpoints': {
            'login': '/api/auth/login/',
            'status': '/api/auth/status/',
            'groups': '/api/groups/',
        }
    })
