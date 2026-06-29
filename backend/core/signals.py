from django.contrib.auth import get_user_model
from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import OperatorProfile
from .operator_id import generate_operator_id

User = get_user_model()


@receiver(post_save, sender=User)
def ensure_operator_profile(sender, instance, **kwargs):
    OperatorProfile.objects.get_or_create(
        user=instance,
        defaults={"operator_id": generate_operator_id()},
    )
