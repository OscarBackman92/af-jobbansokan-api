"""Helpers for transactional e-mail with clear API errors."""

from __future__ import annotations

import logging
import smtplib

from django.db import transaction
from rest_framework import serializers

logger = logging.getLogger(__name__)

_VERIFICATION_MAIL_ERROR = (
    "Vi kunde inte skicka verifieringsmejlet just nu. "
    "Försök igen om en stund."
)


def send_signup_verification_email(request, user) -> None:
    """Send the signup confirmation mail or raise a DRF validation error."""
    from allauth.account.utils import send_email_confirmation

    try:
        send_email_confirmation(request, user, signup=True)
    except (smtplib.SMTPException, OSError, TimeoutError):
        logger.exception("Signup verification e-mail failed for %s", user.email)
        raise serializers.ValidationError(_VERIFICATION_MAIL_ERROR) from None


def register_user_with_verification(request, register_save):
    """Run registration and roll back the user if the verification mail fails."""
    with transaction.atomic():
        user = register_save(request)
        send_signup_verification_email(request, user)
        return user
