from django.contrib import admin
from unfold.admin import ModelAdmin, TabularInline

from .models import ApplicationEvent, JobApplication, JobPosting


class ApplicationEventInline(TabularInline):
    model = ApplicationEvent
    extra = 0


@admin.register(JobApplication)
class JobApplicationAdmin(ModelAdmin):
    list_display = ("id", "owner", "company", "title", "status", "applied_at")
    list_filter = ("status", "applied_at", "created_at")
    search_fields = ("company", "title", "owner__username", "owner__email")
    inlines = [ApplicationEventInline]


@admin.register(JobPosting)
class JobPostingAdmin(ModelAdmin):
    list_display = (
        "id",
        "title",
        "company_name",
        "location",
        "source",
        "external_id",
        "published_at",
        "created_at",
    )
    list_filter = ("source", "published_at", "created_at")
    search_fields = ("title", "company_name", "external_id")
