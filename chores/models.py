from django.db import models
from django.utils import timezone

STALE_AFTER_DAYS = 3


class HouseholdMember(models.Model):
    name = models.CharField(max_length=100, unique=True)

    def __str__(self):
        return self.name


class Chore(models.Model):
    class Status(models.TextChoices):
        TODO = "todo", "To Do"
        IN_PROGRESS = "in_progress", "In Progress"
        DONE = "done", "Done"

    class RecurrenceType(models.TextChoices):
        ONE_OFF = "one_off", "One-off"
        RECURRING = "recurring", "Recurring"

    class TimeEstimate(models.TextChoices):
        QUICK = "quick", "Quick"
        MEDIUM = "medium", "Medium"
        BIG = "big", "Big"

    title = models.CharField(max_length=200)
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.TODO
    )
    recurrence_type = models.CharField(
        max_length=20, choices=RecurrenceType.choices, default=RecurrenceType.ONE_OFF
    )
    recurrence_interval = models.PositiveIntegerField(
        null=True, blank=True, help_text="Days between recurrences (recurring chores only)"
    )
    due_date = models.DateField(null=True, blank=True)
    time_estimate = models.CharField(max_length=10, choices=TimeEstimate.choices)
    claimed_by = models.ForeignKey(
        HouseholdMember,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="claimed_chores",
    )
    last_updated_at = models.DateTimeField(auto_now=True)
    last_completed_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return self.title

    @property
    def days_stale(self):
        if self.status == self.Status.DONE:
            return 0
        delta = timezone.now() - self.last_updated_at
        return delta.days

    @property
    def is_stale(self):
        return self.status != self.Status.DONE and self.days_stale >= STALE_AFTER_DAYS
