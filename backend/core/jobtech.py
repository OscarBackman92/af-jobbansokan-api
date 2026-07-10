"""Live search against Arbetsförmedlingen's open JobTech JobSearch API.

Queries JobTech on every request so the Annonser tab covers the whole of
Platsbanken with real filters. No API key is required.

Region and occupation-field concept IDs are fixed parts of JobTech's
taxonomy; occupation groups are fetched lazily from JobTech Taxonomy when
the UI asks for a selected field's Platsbanken subcategories.
"""

from __future__ import annotations

import os
import re
from functools import lru_cache

import requests

# Env overrides exist so E2E tests can point at a local mock server.
JOBTECH_SEARCH_URL = os.getenv(
    "JOBTECH_SEARCH_URL", "https://jobsearch.api.jobtechdev.se/search"
)
JOBTECH_AD_URL = os.getenv(
    "JOBTECH_AD_URL", "https://jobsearch.api.jobtechdev.se/ad"
)
JOBTECH_TAXONOMY_CONCEPTS_URL = os.getenv(
    "JOBTECH_TAXONOMY_URL",
    "https://taxonomy.api.jobtechdev.se/v1/taxonomy/main/concepts",
)
MAX_LIMIT = 50

# (concept_id, label) — Sweden's 21 regions, alphabetical by label.
REGIONS = [
    ("DQZd_uYs_oKb", "Blekinge län"),
    ("oDpK_oZ2_WYt", "Dalarnas län"),
    ("zupA_8Nt_xcD", "Gävleborgs län"),
    ("K8iD_VQv_2BA", "Gotlands län"),
    ("wjee_qH2_yb6", "Hallands län"),
    ("65Ms_7r1_RTG", "Jämtlands län"),
    ("MtbE_xWT_eMi", "Jönköpings län"),
    ("9QUH_2bb_6Np", "Kalmar län"),
    ("tF3y_MF9_h5G", "Kronobergs län"),
    ("9hXe_F4g_eTG", "Norrbottens län"),
    ("xTCk_nT5_Zjm", "Örebro län"),
    ("oLT3_Q9p_3nn", "Östergötlands län"),
    ("CaRE_1nn_cSU", "Skåne län"),
    ("s93u_BEb_sx2", "Södermanlands län"),
    ("CifL_Rzy_Mku", "Stockholms län"),
    ("zBon_eET_fFU", "Uppsala län"),
    ("EVVp_h6U_GSZ", "Värmlands län"),
    ("g5Tt_CAV_zBd", "Västerbottens län"),
    ("NvUF_SP1_1zo", "Västernorrlands län"),
    ("G6DV_fKE_Viz", "Västmanlands län"),
    ("zdoY_6u5_Krt", "Västra Götalands län"),
]

# (concept_id, label) — JobTech's 21 occupation fields, alphabetical.
OCCUPATION_FIELDS = [
    ("X82t_awd_Qyc", "Administration, ekonomi, juridik"),
    ("j7Cq_ZJe_GkT", "Bygg och anläggning"),
    ("bh3H_Y3h_5eD", "Chefer och verksamhetsledare"),
    ("apaJ_2ja_LuF", "Data/IT"),
    ("RPTn_bxG_ExZ", "Försäljning, inköp, marknadsföring"),
    ("PaxQ_o1G_wWH", "Hantverk"),
    ("ScKy_FHB_7wT", "Hotell, restaurang, storhushåll"),
    ("NYW6_mP6_vwf", "Hälso- och sjukvård"),
    ("wTEr_CBC_bqh", "Industriell tillverkning"),
    ("yhCP_AqT_tns", "Installation, drift, underhåll"),
    ("Uuf1_GMh_Uvw", "Kropps- och skönhetsvård"),
    ("9puE_nYg_crq", "Kultur, media, design"),
    ("bH5L_uXD_ZAX", "Militära yrken"),
    ("VuuL_7CH_adj", "Naturbruk"),
    ("kJeN_wmw_9wX", "Naturvetenskap"),
    ("MVqp_eS8_kDZ", "Pedagogik"),
    ("whao_Q6A_ScE", "Sanering och renhållning"),
    ("E7hm_BLq_fqZ", "Säkerhet och bevakning"),
    ("ASGV_zcE_bWf", "Transport, distribution, lager"),
    ("GazW_2TU_kJw", "Yrken med social inriktning"),
    ("6Hq3_tKo_V57", "Yrken med teknisk inriktning"),
]

