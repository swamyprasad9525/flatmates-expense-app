from rest_framework import serializers
from django.contrib.auth.models import User
from expenses.models import Profile, Group, GroupMembership, Expense, ExpenseSplit, Settlement, ImportReport

class UserSerializer(serializers.ModelSerializer):
    display_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'display_name']

    def get_display_name(self, obj):
        try:
            return obj.profile.display_name
        except Profile.DoesNotExist:
            return obj.first_name or obj.username

class ProfileSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    class Meta:
        model = Profile
        fields = ['id', 'username', 'display_name']

class GroupSerializer(serializers.ModelSerializer):
    class Meta:
        model = Group
        fields = ['id', 'name', 'created_at']

class GroupMembershipSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    display_name = serializers.CharField(source='user.profile.display_name', read_only=True)

    class Meta:
        model = GroupMembership
        fields = ['id', 'group', 'user', 'username', 'display_name', 'joined_date', 'left_date']

class ExpenseSplitSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    display_name = serializers.CharField(source='user.profile.display_name', read_only=True)

    class Meta:
        model = ExpenseSplit
        fields = ['id', 'user', 'username', 'display_name', 'share_amount', 'share_amount_in_inr', 'split_value']

class ExpenseSerializer(serializers.ModelSerializer):
    paid_by_username = serializers.CharField(source='paid_by.username', read_only=True)
    paid_by_display_name = serializers.CharField(source='paid_by.profile.display_name', read_only=True)
    created_by_username = serializers.CharField(source='created_by.username', read_only=True)
    splits = ExpenseSplitSerializer(many=True, read_only=True)

    class Meta:
        model = Expense
        fields = [
            'id', 'group', 'description', 'paid_by', 'paid_by_username', 'paid_by_display_name',
            'created_by', 'created_by_username', 'amount', 'currency', 'exchange_rate',
            'amount_in_inr', 'split_type', 'date', 'notes', 'created_at', 'splits'
        ]

class SettlementSerializer(serializers.ModelSerializer):
    payer_username = serializers.CharField(source='payer.username', read_only=True)
    payer_display_name = serializers.CharField(source='payer.profile.display_name', read_only=True)
    payee_username = serializers.CharField(source='payee.username', read_only=True)
    payee_display_name = serializers.CharField(source='payee.profile.display_name', read_only=True)

    class Meta:
        model = Settlement
        fields = [
            'id', 'group', 'payer', 'payer_username', 'payer_display_name',
            'payee', 'payee_username', 'payee_display_name', 'amount', 'date', 'notes', 'created_at'
        ]

class ImportReportSerializer(serializers.ModelSerializer):
    class Meta:
        model = ImportReport
        fields = ['id', 'group', 'imported_at', 'log_data']
