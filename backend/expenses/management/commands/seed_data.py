from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from expenses.models import Group, GroupMembership
from datetime import datetime

class Command(BaseCommand):
    help = 'Seed initial users, groups, and memberships'

    def handle(self, *args, **options):
        # 1. Create superuser if it doesn't exist
        if not User.objects.filter(username='admin').exists():
            User.objects.create_superuser('admin', 'admin@example.com', 'admin123')
            self.stdout.write(self.style.SUCCESS("Superuser 'admin' created with password 'admin123'"))

        # 2. Seed Flatmates
        flatmates = [
            {'username': 'Aisha', 'email': 'aisha@example.com', 'first_name': 'Aisha'},
            {'username': 'Rohan', 'email': 'rohan@example.com', 'first_name': 'Rohan'},
            {'username': 'Priya', 'email': 'priya@example.com', 'first_name': 'Priya'},
            {'username': 'Meera', 'email': 'meera@example.com', 'first_name': 'Meera'},
            {'username': 'Sam', 'email': 'sam@example.com', 'first_name': 'Sam'},
            {'username': 'Dev', 'email': 'dev@example.com', 'first_name': 'Dev'},
            {'username': 'Kabir', 'email': 'kabir@example.com', 'first_name': 'Kabir'},  # Dev's friend Kabir
        ]

        users = {}
        for f in flatmates:
            user, created = User.objects.get_or_create(username=f['username'], defaults={
                'email': f['email'],
                'first_name': f['first_name']
            })
            if created or not user.has_usable_password():
                user.set_password('flatmate123')
                user.save()
                self.stdout.write(f"User {f['username']} created/updated password to 'flatmate123'")
            users[f['username']] = user

        # 3. Create default group
        group, created = Group.objects.get_or_create(name='Flat 404 Shared Expenses')
        if created:
            self.stdout.write(self.style.SUCCESS(f"Group '{group.name}' created"))

        # 4. Create Memberships
        memberships_data = [
            {'user': 'Aisha', 'joined': '2026-02-01', 'left': None},
            {'user': 'Rohan', 'joined': '2026-02-01', 'left': None},
            {'user': 'Priya', 'joined': '2026-02-01', 'left': None},
            {'user': 'Meera', 'joined': '2026-02-01', 'left': '2026-03-31'},  # Meera left end of March
            {'user': 'Sam', 'joined': '2026-04-15', 'left': None},            # Sam joined mid-April
            {'user': 'Dev', 'joined': '2026-02-01', 'left': None},            # Active for Goa trip and dinner
            {'user': 'Kabir', 'joined': '2026-03-11', 'left': '2026-03-11'},  # Temporary member for Goa parasailing day
        ]

        for m in memberships_data:
            joined_dt = datetime.strptime(m['joined'], '%Y-%m-%d').date()
            left_dt = datetime.strptime(m['left'], '%Y-%m-%d').date() if m['left'] else None
            
            membership, m_created = GroupMembership.objects.get_or_create(
                group=group,
                user=users[m['user']],
                defaults={
                    'joined_date': joined_dt,
                    'left_date': left_dt
                }
            )
            if not m_created:
                # Update dates if changed
                membership.joined_date = joined_dt
                membership.left_date = left_dt
                membership.save()
            self.stdout.write(f"Membership configured for {m['user']}: joined {joined_dt}, left {left_dt}")

        self.stdout.write(self.style.SUCCESS("Database seeding completed successfully!"))