_REGION_IDS = {cid for cid, _ in REGIONS}
_FIELD_IDS = {cid for cid, _ in OCCUPATION_FIELDS}
# JobTech concept ids are short opaque tokens from taxonomy/search APIs.
_CONCEPT_ID_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_]{0,63}$")


class JobTechError(Exception):
    """Raised when the upstream JobTech API is unavailable or errors."""


def _concept_option(concept: dict, *, field_id: str) -> dict[str, str] | None:
    concept_id = concept.get("taxonomy/id")
    label = concept.get("taxonomy/preferred-label")
    if not concept_id or not label:
        return None
    return {"id": concept_id, "label": label, "field_id": field_id}


def _location_option(concept: dict, *, region_id: str) -> dict[str, str] | None:
    concept_id = concept.get("taxonomy/id")
    label = concept.get("taxonomy/preferred-label")
    if not concept_id or not label:
        return None
    return {"id": concept_id, "label": label, "region_id": region_id}


def _concepts_from_payload(payload) -> list[dict]:
    concepts = payload.get("value", []) if isinstance(payload, dict) else payload
    return concepts if isinstance(concepts, list) else []


def _taxonomy_concepts(params: dict[str, str]) -> list[dict]:
    try:
        response = requests.get(
            JOBTECH_TAXONOMY_CONCEPTS_URL,
            params=params,
            timeout=15,
        )
        response.raise_for_status()
        payload = response.json()
    except requests.RequestException as exc:
        raise JobTechError(str(exc)) from exc
    return _concepts_from_payload(payload)


@lru_cache(maxsize=64)
def occupation_groups(field_id: str) -> list[dict[str, str]]:
    """Return JobTech ssyk-level-4 occupation groups for one occupation field."""
    if field_id not in _FIELD_IDS:
        return []

    concepts = _taxonomy_concepts(
        {
            "type": "ssyk-level-4",
            "relation": "narrower",
            "related-ids": field_id,
        }
    )

    groups: list[dict[str, str]] = []
    seen: set[str] = set()
    for concept in concepts:
        option = _concept_option(concept, field_id=field_id)
        if not option or option["id"] in seen:
            continue
        seen.add(option["id"])
        groups.append(option)
    groups.sort(key=lambda item: item["label"].lower())
    return groups


@lru_cache(maxsize=64)
def municipalities(region_id: str) -> list[dict[str, str]]:
    """Return JobTech municipalities for one selected region."""
    if region_id not in _REGION_IDS:
        return []

    concepts = _taxonomy_concepts(
        {
            "type": "municipality",
            "relation": "narrower",
            "related-ids": region_id,
        }
    )

    locations: list[dict[str, str]] = []
    seen: set[str] = set()
    for concept in concepts:
        option = _location_option(concept, region_id=region_id)
        if not option or option["id"] in seen:
            continue
        seen.add(option["id"])
        locations.append(option)
    locations.sort(key=lambda item: item["label"].lower())
    return locations


def _dedupe_concept_ids(ids: list[str]) -> list[str]:
    """Keep unique, well-formed JobTech concept ids without taxonomy lookups.

    IDs come from our own municipality/group endpoints; re-validating each
    one against taxonomy on every search was slow enough to time out when
    many filters were selected.
    """
    valid: list[str] = []
    seen: set[str] = set()
    for concept_id in ids:
        if (
            concept_id
            and concept_id not in seen
            and _CONCEPT_ID_RE.fullmatch(concept_id)
        ):
            valid.append(concept_id)
            seen.add(concept_id)
    return valid


def _valid_municipality_ids(ids: list[str]) -> list[str]:
    return _dedupe_concept_ids(ids)


def _valid_region_ids(ids: list[str]) -> list[str]:
    valid: list[str] = []
    seen: set[str] = set()
    for region_id in ids:
        if region_id in _REGION_IDS and region_id not in seen:
            valid.append(region_id)
            seen.add(region_id)
    return valid


