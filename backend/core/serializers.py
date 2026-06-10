from __future__ import annotations

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import serializers

from .models import JobApplication, JobPosting, Organization

User = get_user_model()


class OrganizationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Organization
        fields = ["id", "name", "org_number", "created_at"]
        read_only_fields = ["id", "created_at"]


class JobPostingSerializer(serializers.ModelSerializer):
    """Lean list serializer — descriptions can be several kB each."""

    organization = OrganizationSerializer(read_only=True)
    # Explicit default so the UniqueConstraint on (source, external_id)
    # does not make this field required for manual postings.
    external_id = serializers.CharField(required=False, allow_blank=True, default="")

    class Meta:
        model = JobPosting
        fields = [
            "id",
            "organization",
            "source",
            "external_id",
            "title",
            "company_name",
            "location",
            "published_at",
            "created_at",
        ]
        read_only_fields = ["id", "organization", "created_at"]


class JobPostingDetailSerializer(JobPostingSerializer):
    """Full posting, including description and link to the original ad."""

    class Meta(JobPostingSerializer.Meta):
        fields = JobPostingSerializer.Meta.fields + ["description", "webpage_url"]


class JobApplicationSerializer(serializers.ModelSerializer):
    """
    Applicant-facing serializer:
    - Create: posting is provided as ID (write)
    - Read: posting is returned as ID (simple & stable)
    """

    class Meta:
        model = JobApplication
        fields = ["id", "posting", "applied_at", "status", "created_at"]
        read_only_fields = ["id", "status", "created_at"]

    def validate_applied_at(self, value):
        if value > timezone.localdate():
            raise serializers.ValidationError("applied_at cannot be in the future.")
        return value

    def validate(self, attrs):
        # Backstopped by the (owner, posting) unique constraint; owner is
        # not a serializer field, so DRF cannot generate this check itself.
        request = self.context.get("request")
        if (
            request
            and JobApplication.objects.filter(
                owner=request.user, posting=attrs["posting"]
            ).exists()
        ):
            raise serializers.ValidationError(
                {"posting": "You have already applied to this posting."}
            )
        return attrs


class PartnerApplicationEventSerializer(serializers.ModelSerializer):
    """Minimal disclosure for partner verification (least privilege):
    no applicant identifiers beyond what the partner already queried by,
    no application status.
    """

    posting_title = serializers.CharField(source="posting.title", read_only=True)
    company_name = serializers.CharField(source="posting.company_name", read_only=True)

    class Meta:
        model = JobApplication
        fields = ["id", "applied_at", "posting_title", "company_name", "created_at"]


class EmployerApplicantSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "username", "email"]


class EmployerPostingSerializer(serializers.ModelSerializer):
    organization = OrganizationSerializer(read_only=True)

    class Meta:
        model = JobPosting
        fields = [
            "id",
            "organization",
            "title",
            "company_name",
            "location",
            "published_at",
        ]


class EmployerJobApplicationSerializer(serializers.ModelSerializer):
    owner = EmployerApplicantSerializer(read_only=True)
    posting = EmployerPostingSerializer(read_only=True)

    class Meta:
        model = JobApplication
        fields = [
            "id",
            "owner",
            "posting",
            "applied_at",
            "status",
            "created_at",
        ]
