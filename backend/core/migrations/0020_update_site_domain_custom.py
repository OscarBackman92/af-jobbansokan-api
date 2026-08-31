from django.db import migrations


def set_custom_domain(apps, schema_editor):
    Site = apps.get_model("sites", "Site")
    Site.objects.filter(pk=1).update(
        domain="jobbdjungeln.obackman.se",
        name="Jobbdjungeln",
    )


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0019_activity_event_report_excluded"),
    ]

    operations = [
        migrations.RunPython(set_custom_domain, migrations.RunPython.noop),
    ]
