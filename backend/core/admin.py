from datetime import timedelta

from allauth.account import signals as allauth_signals
from allauth.account.models import EmailAddress
from django.contrib import admin, messages
from django.contrib.auth.admin import GroupAdmin as DjangoGroupAdmin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin
from django.contrib.auth.models import Group, User
from django.db.models import Count, Exists, OuterRef
from django.http import HttpRequest
from django.utils import timezone
from unfold.admin import ModelAdmin, StackedInline, TabularInline
from unfold.contrib.filters.admin import (
    ChoicesDropdownFilter,
    RangeDateFilter,
    RangeDateTimeFilter,
)
from unfold.decorators import display
from unfold.forms import AdminPasswordChangeForm, UserChangeForm, UserCreationForm

from .lifecycle import STAGE_AVSLUTAD
from .models import (
    Activity,
    ApplicationEvent,
    JobApplication,
    JobPosting,
    OperatorProfile,
    ReportPeriod,
    Resume,
    SavedJobSearch,
)

STATUS_LABELS = {
    "Sparad": "info",
    "Ansökt": "primary",
    "Telefonintervju": "warning",
    "Intervju": "warning",
    "Skickad vidare": "warning",
    "Erbjudande": "success",
    "Accepterat": "success",
    "Avslag": "danger",
    "Inget svar": "danger",
    "Återkallad": "danger",
}

STAGE_LABELS = {
    "Bevakad": "info",
    "Sökt": "primary",
    "Kontakt": "warning",
    "Intervju": "warning",
    "Erbjudande": "success",
    "Avslutad": "danger",
}


class OverdueFollowUpFilter(admin.SimpleListFilter):
    title = "Uppföljning"
    parameter_name = "follow_up"

    def lookups(self, request, model_admin):
        del request, model_admin
        return (
            ("overdue", "Försenad"),
            ("today", "Idag"),
            ("week", "Kommande 7 dagar"),
            ("missing", "Saknar datum"),
        )

    def queryset(self, request, queryset):
        del request
        today = timezone.localdate()
        if self.value() == "overdue":
            return queryset.filter(next_action_at__lt=today).exclude(
                stage=STAGE_AVSLUTAD
            )
        if self.value() == "today":
            return queryset.filter(next_action_at=today)
        if self.value() == "week":
            return queryset.filter(
                next_action_at__gte=today,
                next_action_at__lte=today + timedelta(days=7),
            )
        if self.value() == "missing":
            return queryset.filter(next_action_at__isnull=True).exclude(
                stage=STAGE_AVSLUTAD
            )
        return queryset


class ApplicationEventInline(TabularInline):
    model = ApplicationEvent
    extra = 0
    tab = True
    show_change_link = True
    fields = (
        "occurred_at",
        "note",
        "status",
        "event_type",
        "origin",
        "is_reportable",
        "report_excluded",
    )
    ordering = ("-occurred_at", "-id")


class OperatorProfileInline(StackedInline):
    model = OperatorProfile
    extra = 0
    max_num = 1
    tab = True
    fields = (
        "operator_id",
        "deletion_warned_at",
        "weekly_summary_sent_at",
        "created_at",
    )
    readonly_fields = ("created_at",)


class ResumeInline(StackedInline):
    model = Resume
    extra = 0
    max_num = 1
    tab = True
    fields = ("headline", "summary", "skills", "updated_at")
    readonly_fields = ("updated_at",)


class ApplicationEventAdmin(ModelAdmin):
    list_display = (
        "occurred_at",
        "application",
        "note_preview",
        "status",
        "origin",
        "is_reportable",
    )
    list_filter = (
        ("status", ChoicesDropdownFilter),
        ("origin", ChoicesDropdownFilter),
        "is_reportable",
        ("occurred_at", RangeDateFilter),
    )
    search_fields = (
        "note",
        "application__company",
        "application__title",
        "application__owner__email",
    )
    autocomplete_fields = ("application", "reported_in")
    date_hierarchy = "occurred_at"
    list_select_related = ("application", "application__owner")
    list_per_page = 50
    compressed_fields = True

    @display(description="Anteckning")
    def note_preview(self, obj: ApplicationEvent) -> str:
        note = obj.note or ""
        return note if len(note) <= 72 else note[:69] + "…"


