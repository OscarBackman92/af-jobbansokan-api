from django.db import migrations, models


def copy_skills_to_groups(apps, schema_editor):
    Resume = apps.get_model("core", "Resume")
    for resume in Resume.objects.all():
        skills = resume.skills or []
        if skills and not resume.skill_groups:
            resume.skill_groups = {
                "technical": list(skills),
                "domain": [],
                "languages": [],
            }
            resume.save(update_fields=["skill_groups"])


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0009_savedjobsearch_multiselect"),
    ]

    operations = [
        migrations.AddField(
            model_name="resume",
            name="skill_groups",
            field=models.JSONField(blank=True, default=dict),
        ),
        migrations.RunPython(copy_skills_to_groups, migrations.RunPython.noop),
    ]
