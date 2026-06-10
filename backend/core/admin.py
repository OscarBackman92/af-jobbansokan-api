from django.contrib import admin

from .models import (
    AuditLog,
    EmployerProfile,
    JobApplication,
    JobPosting,
    Organization,
)


@admin.register(JobApplication)
class JobApplicationAdmin(admin.ModelAdmin):
    list_display = ("id", "owner", "status", "applied_at", "created_at")
    list_filter = ("status", "applied_at", "created_at")
    search_fields = ("posting__title", "owner__username", "owner__email")


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


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    """Read-only: the audit trail must not be editable, even by admins."""

    list_display = ("id", "created_at", "action", "actor", "target_type", "target_id")
    list_filter = ("action", "created_at")
    search_fields = ("actor__username", "target_type", "target_id")

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
