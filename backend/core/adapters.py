from allauth.account.adapter import DefaultAccountAdapter
from django.conf import settings


class SPAAccountAdapter(DefaultAccountAdapter):
    """Point e-mail verification links at the SPA instead of Django views."""

    def get_email_confirmation_url(self, request, emailconfirmation):
        base = settings.FRONTEND_URL or f"{request.scheme}://{request.get_host()}"
        return f"{base.rstrip('/')}/?verify_key={emailconfirmation.key}"
