from django.contrib import admin

from .models import Chore, HouseholdMember


@admin.register(HouseholdMember)
class HouseholdMemberAdmin(admin.ModelAdmin):
    list_display = ("name",)


@admin.register(Chore)
class ChoreAdmin(admin.ModelAdmin):
    list_display = (
        "title",
        "status",
        "recurrence_type",
        "claimed_by",
        "due_date",
        "time_estimate",
        "is_stale",
    )
    list_filter = ("status", "recurrence_type", "time_estimate")
