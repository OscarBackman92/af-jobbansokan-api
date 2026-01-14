from __future__ import annotations

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
    Applicant-facing serializer:
    - Create: posting is provided as ID (write)
    - Read: posting is returned as ID (simple & stable)
    """

    class Meta:
        model = JobApplication
        fields = ["id", "posting", "applied_at", "status", "created_at"]
        read_only_fields = ["id", "status", "created_at"]



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