@admin.register(JobApplication)
class JobApplicationAdmin(ModelAdmin):
    list_display = (
        "company",
        "title",
        "owner",
        "status_badge",
        "stage_badge",
        "applied_at",
        "next_action_at",
        "match_score",
    )
    list_filter = (
        ("status", ChoicesDropdownFilter),
        ("stage", ChoicesDropdownFilter),
        ("source", ChoicesDropdownFilter),
        ("intent", ChoicesDropdownFilter),
        OverdueFollowUpFilter,
        "report_excluded",
        ("applied_at", RangeDateFilter),
        ("created_at", RangeDateFilter),
    )
    search_fields = (
        "company",
        "title",
        "location",
        "notes",
        "owner__username",
        "owner__email",
        "owner__operator_profile__operator_id",
    )
    search_help_text = "Företag, titel, ägare, operator-id eller anteckning"
    autocomplete_fields = ("owner", "posting", "reported_in")
    inlines = [ApplicationEventInline]
    date_hierarchy = "applied_at"
    list_select_related = ("owner",)
    list_filter_submit = True
    list_fullwidth = True
    list_per_page = 50
    compressed_fields = True
    warn_unsaved_form = True
    empty_value_display = "—"
    ordering = ("-updated_at",)
    readonly_fields = (
        "stage",
        "outcome",
        "employer_key",
        "created_at",
        "updated_at",
        "closed_at",
        "match_scored_at",
    )
    fieldsets = (
        (
            "Jobbet",
            {
                "fields": (
                    "owner",
                    "company",
                    "title",
                    "location",
                    "source",
                    "ad_url",
                    "apply_url",
                    "ad_description",
                    "source_job_id",
                    "posting",
                )
            },
        ),
        (
            "Status",
            {
                "fields": (
                    "status",
                    "stage",
                    "outcome",
                    "intent",
                    "applied_at",
                    "deadline",
                    "apply_by",
                    "apply_by_is_auto",
                    "next_action_at",
                    "archived_at",
                    "closed_at",
                    "salary_claim",
                )
            },
        ),
        (
            "Match & yrke",
            {
                "classes": ["collapse"],
                "fields": (
                    "match_score",
                    "match_version",
                    "match_scored_at",
                    "occupation_label",
                    "occupation_group_label",
                    "occupation_concept_id",
                    "working_hours_type",
                    "scope_of_work_min",
                    "scope_of_work_max",
                ),
            },
        ),
        (
            "Kontakt & anteckningar",
            {"fields": ("contact_name", "contact_info", "notes")},
        ),
        (
            "AF-rapport",
            {
                "fields": (
                    "report_excluded",
                    "report_note",
                    "reported_in",
                    "employer_key",
                )
            },
        ),
        (
            "Tekniskt",
            {
                "classes": ["collapse"],
                "fields": ("created_at", "updated_at"),
            },
        ),
    )
    actions = ("exclude_from_report", "include_in_report")

    @display(
        description="Status",
        ordering="status",
        label=STATUS_LABELS,
    )
    def status_badge(self, obj: JobApplication) -> str:
        return obj.get_status_display()

    @display(
        description="Fas",
        ordering="stage",
        label=STAGE_LABELS,
    )
    def stage_badge(self, obj: JobApplication) -> str:
        return obj.get_stage_display()

    @admin.action(description="Uteslut från AF-rapport")
    def exclude_from_report(self, request: HttpRequest, queryset) -> None:
        updated = queryset.update(report_excluded=True)
        self.message_user(
            request,
            f"{updated} ansökningar uteslutna från rapporten.",
            messages.SUCCESS,
        )

    @admin.action(description="Ta med i AF-rapport")
    def include_in_report(self, request: HttpRequest, queryset) -> None:
        updated = queryset.update(report_excluded=False)
        self.message_user(
            request,
            f"{updated} ansökningar tas med i rapporten igen.",
            messages.SUCCESS,
        )


