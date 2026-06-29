import secrets

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models

_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"


def _generate_operator_id(existing: set[str]) -> str:
    for _ in range(32):
        candidate = "ANS-" + "".join(secrets.choice(_ALPHABET) for _ in range(6))
        if candidate not in existing:
            return candidate
    raise RuntimeError("Could not allocate a unique operator id.")


def backfill_operator_profiles(apps, schema_editor):
    User = apps.get_model("auth", "User")
    OperatorProfile = apps.get_model("core", "OperatorProfile")
    EmailAddress = apps.get_model("account", "EmailAddress")

    existing = set(OperatorProfile.objects.values_list("operator_id", flat=True))
    for user in User.objects.iterator():
        if not OperatorProfile.objects.filter(user_id=user.id).exists():
            operator_id = _generate_operator_id(existing)
            existing.add(operator_id)
            OperatorProfile.objects.create(user_id=user.id, operator_id=operator_id)

        if not user.email:
            continue

        email = user.email.lower()
        addr = EmailAddress.objects.filter(user_id=user.id, email__iexact=email).first()
        if addr is None:
            EmailAddress.objects.create(
                user_id=user.id,
                email=email,
                verified=True,
                primary=True,
            )
        elif not addr.verified:
            addr.verified = True
            addr.primary = True
            addr.save(update_fields=["verified", "primary"])


class Migration(migrations.Migration):
    dependencies = [
        ("account", "0001_initial"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("core", "0004_savedjobsearch"),
    ]

    operations = [
        migrations.CreateModel(
            name="OperatorProfile",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("operator_id", models.CharField(max_length=16, unique=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "user",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="operator_profile",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ["-created_at"],
            },
        ),
        migrations.RunPython(backfill_operator_profiles, migrations.RunPython.noop),
    ]
