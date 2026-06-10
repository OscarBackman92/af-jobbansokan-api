"""Mock BankID authentication flow.

Mimics the two-step BankID RP flow (auth -> collect) without talking to
the real service. Only active when settings.BANKID_MOCK is true — the
endpoints return 503 otherwise, so they can never act as a backdoor in a
real deployment. Design and production plan: docs/08-identity-bankid.md.
"""

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core import signing
from drf_spectacular.utils import extend_schema
from rest_framework import serializers, status
from rest_framework.decorators import (
    api_view,
    authentication_classes,
    permission_classes,
    throttle_classes,
)
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken

from .audit import log_event
from .identity import normalize_personal_number, pseudonymize_personal_number
from .models import ApplicantProfile, AuditLog
from .throttling import BankIDRateThrottle

User = get_user_model()

ORDER_SALT = "core.bankid.order"
ORDER_MAX_AGE = 300  # seconds


class BankIDInitiateSerializer(serializers.Serializer):
    personal_number = serializers.CharField()

    def validate_personal_number(self, value):
        normalized = normalize_personal_number(value)
        if normalized is None:
            raise serializers.ValidationError(
                "Expected a 12-digit personal identity number (YYYYMMDDNNNN)."
            )
        return normalized


class BankIDCollectSerializer(serializers.Serializer):
    order_ref = serializers.CharField()


def _mock_disabled_response():
    if not settings.BANKID_MOCK:
        return Response(
            {"detail": "BankID integration is not available."},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )
    return None


@extend_schema(
    request=BankIDInitiateSerializer,
    responses={
        200: {
            "type": "object",
            "properties": {
                "order_ref": {"type": "string"},
                "status": {"type": "string"},
            },
        }
    },
)
@api_view(["POST"])
@authentication_classes([])
@permission_classes([AllowAny])
@throttle_classes([BankIDRateThrottle])
def bankid_initiate(request):
    """Start a mock BankID order; returns an order_ref for collect."""
    unavailable = _mock_disabled_response()
    if unavailable:
        return unavailable

    serializer = BankIDInitiateSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    order_ref = signing.dumps(
        {"pnr": serializer.validated_data["personal_number"]}, salt=ORDER_SALT
    )
    return Response({"order_ref": order_ref, "status": "pending"})


@extend_schema(
    request=BankIDCollectSerializer,
    responses={
        200: {
            "type": "object",
            "properties": {
                "status": {"type": "string"},
                "access": {"type": "string"},
                "refresh": {"type": "string"},
                "user_id": {"type": "integer"},
            },
        }
    },
)
@api_view(["POST"])
@authentication_classes([])
@permission_classes([AllowAny])
@throttle_classes([BankIDRateThrottle])
def bankid_collect(request):
    """Complete a mock BankID order: link the identity and issue JWT."""
    unavailable = _mock_disabled_response()
    if unavailable:
        return unavailable

    serializer = BankIDCollectSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    try:
        payload = signing.loads(
            serializer.validated_data["order_ref"],
            salt=ORDER_SALT,
            max_age=ORDER_MAX_AGE,
        )
    except signing.BadSignature:
        return Response(
            {"order_ref": "Invalid or expired order."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    person_hash = pseudonymize_personal_number(payload["pnr"])
    profile = (
        ApplicantProfile.objects.select_related("user")
        .filter(personal_number_hash=person_hash)
        .first()
    )
    if profile is None:
        # No usable password: BankID is the only login path for these
        # accounts. The username must not reveal the personal number.
        user = User.objects.create_user(username=f"applicant-{person_hash[:12]}")
        profile = ApplicantProfile.objects.create(
            user=user, personal_number_hash=person_hash
        )

    log_event(
        profile.user,
        AuditLog.ACTION_IDENTITY_VERIFIED,
        person_hash=person_hash,
        method=profile.method,
    )
    refresh = RefreshToken.for_user(profile.user)
    return Response(
        {
            "status": "complete",
            "access": str(refresh.access_token),
            "refresh": str(refresh),
            "user_id": profile.user_id,
        }
    )