@admin.register(JobPosting)
class JobPostingAdmin(ModelAdmin):
    """Read-only legacy data.

    The posting import and API were removed; the model only remains so
    old rows (and their application FKs) survive. No new rows should be
    created — deletion stays possible for manual cleanup.
    """

    list_display = (
        "title",
        "company_name",
        "location",
        "source",
        "external_id",
        "published_at",
        "created_at",
    )
    list_filter = ("source", ("published_at", RangeDateFilter), "created_at")
    search_fields = ("title", "company_name", "external_id", "location")
    date_hierarchy = "created_at"
    list_per_page = 50
    compressed_fields = True

    def has_add_permission(self, request: HttpRequest) -> bool:
        del request
        return False

    def has_change_permission(self, request: HttpRequest, obj=None) -> bool:
        del request, obj
        return False


@admin.register(ReportPeriod)
class ReportPeriodAdmin(ModelAdmin):
    list_display = (
        "user",
        "year",
        "month",
        "submitted_badge",
        "job_count",
        "submitted_at",
    )
    list_filter = ("year", "month")
    search_fields = ("user__username", "user__email")
    autocomplete_fields = ("user",)
    list_select_related = ("user",)
    list_per_page = 50
    compressed_fields = True
    warn_unsaved_form = True

    def get_queryset(self, request: HttpRequest):
        qs = super().get_queryset(request)
        return qs.annotate(_job_count=Count("jobs", distinct=True))

    @display(description="Jobb", ordering="_job_count")
    def job_count(self, obj: ReportPeriod) -> int:
        return int(getattr(obj, "_job_count", 0))

    @display(
        description="Rapporterad",
        boolean=True,
        ordering="submitted_at",
    )
    def submitted_badge(self, obj: ReportPeriod) -> bool:
        return obj.submitted_at is not None


@admin.register(Activity)
class ActivityAdmin(ModelAdmin):
    list_display = ("occurred_on", "user", "type", "title", "organisation")
    list_filter = (
        ("type", ChoicesDropdownFilter),
        ("occurred_on", RangeDateFilter),
        "report_excluded",
    )
    search_fields = (
        "title",
        "organisation",
        "note",
        "user__username",
        "user__email",
    )
    autocomplete_fields = ("user", "job", "reported_in")
    date_hierarchy = "occurred_on"
    list_select_related = ("user",)
    list_per_page = 50
    compressed_fields = True
    warn_unsaved_form = True


@admin.register(SavedJobSearch)
class SavedJobSearchAdmin(ModelAdmin):
    list_display = (
        "label",
        "owner",
        "q",
        "remote",
        "match_cv",
        "created_at",
    )
    list_filter = ("remote", "match_cv", ("created_at", RangeDateTimeFilter))
    search_fields = ("label", "q", "owner__email", "owner__username")
    autocomplete_fields = ("owner",)
    list_select_related = ("owner",)
    date_hierarchy = "created_at"
    list_per_page = 50
    compressed_fields = True


@admin.register(OperatorProfile)
class OperatorProfileAdmin(ModelAdmin):
    list_display = (
        "operator_id",
        "user",
        "deletion_warned_at",
        "weekly_summary_sent_at",
        "created_at",
    )
    search_fields = ("operator_id", "user__email", "user__username")
    autocomplete_fields = ("user",)
    list_select_related = ("user",)
    list_filter = (("deletion_warned_at", RangeDateTimeFilter),)
    list_per_page = 50
    compressed_fields = True
    readonly_fields = ("created_at",)


