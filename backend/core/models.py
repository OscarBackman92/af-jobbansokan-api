from django.conf import settings
from django.db import models


class JobApplication(models.Model):
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="job_applications",
    )
    posting = models.ForeignKey(
        "JobPosting",
        on_delete=models.CASCADE,
        related_name="applications",
    )
    applied_at = models.DateField()
    status = models.CharField(
        max_length=50,
        choices=[
            ("applied", "Applied"),
            ("interview", "Interview"),
            ("offer", "Offer"),
            ("rejected", "Rejected"),
        ],
        default="applied",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["owner", "posting"],
                name="uniq_jobapplication_owner_posting",
            )
        ]

    def __str__(self) -> str:
        return f"{self.owner} -> {self.posting}"


class Organization(models.Model):
    """An organization that can publish job postings."""

    name = models.CharField(max_length=255)
    org_number = models.CharField(max_length=32, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return str(self.name)


class EmployerProfile(models.Model):
    """Profile connecting a user to an organization as an employer."""

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="employer_profile",
    )
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="employers",
    )
    role = models.CharField(
        max_length=32,
        choices=[
            ("admin", "Admin"),
            ("member", "Member"),
        ],
        default="member",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return f"{self.user.get_username()} @ {self.organization.name}"


class Favorite(models.Model):
    """A posting saved by a user."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="favorites",
    )
    posting = models.ForeignKey(
        "JobPosting",
        on_delete=models.CASCADE,
        related_name="favorited_by",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["user", "posting"],
                name="uniq_favorite_user_posting",
            )
        ]

    def __str__(self) -> str:
        return f"{self.user} ★ {self.posting_id}"


class AuditLog(models.Model):
    """Append-only audit trail for creation and disclosure of application data.

    Rows must never be updated or deleted; corrections are recorded as new
    entries. The actor is kept nullable so entries survive account deletion.
    """

    ACTION_APPLICATION_CREATED = "application.created"
    ACTION_APPLICATION_DELETED = "application.deleted"
    ACTION_APPLICATIONS_DISCLOSED = "applications.disclosed"
    ACTION_PARTNER_DISCLOSED = "applications.disclosed_partner"
    ACTION_IDENTITY_VERIFIED = "identity.verified"
    ACTION_ACCOUNT_DELETED = "account.deleted"
    ACTION_STATUS_CHANGED = "application.status_changed"

    ACTION_CHOICES = [
        (ACTION_APPLICATION_CREATED, "Application created"),
        (ACTION_APPLICATION_DELETED, "Application deleted"),
        (ACTION_APPLICATIONS_DISCLOSED, "Applications disclosed"),
        (ACTION_PARTNER_DISCLOSED, "Applications disclosed to partner"),
        (ACTION_IDENTITY_VERIFIED, "Identity verified"),
        (ACTION_ACCOUNT_DELETED, "Account deleted"),
        (ACTION_STATUS_CHANGED, "Application status changed"),
    ]

    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="audit_entries",
    )
    action = models.CharField(max_length=64, choices=ACTION_CHOICES)
    target_type = models.CharField(max_length=64, blank=True)
    target_id = models.CharField(max_length=64, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.action} by {self.actor} at {self.created_at:%Y-%m-%d %H:%M}"


class ApplicantProfile(models.Model):
    """A verified, pseudonymized identity for an applicant.

    Holds only a keyed hash of the personal identity number — the raw
    number is never persisted. Partner lookups by personnummer resolve
    through the same hash. See docs/08-identity-bankid.md.
    """

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="applicant_profile",
    )
    personal_number_hash = models.CharField(max_length=64, unique=True)
    method = models.CharField(max_length=32, default="bankid-mock")
    verified_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return f"{self.user.get_username()} ({self.method})"


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


class PartnerClient(models.Model):
    """An authorized partner system (e.g. an A-kassa).

    Authenticates with an API key; only the SHA-256 hash of the key is
    stored, so the key is shown once at creation and cannot be recovered.
    """

    name = models.CharField(max_length=255, unique=True)
    key_hash = models.CharField(max_length=64, unique=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return str(self.name)


class JobPosting(models.Model):
    """A job advertisement published by an organization."""

    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="job_postings",
    )
    source = models.CharField(max_length=50, default="manual")
    external_id = models.CharField(max_length=120, blank=True)
    title = models.CharField(max_length=255)
    company_name = models.CharField(max_length=255)
    location = models.CharField(max_length=255, blank=True)
    description = models.TextField(blank=True)
    webpage_url = models.URLField(max_length=500, blank=True)
    published_at = models.DateField(null=True, blank=True)
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
