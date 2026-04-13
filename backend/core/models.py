from django.conf import settings
from django.db import models


class AuditLog(models.Model):
    """Immutable record of every security-relevant event in the system."""

    ACTION_CHOICES = [
        ("login",               "Login"),
        ("login_failed",        "Login failed"),
        ("logout",              "Logout"),
        ("application.create",  "Application created"),
        ("application.update",  "Application updated"),
        ("application.delete",  "Application deleted"),
        ("application.view",    "Application viewed"),
        ("posting.create",      "Posting created"),
        ("posting.update",      "Posting updated"),
        ("posting.delete",      "Posting deleted"),
        ("employer.view",       "Employer viewed applications"),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="audit_logs",
    )
    action = models.CharField(max_length=64, choices=ACTION_CHOICES, db_index=True)
    resource = models.CharField(max_length=64, blank=True)
    resource_id = models.CharField(max_length=64, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)
    detail = models.JSONField(default=dict, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-timestamp"]
        indexes = [
            models.Index(fields=["user", "timestamp"]),
        ]

    def __str__(self) -> str:
        return f"[{self.timestamp:%Y-%m-%d %H:%M:%S}] {self.action} by {self.user_id}"


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
