import datetime

from django.shortcuts import get_object_or_404, redirect, render
from django.utils import timezone

from .models import Chore, HouseholdMember


def board_view(request):
    chores = Chore.objects.select_related("claimed_by").order_by("due_date")

    context = {
        "unclaimed": chores.filter(status=Chore.Status.TODO, claimed_by__isnull=True),
        "claimed_todo": chores.filter(status=Chore.Status.TODO, claimed_by__isnull=False),
        "in_progress": chores.filter(status=Chore.Status.IN_PROGRESS),
        "done": chores.filter(status=Chore.Status.DONE),
        "members": HouseholdMember.objects.all(),
    }
    return render(request, "chores/board.html", context)


def claim_chore(request, chore_id):
    if request.method == "POST":
        chore = get_object_or_404(Chore, pk=chore_id, claimed_by__isnull=True)
        member = get_object_or_404(HouseholdMember, pk=request.POST.get("member_id"))
        chore.claimed_by = member
        chore.status = Chore.Status.IN_PROGRESS
        chore.save()
    return redirect("board")


def complete_chore(request, chore_id):
    if request.method == "POST":
        chore = get_object_or_404(Chore, pk=chore_id)
        now = timezone.now()

        if chore.recurrence_type == Chore.RecurrenceType.ONE_OFF:
            chore.status = Chore.Status.DONE
        else:
            base_date = chore.due_date or now.date()
            chore.due_date = base_date + datetime.timedelta(days=chore.recurrence_interval)
            chore.status = Chore.Status.TODO
            chore.claimed_by = None

        chore.last_completed_at = now
        chore.save()
    return redirect("board")
