from django.conf import settings
from django.db import models


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
    status = models.CharField(
        max_length=50, choices=STATUS_CHOICES, default=STATUS_APPLIED
    )
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

    def __str__(self) -> str:
        return f"{self.title} @ {self.company} ({self.status})"


class ApplicationEvent(models.Model):
    """Timeline entry on an application: a note, a call, a status change."""

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
    region = models.CharField(max_length=80, blank=True)
    municipality = models.CharField(max_length=80, blank=True)
    field = models.CharField(max_length=80, blank=True)
    group = models.CharField(max_length=80, blank=True)
    remote = models.BooleanField(default=False)
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
    experience = models.JSONField(default=list, blank=True)
    education = models.JSONField(default=list, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:
        return f"CV: {self.user.get_username()}"
