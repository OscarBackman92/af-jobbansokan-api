from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0018_job_lifecycle_stage_outcome"),
    ]

    operations = [
        migrations.AddField(
            model_name="applicationevent",
            name="report_excluded",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="activity",
            name="report_excluded",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="activity",
            name="report_note",
            field=models.CharField(blank=True, max_length=255),
        ),
    ]
