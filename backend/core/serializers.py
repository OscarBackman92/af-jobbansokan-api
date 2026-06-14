from __future__ import annotations

from dj_rest_auth.registration.serializers import RegisterSerializer
from dj_rest_auth.serializers import PasswordResetSerializer
from django.conf import settings
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import serializers

from .models import (
    ApplicationEvent,
    Favorite,
    JobApplication,
    JobPosting,
    Resume,
)

User = get_user_model()


class JobPostingSerializer(serializers.ModelSerializer):
    """Lean list serializer — descriptions can be several kB each."""

    class Meta:
        model = JobPosting
        fields = [
            "id",
            "source",
            "external_id",
            "title",
            "company_name",
            "location",
            "published_at",
            "application_deadline",
            "created_at",
        ]
        read_only_fields = fields


class JobPostingDetailSerializer(JobPostingSerializer):
    """Full posting, including description and link to the original ad."""

    class Meta(JobPostingSerializer.Meta):
        fields = JobPostingSerializer.Meta.fields + ["description", "webpage_url"]
        read_only_fields = fields


class ApplicationEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = ApplicationEvent
        fields = ["id", "occurred_at", "note", "status", "created_at"]
        read_only_fields = ["id", "created_at"]

    def validate_occurred_at(self, value):
        if value > timezone.localdate():
            raise serializers.ValidationError("occurred_at cannot be in the future.")
        return value


class JobApplicationSerializer(serializers.ModelSerializer):
    """One tracker row.

    Created either from an imported posting (pass `posting`, company and
    title are snapshotted from it) or as free text (pass `company` and
    `title` directly).
    """

    events = ApplicationEventSerializer(many=True, read_only=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = JobApplication
        fields = [
            "id",
            "posting",
            "company",
            "title",
            "location",
            "ad_url",
            "status",
            "status_label",
            "applied_at",
            "deadline",
            "contact_name",
            "contact_info",
            "notes",
            "next_action_at",
            "events",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "events", "created_at", "updated_at"]
        extra_kwargs = {
            "company": {"required": False, "allow_blank": True},
            "title": {"required": False, "allow_blank": True},
        }

    def validate_applied_at(self, value):
        if value and value > timezone.localdate():
            raise serializers.ValidationError("applied_at cannot be in the future.")
        return value

    def validate(self, attrs):
        posting = attrs.get("posting") or getattr(self.instance, "posting", None)

        # Snapshot posting fields on create so the row is self-contained.
        if posting and not self.instance:
            attrs.update(
                company=attrs.get("company") or posting.company_name,
                title=attrs.get("title") or posting.title,
                location=attrs.get("location") or posting.location,
                ad_url=attrs.get("ad_url") or posting.webpage_url,
                deadline=attrs.get("deadline") or posting.application_deadline,
            )

        company = attrs.get("company", getattr(self.instance, "company", ""))
        title = attrs.get("title", getattr(self.instance, "title", ""))
        if not company or not title:
            raise serializers.ValidationError(
                "Provide a posting, or company and title."
            )

        # Backstopped by the conditional unique constraint; owner is not a
        # serializer field, so DRF cannot generate this check itself.
        request = self.context.get("request")
        if (
            posting
            and request
            and not self.instance
            and JobApplication.objects.filter(
                owner=request.user, posting=posting
            ).exists()
        ):
            raise serializers.ValidationError(
                {"posting": "You already track an application for this posting."}
            )
        return attrs


class StatusCountSerializer(serializers.Serializer):
    """Aggregate row for the dashboard: one status and its count."""

    status = serializers.CharField()
    label = serializers.CharField()
    count = serializers.IntegerField()


class EmailRegisterSerializer(RegisterSerializer):
    """Registration by e-mail only — no username field in the API.

    dj-rest-auth's own duplicate check only rejects *verified* addresses,
    and we never send verification mail, so enforce uniqueness here.
    """

    username = None

    def validate_email(self, email):
        email = super().validate_email(email)
        if User.objects.filter(email__iexact=email).exists():
            raise serializers.ValidationError(
                "Det finns redan ett konto med den här e-postadressen."
            )
        return email


def _spa_reset_url(request, user, temp_key):
    """Build the reset link that lands on the SPA.

    Uses allauth's uid encoding + token so the confirm endpoint (which
    decodes with allauth) matches. Points at FRONTEND_URL when set,
    otherwise the request's own origin (single-service / local dev).
    """
    from allauth.account.utils import user_pk_to_url_str

    base = settings.FRONTEND_URL or f"{request.scheme}://{request.get_host()}"
    uid = user_pk_to_url_str(user)
    return f"{base.rstrip('/')}/?reset_uid={uid}&reset_token={temp_key}"


class FrontendPasswordResetSerializer(PasswordResetSerializer):
    """Send the reset link to the SPA rather than Django's default view.

    allauth's reset form takes a custom ``url_generator``; ours points the
    e-mailed link at the SPA carrying uid + token as query params, which
    the app reads to show the set-new-password form.
    """

    def get_email_options(self):
        return {"url_generator": _spa_reset_url}


class ProfileSerializer(serializers.ModelSerializer):
    """The authenticated user's own profile."""

    class Meta:
        model = User
        fields = ["id", "username", "email", "first_name", "last_name"]
        read_only_fields = ["id", "username"]


class ResumeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Resume
        fields = [
            "headline",
            "summary",
            "skills",
            "experience",
            "education",
            "updated_at",
        ]
        read_only_fields = ["updated_at"]

    def validate_skills(self, value):
        if not isinstance(value, list) or not all(
            isinstance(item, str) for item in value
        ):
            raise serializers.ValidationError("Expected a list of strings.")
        return [item.strip() for item in value if item.strip()]

    def _validate_rows(self, value, allowed_keys):
        if not isinstance(value, list) or not all(
            isinstance(item, dict) for item in value
        ):
            raise serializers.ValidationError("Expected a list of objects.")
        for item in value:
            unknown = set(item) - allowed_keys
            if unknown:
                raise serializers.ValidationError(
                    f"Unknown fields: {', '.join(sorted(unknown))}"
                )
        return value

    def validate_experience(self, value):
        return self._validate_rows(value, {"title", "company", "years", "description"})

    def validate_education(self, value):
        return self._validate_rows(value, {"school", "degree", "years"})


class ResumeUploadSerializer(serializers.Serializer):
    file = serializers.FileField()


class FavoriteSerializer(serializers.ModelSerializer):
    posting_title = serializers.CharField(source="posting.title", read_only=True)
    company_name = serializers.CharField(source="posting.company_name", read_only=True)

    class Meta:
        model = Favorite
        fields = ["id", "posting", "posting_title", "company_name", "created_at"]
        read_only_fields = ["id", "created_at"]

    def validate_posting(self, value):
        request = self.context.get("request")
        if (
            request
            and Favorite.objects.filter(user=request.user, posting=value).exists()
        ):
            raise serializers.ValidationError("Already saved.")
        return value
