"""Live search against Arbetsförmedlingen's open JobTech JobSearch API.

Unlike ``import_postings`` (which snapshots a fixed set into our DB), this
queries JobTech on every request so the Annonser tab covers the whole of
Platsbanken with real filters. No API key is required.

Region and occupation-field concept IDs are fixed parts of JobTech's
taxonomy; they are listed here so the UI can offer dropdowns without a
runtime taxonomy lookup.
"""

from __future__ import annotations

import requests

JOBTECH_SEARCH_URL = "https://jobsearch.api.jobtechdev.se/search"
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


class JobTechError(Exception):
    """Raised when the upstream JobTech API is unavailable or errors."""


def hit_to_job(hit: dict) -> dict:
    """Map a JobTech search hit to the shape the frontend consumes."""
    employer = (hit.get("employer") or {}).get("name") or ""
    workplace = hit.get("workplace_address") or {}
    location = workplace.get("municipality") or workplace.get("region") or ""
    return {
        "id": str(hit.get("id") or ""),
        "title": hit.get("headline") or "",
        "company_name": employer,
        "location": location,
        "description": (hit.get("description") or {}).get("text") or "",
        "webpage_url": (hit.get("webpage_url") or "")[:500],
        "published_at": (hit.get("publication_date") or "")[:10] or None,
        "application_deadline": (hit.get("application_deadline") or "")[:10] or None,
        "remote": bool(hit.get("remote_work")),
    }


def search(
    *,
    q: str = "",
    region: str = "",
    field: str = "",
    remote: bool = False,
    offset: int = 0,
    limit: int = 25,
) -> dict:
    """Query JobTech live and return {"total": int, "results": [job, ...]}.

    Unknown region/field concept IDs are ignored rather than passed
    upstream (where they would 400).
    """
    params: list[tuple[str, object]] = [
        ("offset", max(0, offset)),
        ("limit", min(max(1, limit), MAX_LIMIT)),
        ("sort", "pubdate-desc"),
    ]
    if q.strip():
        params.append(("q", q.strip()))
    if region in _REGION_IDS:
        params.append(("region", region))
    if field in _FIELD_IDS:
        params.append(("occupation-field", field))
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
