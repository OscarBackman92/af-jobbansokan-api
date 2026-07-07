from django.db import migrations, models


def migrate_skill_groups_to_profiles(apps, schema_editor):
    Resume = apps.get_model("core", "Resume")
    for resume in Resume.objects.all():
        if resume.job_profiles:
            continue
        groups = resume.skill_groups or {}
        skills = resume.skills or []
        if not any(groups.values()) and skills:
            groups = {
                "technical": list(skills),
                "domain": [],
                "languages": [],
            }
        if not any(groups.values()):
            resume.job_profiles = [
                {
                    "id": "default",
                    "label": resume.headline.strip() or "Mitt jobbsök",
                    "active": True,
                    "evidence": [],
                }
            ]
        else:
            evidence = []
            for category in ("technical", "domain", "languages"):
                for term in groups.get(category, []):
                    if not isinstance(term, str) or not term.strip():
                        continue
                    evidence.append(
                        {
                            "id": f"legacy-{len(evidence)}",
                            "term": term.strip(),
                            "category": category,
                            "source": {
                                "type": "manual",
                                "index": None,
                                "label": "Tidigare kompetenslista",
                            },
                            "confirmed": True,
                        }
                    )
            resume.job_profiles = [
                {
                    "id": "default",
                    "label": resume.headline.strip() or "Mitt jobbsök",
                    "active": True,
                    "evidence": evidence,
                }
            ]
        resume.save(update_fields=["job_profiles"])


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0010_resume_skill_groups"),
    ]

    operations = [
        migrations.AddField(
            model_name="resume",
            name="job_profiles",
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.RunPython(
            migrate_skill_groups_to_profiles, migrations.RunPython.noop
        ),
    ]
