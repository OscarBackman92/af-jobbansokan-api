from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0013_jobapplication_ad_snapshot"),
    ]

    operations = [
        migrations.AddField(
            model_name="jobapplication",
            name="source",
            field=models.CharField(
                blank=True,
                choices=[
                    ("linkedin", "LinkedIn"),
                    ("platsbanken", "Platsbanken"),
                    ("company", "Företagets sida"),
                    ("recruiter", "Rekryterare"),
                    ("other", "Annat"),
                ],
                max_length=32,
            ),
        ),
    ]
