from rest_framework import serializers

from .models import JobApplication

class JobApplicationSerializer(serializers.ModelSerializer):
    class Meta:
        model = JobApplication
        fields = ("id", "company", "role", "applied_at", "status", "created_at")
        read_only_fields = ("id", "created_at")