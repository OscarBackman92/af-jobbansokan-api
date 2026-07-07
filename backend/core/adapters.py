from allauth.account.adapter import DefaultAccountAdapter

from .spa_urls import spa_app_url


class SPAAccountAdapter(DefaultAccountAdapter):
    """Point e-mail verification links at the SPA instead of Django views."""

    def get_email_confirmation_url(self, request, emailconfirmation):
        return spa_app_url(request=request, query=f"verify_key={emailconfirmation.key}")
