from datetime import timedelta

from django.conf import settings
from django.db import models
from django.utils import timezone

from .lifecycle import (
    OUTCOME_CHOICES,
    STAGE_AVSLUTAD,
    STAGE_BEVAKAD,
    STAGE_CHOICES,
    STAGE_SOKT,
    employer_key,
    outcome_for_status,
    stage_for_status,
)


class JobPosting(models.Model):
    """A job ad, imported from JobTech's open API or added by an admin."""

    source = models.CharField(max_length=50, default="manual")
    external_id = models.CharField(max_length=120, blank=True)
    title = models.CharField(max_length=255)
    company_name = models.CharField(max_length=255)
    location = models.CharField(max_length=255, blank=True)
    description = models.TextField(blank=True)
    webpage_url = models.URLField(max_length=500, blank=True)
    published_at = models.DateField(null=True, blank=True)
    application_deadline = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["source", "external_id"],
                name="uniq_jobposting_source_external_id",
                condition=~models.Q(external_id=""),
            )
        ]

    def __str__(self) -> str:
        return f"{self.title} ({self.company_name})"


class JobApplication(models.Model):
    """One row in the user's application tracker (the Excel row).

    Company and title are stored as free text so any application can be
    tracked, wherever the ad was found. When created from an imported
    posting they are copied in as a snapshot, so the row stays intact
    even if the posting disappears.
    """

    STATUS_WISHLIST = "wishlist"
    STATUS_APPLIED = "applied"
    STATUS_SCREENING = "screening"
    STATUS_INTERVIEW = "interview"
    STATUS_FORWARDED = "forwarded"
    STATUS_OFFER = "offer"
    STATUS_ACCEPTED = "accepted"
    STATUS_REJECTED = "rejected"
    STATUS_NO_RESPONSE = "no_response"
    STATUS_WITHDRAWN = "withdrawn"

    STATUS_CHOICES = [
        (STATUS_WISHLIST, "Sparad"),
        (STATUS_APPLIED, "Ansökt"),
        (STATUS_SCREENING, "Telefonintervju"),
        (STATUS_INTERVIEW, "Intervju"),
        (STATUS_FORWARDED, "Skickad vidare"),
        (STATUS_OFFER, "Erbjudande"),
        (STATUS_ACCEPTED, "Accepterat"),
        (STATUS_REJECTED, "Avslag"),
        (STATUS_NO_RESPONSE, "Inget svar"),
        (STATUS_WITHDRAWN, "Återkallad"),
    ]

    # Statuses shown as kanban columns; terminal ones collapse into an archive.
    ACTIVE_STATUSES = [
        STATUS_WISHLIST,
        STATUS_APPLIED,
        STATUS_SCREENING,
        STATUS_INTERVIEW,
        STATUS_FORWARDED,
        STATUS_OFFER,
    ]

    SOURCE_LINKEDIN = "linkedin"
    SOURCE_PLATSBANKEN = "platsbanken"
    SOURCE_COMPANY = "company"
    SOURCE_RECRUITER = "recruiter"
    SOURCE_OTHER = "other"
    SOURCE_CHOICES = [
        (SOURCE_LINKEDIN, "LinkedIn"),
        (SOURCE_PLATSBANKEN, "Platsbanken"),
        (SOURCE_COMPANY, "Företagets sida"),
        (SOURCE_RECRUITER, "Rekryterare"),
        (SOURCE_OTHER, "Annat"),
    ]

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="job_applications",
    )
    posting = models.ForeignKey(
        JobPosting,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="applications",
    )
    company = models.CharField(max_length=255)
    title = models.CharField(max_length=255)
    location = models.CharField(max_length=255, blank=True)
    ad_url = models.URLField(max_length=500, blank=True)
    apply_url = models.URLField(
        max_length=500,
        blank=True,
        help_text="Direct employer apply URL when Platsbanken provides one.",
    )
    ad_description = models.TextField(
        blank=True,
        help_text="Snapshot of the ad text when saved from Platsbanken.",
    )
    source_job_id = models.CharField(
        max_length=32,
        blank=True,
        help_text="JobTech ad id for refreshing the snapshot.",
    )
    source = models.CharField(max_length=32, blank=True, choices=SOURCE_CHOICES)
    status = models.CharField(
        max_length=50, choices=STATUS_CHOICES, default=STATUS_APPLIED
    )
    stage = models.CharField(
        max_length=20, choices=STAGE_CHOICES, default=STAGE_SOKT, db_index=True
    )
    outcome = models.CharField(max_length=24, choices=OUTCOME_CHOICES, blank=True)
    employer_key = models.CharField(max_length=255, blank=True, db_index=True)
    occupation_concept_id = models.CharField(max_length=64, blank=True, db_index=True)
    occupation_label = models.CharField(max_length=255, blank=True)
    closed_at = models.DateTimeField(null=True, blank=True)
    report_excluded = models.BooleanField(default=False)
    report_note = models.CharField(max_length=255, blank=True)
    reported_in = models.ForeignKey(
        "ReportPeriod",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="jobs",
    )
    INTENT_ACTIVE = "active"
    INTENT_PAUSED = "paused"
    INTENT_CHOICES = [
        (INTENT_ACTIVE, "Ska söka"),
        (INTENT_PAUSED, "Lagd på is"),
    ]
    AUTO_APPLY_BY_DAYS = 14

    intent = models.CharField(
        max_length=16, choices=INTENT_CHOICES, default=INTENT_ACTIVE
    )
    apply_by = models.DateField(
        null=True,
        blank=True,
        help_text="Sök senast — auto from deadline or created_at+14, editable.",
    )
    apply_by_is_auto = models.BooleanField(
        default=True,
        help_text="False when the user set apply_by themselves.",
    )
    archived_at = models.DateTimeField(null=True, blank=True)
    match_score = models.IntegerField(null=True, blank=True)
    match_snapshot = models.JSONField(default=dict, blank=True)
    match_version = models.IntegerField(default=2)
    match_scored_at = models.DateTimeField(null=True, blank=True)
    match_profile_id = models.CharField(max_length=32, blank=True)
    applied_at = models.DateField(null=True, blank=True)
    deadline = models.DateField(null=True, blank=True)
    contact_name = models.CharField(max_length=255, blank=True)
    contact_info = models.CharField(max_length=255, blank=True)
    notes = models.TextField(blank=True)
    next_action_at = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["owner", "posting"],
                name="uniq_jobapplication_owner_posting",
                condition=models.Q(posting__isnull=False),
            )
        ]
        indexes = [
            models.Index(fields=["owner", "stage", "applied_at"]),
        ]

    def __str__(self) -> str:
        return f"{self.title} @ {self.company} ({self.status})"

    def ensure_apply_by(self) -> bool:
        """Fill apply_by for wishlist rows when missing. Returns True if changed."""
        if self.status != self.STATUS_WISHLIST or self.apply_by is not None:
            return False
        if self.deadline:
            self.apply_by = self.deadline
            self.apply_by_is_auto = False
        else:
            if self.created_at:
                base = timezone.localtime(self.created_at).date()
            else:
                base = timezone.localdate()
            self.apply_by = base + timedelta(days=self.AUTO_APPLY_BY_DAYS)
            self.apply_by_is_auto = True
        return True

    def save(self, *args, **kwargs):
        self.stage = stage_for_status(self.status)
        self.outcome = outcome_for_status(self.status)
        self.employer_key = employer_key(self.company)
        if self.stage == STAGE_AVSLUTAD and self.closed_at is None:
            self.closed_at = timezone.now()
        if self.stage != STAGE_AVSLUTAD:
            self.closed_at = None
        if self.stage != STAGE_BEVAKAD and self.applied_at is None:
            self.applied_at = timezone.localdate()
        self.ensure_apply_by()
        super().save(*args, **kwargs)


