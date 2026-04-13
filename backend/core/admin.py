from django.contrib import admin
from .models import AuditLog, EmployerProfile, JobApplication, JobPosting, Organization

@admin.register(JobApplication)
class JobApplicationAdmin(admin.ModelAdmin):
    list_display = ("id", "owner", "status", "applied_at", "created_at")
    list_filter = ("status", "applied_at", "created_at")
    search_fields = ("owner__username", "owner__email", "posting__title", "posting__company_name")

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
    list_display = ("timestamp", "action", "user", "resource", "resource_id", "ip_address")
    list_filter = ("action", "timestamp")
    search_fields = ("user__username", "resource", "resource_id", "ip_address")
    readonly_fields = ("timestamp", "user", "action", "resource", "resource_id", "ip_address", "user_agent", "detail")

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False