@admin.register(Resume)
class ResumeAdmin(ModelAdmin):
    list_display = ("user", "headline", "skill_count", "updated_at")
    search_fields = ("user__email", "user__username", "headline", "summary")
    autocomplete_fields = ("user",)
    list_select_related = ("user",)
    list_per_page = 50
    compressed_fields = True
    readonly_fields = ("updated_at",)

    @display(description="Kompetenser")
    def skill_count(self, obj: Resume) -> int:
        skills = obj.skills if isinstance(obj.skills, list) else []
        return len(skills)


class EmailAddressAdmin(ModelAdmin):
    list_display = ("email", "user", "primary", "verified")
    list_filter = ("primary", "verified")
    search_fields = ("email", "user__email", "user__username")
    autocomplete_fields = ("user",)
    list_select_related = ("user",)
    list_per_page = 50
    compressed_fields = True
    actions = ("make_verified",)

    @admin.action(description="Markera valda adresser som verifierade")
    def make_verified(self, request: HttpRequest, queryset) -> None:
        for email_address in queryset.filter(verified=False).iterator():
            if email_address.set_verified():
                allauth_signals.email_confirmed.send(
                    sender=EmailAddress,
                    request=request,
                    email_address=email_address,
                )
                self.message_user(
                    request,
                    f"{email_address.email} är verifierad.",
                    level=messages.SUCCESS,
                )
            else:
                self.message_user(
                    request,
                    f"Kunde inte verifiera {email_address.email}.",
                    level=messages.ERROR,
                )


class JobbdjungelnUserAdmin(DjangoUserAdmin, ModelAdmin):
    form = UserChangeForm
    add_form = UserCreationForm
    change_password_form = AdminPasswordChangeForm
    compressed_fields = True
    warn_unsaved_form = True
    list_fullwidth = True
    list_filter_submit = True
    list_per_page = 50
    inlines = [OperatorProfileInline, ResumeInline]
    list_display = (
        "username",
        "email",
        "operator_id_display",
        "application_count",
        "email_verified",
        "is_staff",
        "is_active",
        "date_joined",
        "last_login",
    )
    list_filter = (
        "is_staff",
        "is_superuser",
        "is_active",
        ("date_joined", RangeDateTimeFilter),
    )
    search_fields = (
        "username",
        "first_name",
        "last_name",
        "email",
        "operator_profile__operator_id",
    )
    ordering = ("-date_joined",)

    def get_queryset(self, request: HttpRequest):
        qs = super().get_queryset(request)
        verified = EmailAddress.objects.filter(
            user=OuterRef("pk"), primary=True, verified=True
        )
        return qs.select_related("operator_profile").annotate(
            _application_count=Count("job_applications", distinct=True),
            _email_verified=Exists(verified),
        )

    @display(
        description="Operator-id",
        ordering="operator_profile__operator_id",
    )
    def operator_id_display(self, obj: User) -> str:
        profile = getattr(obj, "operator_profile", None)
        return profile.operator_id if profile else "—"

    @display(description="Ansökningar", ordering="_application_count")
    def application_count(self, obj: User) -> int:
        return int(getattr(obj, "_application_count", 0))

    @display(description="Mejl ok", boolean=True, ordering="_email_verified")
    def email_verified(self, obj: User) -> bool:
        return bool(getattr(obj, "_email_verified", False))


class JobbdjungelnGroupAdmin(DjangoGroupAdmin, ModelAdmin):
    compressed_fields = True


admin.site.unregister(User)
admin.site.unregister(Group)
admin.site.register(User, JobbdjungelnUserAdmin)
admin.site.register(Group, JobbdjungelnGroupAdmin)
admin.site.unregister(EmailAddress)
admin.site.register(EmailAddress, EmailAddressAdmin)
admin.site.register(ApplicationEvent, ApplicationEventAdmin)