class ApplicationEvent(models.Model):
    """Timeline entry on an application: a note, a call, a status change."""

    ORIGIN_MANUAL = "manuell"
    ORIGIN_AUTO = "auto"
    ORIGIN_IMPORT = "import"
    ORIGIN_CHOICES = [
        (ORIGIN_MANUAL, "Manuell"),
        (ORIGIN_AUTO, "Automatisk"),
        (ORIGIN_IMPORT, "Import"),
    ]

    application = models.ForeignKey(
        JobApplication,
        on_delete=models.CASCADE,
        related_name="events",
    )
    occurred_at = models.DateField()
    note = models.CharField(max_length=500)
    status = models.CharField(
        max_length=50, choices=JobApplication.STATUS_CHOICES, blank=True
    )
    event_type = models.CharField(max_length=24, blank=True)
    from_stage = models.CharField(max_length=20, blank=True)
    to_stage = models.CharField(max_length=20, blank=True)
    origin = models.CharField(
        max_length=12, choices=ORIGIN_CHOICES, default=ORIGIN_MANUAL
    )
    is_reportable = models.BooleanField(default=False)
    reported_in = models.ForeignKey(
        "ReportPeriod",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="job_events",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-occurred_at", "-id"]

    def __str__(self) -> str:
        return f"{self.occurred_at}: {self.note[:40]}"


class SavedJobSearch(models.Model):
    """A saved Platsbanken query the user can re-run with one click."""

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="saved_job_searches",
    )
    label = models.CharField(max_length=120, blank=True)
    q = models.CharField(max_length=255, blank=True)
    regions = models.JSONField(default=list, blank=True)
    municipalities = models.JSONField(default=list, blank=True)
    occupation_fields = models.JSONField(default=list, blank=True)
    occupation_groups = models.JSONField(default=list, blank=True)
    remote = models.BooleanField(default=False)
    match_cv = models.BooleanField(default=False)
    # Last time a digest e-mail included this search; drives "new since".
    digest_checked_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return self.label or self.q or "Sparad sökning"


