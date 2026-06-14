from django.db import models
from django.contrib.auth.models import User
from django.db.models.signals import post_save
from django.dispatch import receiver

class Profile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    display_name = models.CharField(max_length=100, blank=True)

    def __str__(self):
        return self.display_name or self.user.username

@receiver(post_save, sender=User)
def create_user_profile(sender, instance, created, **kwargs):
    if created:
        Profile.objects.create(user=instance, display_name=instance.first_name or instance.username)

@receiver(post_save, sender=User)
def save_user_profile(sender, instance, **kwargs):
    if hasattr(instance, 'profile'):
        instance.profile.save()
    else:
        Profile.objects.create(user=instance, display_name=instance.first_name or instance.username)

class Group(models.Model):
    name = models.CharField(max_length=100)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name

class GroupMembership(models.Model):
    group = models.ForeignKey(Group, on_delete=models.CASCADE, related_name='memberships')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='memberships')
    joined_date = models.DateField()
    left_date = models.DateField(null=True, blank=True)

    class Meta:
        unique_together = ('group', 'user')

    def __str__(self):
        return f"{self.user.username} in {self.group.name} ({self.joined_date} to {self.left_date or 'present'})"

class Expense(models.Model):
    group = models.ForeignKey(Group, on_delete=models.CASCADE, related_name='expenses')
    description = models.CharField(max_length=255)
    paid_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='paid_expenses')
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='created_expenses')
    amount = models.DecimalField(max_digits=12, decimal_places=4)  # original currency amount
    currency = models.CharField(max_length=3, default='INR')  # INR or USD
    exchange_rate = models.DecimalField(max_digits=10, decimal_places=4, default=1.0000)
    amount_in_inr = models.DecimalField(max_digits=12, decimal_places=4)
    split_type = models.CharField(max_length=20, default='equal')  # equal, unequal, percentage, share
    date = models.DateField()
    notes = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.description} - {self.amount} {self.currency} by {self.paid_by.username}"

class ExpenseSplit(models.Model):
    expense = models.ForeignKey(Expense, on_delete=models.CASCADE, related_name='splits')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='splits')
    share_amount = models.DecimalField(max_digits=12, decimal_places=4)  # in original currency
    share_amount_in_inr = models.DecimalField(max_digits=12, decimal_places=4)  # in INR
    split_value = models.CharField(max_length=50, blank=True, null=True)  # e.g., "30%", "2 shares", "400"

    class Meta:
        unique_together = ('expense', 'user')

    def __str__(self):
        return f"{self.user.username} owes {self.share_amount} {self.expense.currency} for {self.expense.description}"

class Settlement(models.Model):
    group = models.ForeignKey(Group, on_delete=models.CASCADE, related_name='settlements')
    payer = models.ForeignKey(User, on_delete=models.CASCADE, related_name='paid_settlements')
    payee = models.ForeignKey(User, on_delete=models.CASCADE, related_name='received_settlements')
    amount = models.DecimalField(max_digits=12, decimal_places=4)  # always in INR
    date = models.DateField()
    notes = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.payer.username} paid {self.payee.username} {self.amount} INR"

class ImportReport(models.Model):
    group = models.ForeignKey(Group, on_delete=models.CASCADE, related_name='import_reports')
    imported_at = models.DateTimeField(auto_now_add=True)
    log_data = models.JSONField()  # Store logs of anomalies detected and actions taken

    def __str__(self):
        return f"Import Report for {self.group.name} at {self.imported_at}"
