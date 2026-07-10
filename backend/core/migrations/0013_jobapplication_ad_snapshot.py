from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0012_update_site_domain_jobbjungeln"),
    ]

    operations = [
        migrations.AddField(
            model_name="jobapplication",
            name="apply_url",
            field=models.URLField(
                blank=True,
                help_text="Direct employer apply URL when Platsbanken provides one.",
                max_length=500,
            ),
        ),
        migrations.AddField(
            model_name="jobapplication",
            name="ad_description",
            field=models.TextField(
                blank=True,
                help_text="Snapshot of the ad text when saved from Platsbanken.",
            ),
        ),
        migrations.AddField(
            model_name="jobapplication",
            name="source_job_id",
            field=models.CharField(
                blank=True,
                help_text="JobTech ad id for refreshing the snapshot.",
                max_length=32,
            ),
        ),
    ]
