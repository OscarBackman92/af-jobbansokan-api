from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0020_update_site_domain_custom"),
    ]

    operations = [
        migrations.AddField(
            model_name="jobapplication",
            name="occupation_group_label",
            field=models.CharField(blank=True, max_length=255, null=True),
        ),
        migrations.AddField(
            model_name="jobapplication",
            name="working_hours_type",
            field=models.CharField(blank=True, max_length=64, null=True),
        ),
        migrations.AddField(
            model_name="jobapplication",
            name="scope_of_work_min",
            field=models.IntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="jobapplication",
            name="scope_of_work_max",
            field=models.IntegerField(blank=True, null=True),
        ),
    ]
