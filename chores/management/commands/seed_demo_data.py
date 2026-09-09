import datetime

from django.core.management.base import BaseCommand
from django.utils import timezone

from chores.models import Chore, HouseholdMember


class Command(BaseCommand):
    help = "Seed demo household members and chores for local dev/demo"

    def handle(self, *args, **options):
        Chore.objects.all().delete()
        HouseholdMember.objects.all().delete()

        alice, bob, carol = [
            HouseholdMember.objects.create(name=name)
            for name in ("Alice", "Bob", "Carol")
        ]

        today = timezone.localdate()
        now = timezone.now()

        chores = [
            dict(
                title="Wash dishes",
                status=Chore.Status.TODO,
                recurrence_type=Chore.RecurrenceType.RECURRING,
                recurrence_interval=1,
                due_date=today,
                time_estimate=Chore.TimeEstimate.QUICK,
                claimed_by=None,
            ),
            dict(
                title="Take out trash",
                status=Chore.Status.TODO,
                recurrence_type=Chore.RecurrenceType.RECURRING,
                recurrence_interval=7,
                due_date=today + datetime.timedelta(days=2),
                time_estimate=Chore.TimeEstimate.QUICK,
                claimed_by=alice,
            ),
            dict(
                title="Vacuum living room",
                status=Chore.Status.IN_PROGRESS,
                recurrence_type=Chore.RecurrenceType.RECURRING,
                recurrence_interval=7,
                due_date=today,
                time_estimate=Chore.TimeEstimate.MEDIUM,
                claimed_by=bob,
            ),
            dict(
                title="Clean bathroom",
                status=Chore.Status.TODO,
                recurrence_type=Chore.RecurrenceType.ONE_OFF,
                recurrence_interval=None,
                due_date=today - datetime.timedelta(days=4),
                time_estimate=Chore.TimeEstimate.MEDIUM,
                claimed_by=None,
            ),
            dict(
                title="Deep clean fridge",
                status=Chore.Status.DONE,
                recurrence_type=Chore.RecurrenceType.ONE_OFF,
                recurrence_interval=None,
                due_date=today - datetime.timedelta(days=1),
                time_estimate=Chore.TimeEstimate.BIG,
                claimed_by=carol,
            ),
        ]

        for data in chores:
            chore = Chore.objects.create(**data)
            if data["status"] == Chore.Status.DONE:
                chore.last_completed_at = now
                chore.save(update_fields=["last_completed_at"])

        # Backdate last_updated_at on the bathroom chore so it shows as stale
        stale_chore = Chore.objects.get(title="Clean bathroom")
        Chore.objects.filter(pk=stale_chore.pk).update(
            last_updated_at=now - datetime.timedelta(days=5)
        )

        self.stdout.write(self.style.SUCCESS("Seeded 3 members and 5 chores."))