def _valid_occupation_group_ids(ids: list[str]) -> list[str]:
    return _dedupe_concept_ids(ids)


def _valid_occupation_field_ids(ids: list[str]) -> list[str]:
    valid: list[str] = []
    seen: set[str] = set()
    for field_id in ids:
        if field_id in _FIELD_IDS and field_id not in seen:
            valid.append(field_id)
            seen.add(field_id)
    return valid


def _application_url(hit: dict) -> str:
    """External apply/read URL when the employer hosts the ad (not via AF)."""
    details = hit.get("application_details") or {}
    if details.get("via_af"):
        return ""
    url = (details.get("url") or "").strip()
    if url:
        return url[:500]
    email = (details.get("email") or "").strip()
    if email and "@" in email:
        return f"mailto:{email}"[:500]
    return ""


def hit_to_job(hit: dict) -> dict:
    """Map a JobTech search hit to the shape the frontend consumes."""
    employer = (hit.get("employer") or {}).get("name") or ""
    workplace = hit.get("workplace_address") or {}
    location = workplace.get("municipality") or workplace.get("region") or ""
    webpage_url = (hit.get("webpage_url") or "")[:500]
    application_url = _application_url(hit)
    return {
        "id": str(hit.get("id") or ""),
        "title": hit.get("headline") or "",
        "company_name": employer,
        "location": location,
        "description": (hit.get("description") or {}).get("text") or "",
        "webpage_url": webpage_url,
        "application_url": application_url,
        "published_at": (hit.get("publication_date") or "")[:10] or None,
        "application_deadline": (hit.get("application_deadline") or "")[:10] or None,
        "remote": bool(hit.get("remote_work")),
    }


def fetch_ad(job_id: str) -> dict:
    """Fetch one Platsbanken ad by JobTech id."""
    job_id = str(job_id or "").strip()
    if not job_id or not job_id.isdigit():
        raise JobTechError("invalid job id")
    try:
        response = requests.get(f"{JOBTECH_AD_URL}/{job_id}", timeout=15)
        response.raise_for_status()
        return hit_to_job(response.json())
    except requests.RequestException as exc:
        raise JobTechError(str(exc)) from exc


def search(
    *,
    q: str = "",
    regions: list[str] | None = None,
    municipalities: list[str] | None = None,
    fields: list[str] | None = None,
    groups: list[str] | None = None,
    remote: bool = False,
    offset: int = 0,
    limit: int = 25,
) -> dict:
    """Query JobTech live and return {"total": int, "results": [job, ...]}.

    Malformed concept IDs are ignored. Municipality and occupation-group IDs
    are forwarded when well-formed — JobTech returns zero hits for unknown
    ids instead of erroring. Region and occupation-field ids are checked
    against the built-in taxonomy lists.
    """
    params: list[tuple[str, object]] = [
        ("offset", max(0, offset)),
        ("limit", min(max(1, limit), MAX_LIMIT)),
        ("sort", "pubdate-desc"),
    ]
    if q.strip():
        params.append(("q", q.strip()))

    valid_municipalities = _valid_municipality_ids(list(municipalities or []))
    valid_regions = _valid_region_ids(list(regions or []))
    if valid_municipalities:
        for municipality_id in valid_municipalities:
            params.append(("municipality", municipality_id))
    elif valid_regions:
        for region_id in valid_regions:
            params.append(("region", region_id))

    valid_groups = _valid_occupation_group_ids(list(groups or []))
    valid_fields = _valid_occupation_field_ids(list(fields or []))
    if valid_groups:
        for group_id in valid_groups:
            params.append(("occupation-group", group_id))
    elif valid_fields:
        for field_id in valid_fields:
            params.append(("occupation-field", field_id))

    if remote:
        params.append(("remote", "true"))

    try:
        response = requests.get(JOBTECH_SEARCH_URL, params=params, timeout=15)
        response.raise_for_status()
        payload = response.json()
    except requests.RequestException as exc:
        raise JobTechError(str(exc)) from exc

    return {
        "total": (payload.get("total") or {}).get("value", 0),
        "results": [hit_to_job(hit) for hit in payload.get("hits", [])],
    }
