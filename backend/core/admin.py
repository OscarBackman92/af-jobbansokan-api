from django.contrib import admin
from .models import JobApplication

@admin.register(JobApplication)
class JobApplicationAdmin(admin.ModelAdmin):
    list_display = ("id", "owner", "company", "role", "status", "applied_at", "created_at")
    list_filter = ("status", "applied_at", "created_at")
    search_fields = ("company", "role", "owner__username", "owner__email")
