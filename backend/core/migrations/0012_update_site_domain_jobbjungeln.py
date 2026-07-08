from django.db import migrations


def set_jobbjungeln_site(apps, schema_editor):
    Site = apps.get_model("sites", "Site")
    Site.objects.update_or_create(
        pk=1,
        defaults={"domain": "jobbjungeln.onrender.com", "name": "Jobbsöket"},
    )


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0011_resume_job_profiles"),
    ]

    operations = [
        migrations.RunPython(set_jobbjungeln_site, migrations.RunPython.noop),
    ]
