from django.urls import path

from . import views

urlpatterns = [
    path("", views.board_view, name="board"),
    path("chore/<int:chore_id>/claim/", views.claim_chore, name="claim_chore"),
    path("chore/<int:chore_id>/complete/", views.complete_chore, name="complete_chore"),
]
