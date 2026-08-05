from django.db import migrations


def set_jobbdjungeln_name(apps, schema_editor):
    Site = apps.get_model("sites", "Site")
    Site.objects.filter(pk=1).update(name="Jobbdjungeln")


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0014_jobapplication_source"),
    ]

    operations = [
        migrations.RunPython(set_jobbdjungeln_name, migrations.RunPython.noop),
    ]
