from __future__ import annotations

from datetime import date

from django.contrib.auth import get_user_model
from rest_framework import serializers

from .models import JobApplication, JobPosting, Organization

User = get_user_model()


class OrganizationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Organization
        fields = ["id", "name", "org_number", "created_at"]
        read_only_fields = ["id", "created_at"]


class JobPostingSerializer(serializers.ModelSerializer):
    organization = OrganizationSerializer(read_only=True)
    external_id = serializers.CharField(required=False, allow_blank=True, max_length=120, default="")

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


class JobApplicationSerializer(serializers.ModelSerializer):
    """
    Applicant-facing serializer.
    - Create: posting accepted as PK, status defaults to "applied".
    - Update: applicant can update applied_at and status to track progress.
    - Read: posting returned as PK; use posting_detail for nested data.
    """

    posting_detail = JobPostingSerializer(source="posting", read_only=True)

    class Meta:
        model = JobApplication
        fields = ["id", "posting", "posting_detail", "applied_at", "status", "created_at"]
        read_only_fields = ["id", "created_at"]
        extra_kwargs = {
            "posting": {"write_only": True},
        }

    def validate_applied_at(self, value: date) -> date:
        if value > date.today():
            raise serializers.ValidationError("applied_at cannot be in the future.")
        return value

    def validate_status(self, value: str) -> str:
        valid = {"applied", "interview", "offer", "rejected"}
        if value not in valid:
            raise serializers.ValidationError(
                f"Invalid status. Choose from: {', '.join(sorted(valid))}."
            )
        return value


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
        read_only_fields = ["id", "owner", "posting", "applied_at", "created_at"]


class EmployerApplicationStatusSerializer(serializers.ModelSerializer):
    """Employer-facing serializer that allows only status updates."""

    class Meta:
        model = JobApplication
        fields = ["id", "status"]
        read_only_fields = ["id"]
