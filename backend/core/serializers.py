from __future__ import annotations

from dj_rest_auth.registration.serializers import RegisterSerializer
from dj_rest_auth.serializers import (
    PasswordChangeSerializer,
    PasswordResetConfirmSerializer,
    PasswordResetSerializer,
)
from django.conf import settings
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import serializers

from .ad_url import ad_urls_equivalent, normalize_ad_url
from .email_delivery import register_user_with_verification
from .matching import match_application
from .skill_groups import (
    EMPTY_SKILL_GROUPS,
    flatten_skill_groups,
    normalize_skill_groups,
    skill_groups_from_flat,
)
from .models import (
    ApplicationEvent,
    JobApplication,
    Resume,
    SavedJobSearch,
)
from .tokens import revoke_refresh_tokens

User = get_user_model()


class ApplicationEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = ApplicationEvent
        fields = ["id", "occurred_at", "note", "status", "created_at"]
        read_only_fields = ["id", "created_at"]

    def validate_occurred_at(self, value):
        if value > timezone.localdate():
            raise serializers.ValidationError("occurred_at cannot be in the future.")
        return value


class JobApplicationListSerializer(serializers.ModelSerializer):
    """Lean row for list responses — no timeline.

    The board renders hundreds of rows; shipping every row's full event
    history made the list payload grow with total activity. The detail
    endpoint still includes ``events``.
    """

    status_label = serializers.CharField(source="get_status_display", read_only=True)
    match = serializers.SerializerMethodField()

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
            "match",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields

    def get_match(self, obj):
        skills = self.context.get("cv_skills")
        if not skills:
            return None
        return match_application(skills, obj)


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

        ad_url = attrs.get("ad_url", getattr(self.instance, "ad_url", ""))
        if ad_url:
            attrs["ad_url"] = normalize_ad_url(ad_url)
            ad_url = attrs["ad_url"]

        if ad_url and request:
            others = JobApplication.objects.filter(owner=request.user).exclude(
                ad_url=""
            )
            if self.instance:
                others = others.exclude(pk=self.instance.pk)
            for existing in others.only("ad_url"):
                if ad_urls_equivalent(existing.ad_url, ad_url):
                    raise serializers.ValidationError(
                        {"ad_url": "Du har redan sparat den här annonsen på tavlan."}
                    )
        return attrs


class EmailRegisterSerializer(RegisterSerializer):
    """Registration by e-mail only — no username field in the API.

    Enforce e-mail uniqueness here so an abandoned unverified signup
    cannot be silently replaced by a new registration attempt.
    """

    username = None

    def validate_email(self, email):
        email = super().validate_email(email)
        if User.objects.filter(email__iexact=email).exists():
            raise serializers.ValidationError(
                "Det finns redan ett konto med den här e-postadressen."
            )
        return email

    def save(self, request):
        return register_user_with_verification(request, super().save)


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


class RevokingPasswordChangeSerializer(PasswordChangeSerializer):
    """Password change also signs out every other device."""

    def save(self):
        super().save()
        revoke_refresh_tokens(self.user)


class RevokingPasswordResetConfirmSerializer(PasswordResetConfirmSerializer):
    """Password reset also signs out every other device."""

    def save(self):
        result = super().save()
        revoke_refresh_tokens(self.user)
        return result


class ProfileSerializer(serializers.ModelSerializer):
    """The authenticated user's own profile."""

    operator_id = serializers.CharField(
        source="operator_profile.operator_id", read_only=True
    )

    class Meta:
        model = User
        fields = ["id", "username", "email", "first_name", "last_name", "operator_id"]
        read_only_fields = ["id", "username", "operator_id"]


class ResumeSerializer(serializers.ModelSerializer):
    skills = serializers.ListField(child=serializers.CharField(), read_only=True)

    class Meta:
        model = Resume
        fields = [
            "headline",
            "summary",
            "skills",
            "skill_groups",
            "experience",
            "education",
            "updated_at",
        ]
        read_only_fields = ["updated_at", "skills"]

    def validate_skill_groups(self, value):
        try:
            return normalize_skill_groups(value)
        except ValueError as exc:
            raise serializers.ValidationError(str(exc)) from exc

    def validate(self, attrs):
        groups = attrs.get("skill_groups")
        if groups is None and self.instance:
            groups = normalize_skill_groups(self.instance.skill_groups)
        if groups is None:
            groups = dict(EMPTY_SKILL_GROUPS)
        attrs["skill_groups"] = groups
        attrs["skills"] = flatten_skill_groups(groups)
        return attrs

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

    def to_representation(self, instance):
        data = super().to_representation(instance)
        try:
            groups = normalize_skill_groups(data.get("skill_groups") or {})
        except ValueError:
            groups = dict(EMPTY_SKILL_GROUPS)
        if not any(groups.values()) and data.get("skills"):
            groups = skill_groups_from_flat(data["skills"])
        data["skill_groups"] = groups
        return data


class ResumeUploadSerializer(serializers.Serializer):
    file = serializers.FileField()


class SavedJobSearchSerializer(serializers.ModelSerializer):
    fields = serializers.ListField(
        child=serializers.CharField(max_length=80),
        source="occupation_fields",
        required=False,
        default=list,
    )
    groups = serializers.ListField(
        child=serializers.CharField(max_length=80),
        source="occupation_groups",
        required=False,
        default=list,
    )

    class Meta:
        model = SavedJobSearch
        fields = [
            "id",
            "label",
            "q",
            "regions",
            "municipalities",
            "fields",
            "groups",
            "remote",
            "match_cv",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]
