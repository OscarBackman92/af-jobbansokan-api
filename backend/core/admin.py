from django.contrib import admin
from .models import EmployerProfile, JobApplication, JobPosting, Organization

@admin.register(JobApplication)
class JobApplicationAdmin(admin.ModelAdmin):
    list_display = ("id", "owner", "status", "applied_at", "created_at")
    list_filter = ("status", "applied_at", "created_at")
    search_fields = ("company", "role", "owner__username", "owner__email")

@admin.register(Organization)
class OrganizationAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "org_number", "created_at")
    search_fields = ("name", "org_number")


@admin.register(EmployerProfile)
class EmployerProfileAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "organization", "role", "created_at")
    list_filter = ("role",)
    search_fields = ("user__username", "user__email", "organization__name")


@admin.register(JobPosting)
class JobPostingAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "organization",
        "title",
        "company_name",
        "source",
        "external_id",
        "published_at",
        "created_at",
    )
    list_filter = ("source", "published_at", "created_at")
    search_fields = ("title", "company_name", "external_id", "organization__name")