from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0021_jobapplication_occupation_snapshot"),
    ]

    operations = [
        migrations.AddField(
            model_name="jobapplication",
            name="salary_claim",
            field=models.CharField(
                blank=True,
                help_text="Löneanspråk vid ansökan, t.ex. 45 000 kr/mån.",
                max_length=80,
            ),
        ),
    ]