class OperatorProfile(models.Model):
    """Per-user profile extras (operator id, retention bookkeeping)."""

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="operator_profile",
    )
    operator_id = models.CharField(max_length=16, unique=True)
    # Set when the inactivity warning mail is sent; cleared on activity.
    deletion_warned_at = models.DateTimeField(null=True, blank=True)
    # Idempotency for the Monday weekly summary cron.
    weekly_summary_sent_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return self.operator_id


class Resume(models.Model):
    """Structured CV for an applicant.

    Uploaded CV files are never stored — parsing happens in memory and
    only the structured fields the user chooses to save are kept.
    """

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="resume",
    )
    headline = models.CharField(max_length=255, blank=True)
    summary = models.TextField(blank=True)
    skills = models.JSONField(default=list, blank=True)
    skill_groups = models.JSONField(default=dict, blank=True)
    experience = models.JSONField(default=list, blank=True)
    education = models.JSONField(default=list, blank=True)
    job_profiles = models.JSONField(default=list, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:
        return f"CV: {self.user.get_username()}"


class ReportPeriod(models.Model):
    """A calendar month as an AF reporting object. Status is derived, never stored."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="report_periods",
    )
    year = models.IntegerField()
    month = models.IntegerField()
    submitted_at = models.DateTimeField(null=True, blank=True)
    note = models.TextField(blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["user", "year", "month"],
                name="uniq_reportperiod_user_year_month",
            )
        ]
        ordering = ["-year", "-month"]

    def __str__(self) -> str:
        return f"{self.year}-{self.month:02d} ({self.user})"


class Activity(models.Model):
    """Something other than a job application that belongs in the AF report."""

    TYPE_REKRYTERINGSTRAFF = "rekryteringstraff"
    TYPE_KURS = "kurs"
    TYPE_SPONTANANSOKAN = "spontanansokan"
    TYPE_NATVERKANDE = "natverkande"
    TYPE_CV_ARBETE = "cv_arbete"
    TYPE_MOTE_AF = "mote_af"
    TYPE_OVRIGT = "ovrigt"
    TYPE_CHOICES = [
        (TYPE_REKRYTERINGSTRAFF, "Rekryteringsträff / mässa"),
        (TYPE_KURS, "Kurs / utbildning"),
        (TYPE_SPONTANANSOKAN, "Spontanansökan"),
        (TYPE_NATVERKANDE, "Nätverkskontakt"),
        (TYPE_CV_ARBETE, "CV / personligt brev"),
        (TYPE_MOTE_AF, "Möte med AF eller leverantör"),
        (TYPE_OVRIGT, "Övrigt"),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="activities",
    )
    type = models.CharField(max_length=24, choices=TYPE_CHOICES)
    occurred_on = models.DateField()
    title = models.CharField(max_length=255)
    organisation = models.CharField(max_length=255, blank=True)
    note = models.TextField(blank=True)
    job = models.ForeignKey(
        JobApplication,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="activities",
    )
    reported_in = models.ForeignKey(
        ReportPeriod,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="activities",
    )

    class Meta:
        ordering = ["-occurred_on", "-id"]

    def __str__(self) -> str:
        return f"{self.occurred_on}: {self.title}"
