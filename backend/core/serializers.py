from __future__ import annotations

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
