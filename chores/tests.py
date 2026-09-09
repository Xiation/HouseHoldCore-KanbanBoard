import datetime

from django.test import TestCase
from django.urls import reverse
from django.utils import timezone

from .models import Chore, HouseholdMember


class ChoreStalenessTests(TestCase):
    def _make_chore(self, status=Chore.Status.TODO, days_old=0):
        chore = Chore.objects.create(
            title="Test chore", status=status, time_estimate=Chore.TimeEstimate.QUICK
        )
        Chore.objects.filter(pk=chore.pk).update(
            last_updated_at=timezone.now() - datetime.timedelta(days=days_old)
        )
        chore.refresh_from_db()
        return chore

    def test_stale_when_old_and_not_done(self):
        chore = self._make_chore(days_old=4)
        self.assertTrue(chore.is_stale)

    def test_not_stale_when_recent(self):
        chore = self._make_chore(days_old=1)
        self.assertFalse(chore.is_stale)

    def test_done_chore_never_stale(self):
        chore = self._make_chore(status=Chore.Status.DONE, days_old=10)
        self.assertFalse(chore.is_stale)
        self.assertEqual(chore.days_stale, 0)


class BoardViewTests(TestCase):
    def setUp(self):
        self.alice = HouseholdMember.objects.create(name="Alice")
        self.unclaimed = Chore.objects.create(
            title="Unclaimed chore", time_estimate=Chore.TimeEstimate.QUICK
        )
        self.claimed_todo = Chore.objects.create(
            title="Claimed todo",
            time_estimate=Chore.TimeEstimate.QUICK,
            claimed_by=self.alice,
        )
        self.in_progress = Chore.objects.create(
            title="In progress chore",
            status=Chore.Status.IN_PROGRESS,
            claimed_by=self.alice,
            time_estimate=Chore.TimeEstimate.QUICK,
        )
        self.done = Chore.objects.create(
            title="Done chore",
            status=Chore.Status.DONE,
            claimed_by=self.alice,
            time_estimate=Chore.TimeEstimate.QUICK,
        )

    def test_board_groups_chores_correctly(self):
        response = self.client.get(reverse("board"))
        self.assertEqual(response.status_code, 200)
        self.assertIn(self.unclaimed, response.context["unclaimed"])
        self.assertIn(self.claimed_todo, response.context["claimed_todo"])
        self.assertIn(self.in_progress, response.context["in_progress"])
        self.assertIn(self.done, response.context["done"])


class ClaimChoreTests(TestCase):
    def setUp(self):
        self.alice = HouseholdMember.objects.create(name="Alice")
        self.chore = Chore.objects.create(
            title="Wash dishes", time_estimate=Chore.TimeEstimate.QUICK
        )

    def test_claim_sets_claimed_by_and_status(self):
        response = self.client.post(
            reverse("claim_chore", args=[self.chore.id]), {"member_id": self.alice.id}
        )
        self.assertRedirects(response, reverse("board"))
        self.chore.refresh_from_db()
        self.assertEqual(self.chore.claimed_by, self.alice)
        self.assertEqual(self.chore.status, Chore.Status.IN_PROGRESS)

    def test_claim_already_claimed_chore_404s(self):
        self.chore.claimed_by = self.alice
        self.chore.save()
        bob = HouseholdMember.objects.create(name="Bob")

        response = self.client.post(
            reverse("claim_chore", args=[self.chore.id]), {"member_id": bob.id}
        )
        self.assertEqual(response.status_code, 404)

    def test_claim_via_get_does_not_mutate(self):
        self.client.get(reverse("claim_chore", args=[self.chore.id]))
        self.chore.refresh_from_db()
        self.assertIsNone(self.chore.claimed_by)


class CompleteChoreTests(TestCase):
    def setUp(self):
        self.alice = HouseholdMember.objects.create(name="Alice")

    def test_complete_one_off_marks_done(self):
        chore = Chore.objects.create(
            title="One-off chore",
            recurrence_type=Chore.RecurrenceType.ONE_OFF,
            due_date=datetime.date(2026, 1, 1),
            claimed_by=self.alice,
            status=Chore.Status.IN_PROGRESS,
            time_estimate=Chore.TimeEstimate.QUICK,
        )

        response = self.client.post(reverse("complete_chore", args=[chore.id]))

        self.assertRedirects(response, reverse("board"))
        chore.refresh_from_db()
        self.assertEqual(chore.status, Chore.Status.DONE)
        self.assertEqual(chore.due_date, datetime.date(2026, 1, 1))
        self.assertIsNotNone(chore.last_completed_at)

    def test_complete_recurring_resets_and_advances_due_date(self):
        chore = Chore.objects.create(
            title="Recurring chore",
            recurrence_type=Chore.RecurrenceType.RECURRING,
            recurrence_interval=7,
            due_date=datetime.date(2026, 1, 1),
            claimed_by=self.alice,
            status=Chore.Status.IN_PROGRESS,
            time_estimate=Chore.TimeEstimate.QUICK,
        )

        response = self.client.post(reverse("complete_chore", args=[chore.id]))

        self.assertRedirects(response, reverse("board"))
        chore.refresh_from_db()
        self.assertEqual(chore.status, Chore.Status.TODO)
        self.assertIsNone(chore.claimed_by)
        self.assertEqual(chore.due_date, datetime.date(2026, 1, 8))
        self.assertIsNotNone(chore.last_completed_at)
