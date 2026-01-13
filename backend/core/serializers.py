from rest_framework import serializers

from .models import JobPosting, Organization, JobApplication


class JobApplicationSerializer(serializers.ModelSerializer):
    class Meta:
        model = JobApplication
        fields = ["id", "posting", "cover_letter", "applied_at", "status", "created_at"]
        read_only_fields = ["id", "status", "created_at"]

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