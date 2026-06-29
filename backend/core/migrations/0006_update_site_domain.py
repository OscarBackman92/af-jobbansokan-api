from django.db import migrations


def set_production_site(apps, schema_editor):
    Site = apps.get_model("sites", "Site")
    Site.objects.update_or_create(
        pk=1,
        defaults={"domain": "ansokt.onrender.com", "name": "Ansökt"},
    )


class Migration(migrations.Migration):
    dependencies = [
        ("sites", "0002_alter_domain_unique"),
        ("core", "0005_operatorprofile"),
    ]

    operations = [
        migrations.RunPython(set_production_site, migrations.RunPython.noop),
    ]
