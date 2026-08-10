"""Suggest unknown skill aliases from saved application ad texts.

Read-only: prints the top unknown 1–2-grams with example lines.
Does not modify skill_canonical._CANONICAL_GROUPS — approve manually.
"""

from __future__ import annotations

import re
from collections import Counter

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError

from core.models import JobApplication
from core.skill_canonical import _CANONICAL_GROUPS

User = get_user_model()

TOKEN_RE = re.compile(r"[A-Za-zÀ-ÖØ-öø-ÿ0-9+#.]{2,}")
STOP = {
    "och",
    "att",
    "för",
    "med",
    "som",
    "den",
    "det",
    "eller",
    "har",
    "är",
    "på",
    "av",
    "en",
    "ett",
    "till",
    "från",
    "kan",
    "ska",
    "vid",
    "dig",
    "du",
    "vi",
    "vår",
    "vårt",
    "vara",
    "om",
    "inte",
    "samt",
    "inom",
    "efter",
    "innan",
    "arbete",
    "erfarenhet",
    "kunskap",
    "kunskaper",
    "god",
    "goda",
    "krav",
    "meriterande",
}


def _known_terms() -> set[str]:
    known: set[str] = set()
    for label, aliases in _CANONICAL_GROUPS:
        known.add(label.casefold())
        for alias in aliases:
            known.add(alias.casefold())
    return known


def _is_known(token: str, known: set[str]) -> bool:
    folded = token.casefold()
    if folded in known or folded in STOP:
        return True
    return any(
        folded.startswith(k) or k.startswith(folded)
        for k in known
        if len(k) >= 4 and len(folded) >= 4
    )


class Command(BaseCommand):
    help = "List frequent unknown terms in saved ad texts (manual alias review)."

    def add_arguments(self, parser):
        parser.add_argument("--email", required=True, help="User email to scan.")
        parser.add_argument("--limit", type=int, default=40)

    def handle(self, *args, **options):
        email = options["email"]
        user = User.objects.filter(email__iexact=email).first()
        if not user:
            raise CommandError(f"No user with email {email}")

        apps = JobApplication.objects.filter(owner=user, archived_at__isnull=True)
        known = _known_terms()
        counter: Counter[str] = Counter()
        examples: dict[str, str] = {}

        for app in apps.iterator():
            text = "\n".join(
                part
                for part in (
                    app.ad_description or "",
                    getattr(app.posting, "description", "") if app.posting_id else "",
                    app.title or "",
                    app.notes or "",
                )
                if part
            )
            tokens = [t for t in TOKEN_RE.findall(text) if t.casefold() not in STOP]
            # Unigrams
            for token in tokens:
                key = token.casefold()
                if _is_known(token, known):
                    continue
                counter[key] += 1
                examples.setdefault(key, token)
            # Bigrams
            for left, right in zip(tokens, tokens[1:], strict=False):
                if left.casefold() in STOP or right.casefold() in STOP:
                    continue
                phrase = f"{left} {right}"
                key = phrase.casefold()
                if _is_known(left, known) and _is_known(right, known):
                    continue
                counter[key] += 1
                examples.setdefault(key, phrase)

        self.stdout.write(
            self.style.NOTICE(
                f"Top unknown terms for {email} ({apps.count()} applications). "
                "Approve into _CANONICAL_GROUPS manually."
            )
        )
        for term, count in counter.most_common(options["limit"]):
            sample = examples.get(term, term)
            self.stdout.write(f"{count:4d}  {sample}")
