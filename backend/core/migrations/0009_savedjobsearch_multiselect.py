from django.db import migrations, models


def copy_legacy_filters(apps, schema_editor):
    SavedJobSearch = apps.get_model("core", "SavedJobSearch")
    for search in SavedJobSearch.objects.all():
        if search.region:
            search.regions = [search.region]
        if search.municipality:
            search.municipalities = [search.municipality]
        if search.field:
            search.occupation_fields = [search.field]
        if search.group:
            search.occupation_groups = [search.group]
        search.save(
            update_fields=[
                "regions",
                "municipalities",
                "occupation_fields",
                "occupation_groups",
            ]
        )


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0008_retention_email_tracking"),
    ]

    operations = [
        migrations.AddField(
            model_name="savedjobsearch",
            name="regions",
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.AddField(
            model_name="savedjobsearch",
            name="municipalities",
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.AddField(
            model_name="savedjobsearch",
            name="occupation_fields",
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.AddField(
            model_name="savedjobsearch",
            name="occupation_groups",
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.AddField(
            model_name="savedjobsearch",
            name="match_cv",
            field=models.BooleanField(default=False),
        ),
        migrations.RunPython(copy_legacy_filters, migrations.RunPython.noop),
        migrations.RemoveField(model_name="savedjobsearch", name="region"),
        migrations.RemoveField(model_name="savedjobsearch", name="municipality"),
        migrations.RemoveField(model_name="savedjobsearch", name="field"),
        migrations.RemoveField(model_name="savedjobsearch", name="group"),
    ]
